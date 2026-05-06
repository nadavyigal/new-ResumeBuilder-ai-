import Foundation

private struct OptimizeRequest: Encodable {
    let resumeId: String
    let jobDescriptionId: String
}

private struct OptimizeAPIResponse: Decodable {
    // Server returns reviewId; we expose it as optimizationId for the ViewModel.
    let reviewId: String?
    let optimizationId: String?
}

final class ResumeOptimizationService: ResumeOptimizationServiceProtocol {
    private let session: URLSession

    init(session: URLSession = BackendConfig.urlSession) {
        self.session = session
    }

    func optimize(resumeId: String, jobDescription: String, token: String) async throws -> OptimizeResponse {
        let url = BackendConfig.baseURL.appendingPathComponent("api/optimize")

        // The server expects resumeId + jobDescriptionId; for the mobile flow we
        // pass jobDescription as raw text and the server stores it first.
        // Adjust if the mobile flow later stores the JD separately.
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(["resumeId": resumeId, "jobDescription": jobDescription])

        let (data, response) = try await session.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ResumeServiceError.serverError(code, body)
        }

        let decoded = try JSONDecoder().decode(OptimizeAPIResponse.self, from: data)
        let id = decoded.optimizationId ?? decoded.reviewId ?? ""
        return OptimizeResponse(optimizationId: id)
    }
}

// MARK: - Exports

private struct ExportRequest: Encodable {
    let optimizationId: String
}

private struct ExportAPIResponse: Decodable {
    let exportId: String?
}

final class ResumeExportService: ResumeExportServiceProtocol {
    private let session: URLSession

    init(session: URLSession = BackendConfig.urlSession) {
        self.session = session
    }

    func exportPDF(optimizationId: String, token: String) async throws -> ExportResponse {
        let url = BackendConfig.baseURL.appendingPathComponent("api/download/\(optimizationId)")
            .appending(queryItems: [URLQueryItem(name: "fmt", value: "pdf")])

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ResumeServiceError.serverError(code, body)
        }

        let decoded = try? JSONDecoder().decode(ExportAPIResponse.self, from: data)
        return ExportResponse(exportId: decoded?.exportId ?? optimizationId)
    }

    func downloadPDF(id: String, token: String) async throws -> Data {
        let url = BackendConfig.baseURL.appendingPathComponent("api/download/\(id)")
            .appending(queryItems: [URLQueryItem(name: "fmt", value: "pdf")])

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ResumeServiceError.serverError(code, body)
        }
        return data
    }
}

// MARK: - Recent exports

private struct ResumeExportListItem: Decodable {
    let id: String
    let filename: String?
    let created_at: String?
}

final class RecentExportsService: RecentExportsServiceProtocol {
    private let session: URLSession
    private static let iso8601 = ISO8601DateFormatter()

    init(session: URLSession = BackendConfig.urlSession) {
        self.session = session
    }

    func list(token: String) async throws -> [ResumeExport] {
        let url = BackendConfig.baseURL.appendingPathComponent("api/optimizations")

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            return []
        }

        let items = (try? JSONDecoder().decode([ResumeExportListItem].self, from: data)) ?? []
        return items.map { item in
            ResumeExport(
                id: item.id,
                filename: item.filename ?? "resume.pdf",
                createdAt: item.created_at.flatMap { Self.iso8601.date(from: $0) } ?? Date()
            )
        }
    }
}
