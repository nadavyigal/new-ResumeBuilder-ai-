import Foundation

protocol ResumeAnalysisServiceProtocol: Sendable {
    func score(resumeId: String, jobDescription: String, token: String) async throws -> ResumeAnalysis
    func improvements(resumeId: String, jobDescription: String, token: String) async throws -> [ResumeImprovement]
}

protocol ResumeOptimizationServiceProtocol: Sendable {
    func optimize(resumeId: String, jobDescription: String, token: String) async throws -> OptimizeResponse
}

protocol RecentExportsServiceProtocol: Sendable {
    func list(token: String) async throws -> [ResumeExport]
}

protocol ResumeExportServiceProtocol: Sendable {
    func exportPDF(optimizationId: String, token: String) async throws -> ExportResponse
    func downloadPDF(id: String, token: String) async throws -> Data
}

protocol ResumeUploadServiceProtocol: Sendable {
    func upload(
        fileData: Data,
        filename: String,
        mimeType: String,
        jobDescription: String,
        token: String
    ) async throws -> UploadResumeResponse
}
