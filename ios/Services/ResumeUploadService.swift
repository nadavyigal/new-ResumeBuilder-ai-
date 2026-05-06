import Foundation

// MARK: - Upload response

/// Full response from POST /api/upload-resume.
/// The server parses the PDF, runs AI optimisation, and returns IDs plus a preview score.
/// The resumeId is stored in the database and can be used by ResumeAnalysisService to
/// fetch raw_text via GET /api/resumes/{resumeId} for subsequent ATS scoring.
struct UploadResumeResponse {
    let resumeId: String
    let jobDescriptionId: String
    let reviewId: String
    /// ATS match score preview (0–100) computed during the upload's built-in optimisation.
    let matchScore: Int
    let keyImprovements: [String]
    let missingKeywords: [String]
}

// MARK: - Real service

/// Uploads a resume file plus job description to POST /api/upload-resume.
///
/// The server accepts multipart/form-data with two parts:
///   - "resume"          File part (PDF). Key must match exactly.
///   - "jobDescription"  Plain-text part. Key must match exactly.
///
/// On success the server returns JSON containing resumeId, jobDescriptionId, reviewId,
/// matchScore, keyImprovements, and missingKeywords.
final class ResumeUploadService: ResumeUploadServiceProtocol {
    private let session: URLSession

    init(session: URLSession = BackendConfig.urlSession) {
        self.session = session
    }

    func upload(
        fileData: Data,
        filename: String,
        mimeType: String,
        jobDescription: String,
        token: String
    ) async throws -> UploadResumeResponse {
        // Preflight guard — do not call the server unless the inputs are usable.
        guard !fileData.isEmpty else {
            throw ResumeServiceError.missingResumeText
        }
        guard !jobDescription.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw ResumeServiceError.missingJobDescription
        }

        let url = BackendConfig.baseURL.appendingPathComponent("api/upload-resume")
        let boundary = "Boundary-\(UUID().uuidString)"

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = buildMultipart(
            fileData: fileData,
            filename: filename,
            mimeType: mimeType,
            jobDescription: jobDescription,
            boundary: boundary
        )

        #if DEBUG
        print("[UploadResume] POST \(url) — file=\(filename) \(fileData.count) bytes, jd=\(jobDescription.count) chars")
        #endif

        let (data, response) = try await session.data(for: request)

        #if DEBUG
        if let http = response as? HTTPURLResponse {
            print("[UploadResume] HTTP status: \(http.statusCode)")
            if !(200...299).contains(http.statusCode) {
                let errorBody = String(data: data, encoding: .utf8) ?? "no body"
                print("[UploadResume] Error body: \(errorBody.prefix(500))")
            }
        }
        #endif

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ResumeServiceError.serverError(code, body)
        }

        return try decodeResponse(from: data)
    }

    // MARK: - Private helpers

    private func buildMultipart(
        fileData: Data,
        filename: String,
        mimeType: String,
        jobDescription: String,
        boundary: String
    ) -> Data {
        var body = Data()

        func append(_ string: String) {
            if let d = string.data(using: .utf8) { body.append(d) }
        }

        // File part — "resume" matches the server's formData.get("resume") key
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"resume\"; filename=\"\(filename)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        append("\r\n")

        // Job description part — "jobDescription" matches the server's formData.get("jobDescription") key
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"jobDescription\"\r\n\r\n")
        append(jobDescription)
        append("\r\n")

        append("--\(boundary)--\r\n")
        return body
    }

    private func decodeResponse(from data: Data) throws -> UploadResumeResponse {
        // Wire type mirrors the JSON shape returned by /api/upload-resume
        struct Raw: Decodable {
            let resumeId: String
            let jobDescriptionId: String
            let reviewId: String
            let matchScore: Int?
            let keyImprovements: [String]?
            let missingKeywords: [String]?
        }
        do {
            let raw = try JSONDecoder().decode(Raw.self, from: data)
            return UploadResumeResponse(
                resumeId: raw.resumeId,
                jobDescriptionId: raw.jobDescriptionId,
                reviewId: raw.reviewId,
                matchScore: raw.matchScore ?? 0,
                keyImprovements: raw.keyImprovements ?? [],
                missingKeywords: raw.missingKeywords ?? []
            )
        } catch {
            throw ResumeServiceError.decodingFailed(error.localizedDescription)
        }
    }
}
