import Foundation

final class MockResumeAnalysisService: ResumeAnalysisServiceProtocol {
    func score(resumeId: String, jobDescription: String, token: String) async throws -> ResumeAnalysis {
        ResumeAnalysis(overallScore: 78, subscores: ["keyword_exact": 72, "semantic_relevance": 85], confidence: 0.85)
    }

    func improvements(resumeId: String, jobDescription: String, token: String) async throws -> [ResumeImprovement] {
        [
            ResumeImprovement(id: "kw_001", text: "Add TypeScript to your Skills section", estimatedGain: 8, category: "keywords", quickWin: true),
            ResumeImprovement(id: "met_001", text: "Quantify your achievements with metrics", estimatedGain: 10, category: "metrics", quickWin: false),
        ]
    }
}

final class MockResumeOptimizationService: ResumeOptimizationServiceProtocol {
    func optimize(resumeId: String, jobDescription: String, token: String) async throws -> OptimizeResponse {
        OptimizeResponse(optimizationId: "mock-opt-\(UUID().uuidString.prefix(8))")
    }
}

final class MockRecentExportsService: RecentExportsServiceProtocol {
    func list(token: String) async throws -> [ResumeExport] {
        [
            ResumeExport(id: "mock-1", filename: "resume_v1.pdf", createdAt: Date()),
        ]
    }
}

final class MockResumeExportService: ResumeExportServiceProtocol {
    func exportPDF(optimizationId: String, token: String) async throws -> ExportResponse {
        ExportResponse(exportId: "mock-export-id")
    }

    func downloadPDF(id: String, token: String) async throws -> Data {
        Data("%PDF-1.4 mock".utf8)
    }
}

final class MockResumeUploadService: ResumeUploadServiceProtocol {
    func upload(
        fileData: Data,
        filename: String,
        mimeType: String,
        jobDescription: String,
        token: String
    ) async throws -> UploadResumeResponse {
        UploadResumeResponse(
            resumeId: "mock-resume-\(UUID().uuidString.prefix(8))",
            jobDescriptionId: "mock-jd-\(UUID().uuidString.prefix(8))",
            reviewId: "mock-review-\(UUID().uuidString.prefix(8))",
            matchScore: 75,
            keyImprovements: ["Add TypeScript to Skills section", "Quantify achievements with metrics"],
            missingKeywords: ["TypeScript", "AWS", "Docker"]
        )
    }
}
