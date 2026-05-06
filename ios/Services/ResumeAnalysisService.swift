import Foundation

// MARK: - Errors

enum ResumeServiceError: Error, LocalizedError {
    case missingResumeText
    case missingJobDescription
    case serverError(Int, String)
    case decodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingResumeText:
            return "Resume text could not be retrieved."
        case .missingJobDescription:
            return "Job description must not be empty."
        case .serverError(let code, let message):
            return "Server error \(code): \(message)"
        case .decodingFailed(let detail):
            return "Failed to parse server response: \(detail)"
        }
    }
}

// MARK: - Wire types

/// Exact field names required by POST /api/ats/score
private struct ATSScoreRequest: Encodable {
    let resume_original: String
    let resume_optimized: String
    let job_description: String
}

private struct ATSScoreResponse: Decodable {
    let ats_score_original: Int
    let ats_score_optimized: Int
    let subscores: [String: Double]?
    let confidence: Double?
    let suggestions: [SuggestionPayload]?

    struct SuggestionPayload: Decodable {
        let id: String
        let text: String
        let estimated_gain: Int?
        let quick_win: Bool?
        let category: String?
    }
}

private struct ResumeTextResponse: Decodable {
    let raw_text: String
}

// MARK: - Real service

final class ResumeAnalysisService: ResumeAnalysisServiceProtocol {
    private let session: URLSession

    init(session: URLSession = BackendConfig.urlSession) {
        self.session = session
    }

    // MARK: ResumeAnalysisServiceProtocol

    func score(resumeId: String, jobDescription: String, token: String) async throws -> ResumeAnalysis {
        // Preflight: don't call the API unless all required values are ready
        guard !jobDescription.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw ResumeServiceError.missingJobDescription
        }
        guard !resumeId.isEmpty else {
            throw ResumeServiceError.missingResumeText
        }

        let resumeText = try await fetchResumeText(resumeId: resumeId, token: token)
        guard !resumeText.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw ResumeServiceError.missingResumeText
        }

        let response = try await callATSScore(
            resumeOriginal: resumeText,
            resumeOptimized: resumeText,   // same text: no optimized version yet at this stage
            jobDescription: jobDescription,
            token: token
        )

        let subscoredInts = (response.subscores ?? [:]).mapValues { Int($0) }
        return ResumeAnalysis(
            overallScore: response.ats_score_optimized,
            subscores: subscoredInts,
            confidence: response.confidence ?? 0
        )
    }

    func improvements(resumeId: String, jobDescription: String, token: String) async throws -> [ResumeImprovement] {
        guard !jobDescription.trimmingCharacters(in: .whitespaces).isEmpty,
              !resumeId.isEmpty
        else { return [] }

        let resumeText = try await fetchResumeText(resumeId: resumeId, token: token)
        guard !resumeText.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }

        let response = try await callATSScore(
            resumeOriginal: resumeText,
            resumeOptimized: resumeText,
            jobDescription: jobDescription,
            token: token
        )

        return (response.suggestions ?? []).map { s in
            ResumeImprovement(
                id: s.id,
                text: s.text,
                estimatedGain: s.estimated_gain ?? 0,
                category: s.category ?? "general",
                quickWin: s.quick_win ?? false
            )
        }
    }

    // MARK: - Private helpers

    /// GET /api/resumes/{resumeId} — returns the stored raw text for this resume
    private func fetchResumeText(resumeId: String, token: String) async throws -> String {
        let url = BackendConfig.baseURL
            .appendingPathComponent("api/resumes")
            .appendingPathComponent(resumeId)

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        try assertSuccess(response: response, data: data)

        let decoded = try decode(ResumeTextResponse.self, from: data)
        return decoded.raw_text
    }

    /// POST /api/ats/score — scores resume text against a job description
    private func callATSScore(
        resumeOriginal: String,
        resumeOptimized: String,
        jobDescription: String,
        token: String
    ) async throws -> ATSScoreResponse {
        let url = BackendConfig.baseURL.appendingPathComponent("api/ats/score")

        let payload = ATSScoreRequest(
            resume_original: resumeOriginal,
            resume_optimized: resumeOptimized,
            job_description: jobDescription
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await session.data(for: request)
        try assertSuccess(response: response, data: data)

        return try decode(ATSScoreResponse.self, from: data)
    }

    private func assertSuccess(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw ResumeServiceError.serverError(0, "Non-HTTP response")
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "no body"
            throw ResumeServiceError.serverError(http.statusCode, body)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw ResumeServiceError.decodingFailed(error.localizedDescription)
        }
    }
}
