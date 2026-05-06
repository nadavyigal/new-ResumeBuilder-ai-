import Foundation

// MARK: - ATS / Analysis

struct ResumeAnalysis {
    let overallScore: Int
    let subscores: [String: Int]
    let confidence: Double
}

struct ResumeImprovement: Identifiable {
    let id: String
    let text: String
    let estimatedGain: Int
    let category: String
    let quickWin: Bool
}

// MARK: - Optimization

struct OptimizeResponse {
    let optimizationId: String
}

// MARK: - Exports

struct ResumeExport: Identifiable {
    let id: String
    let filename: String
    let createdAt: Date
}

struct ExportResponse {
    let exportId: String?
}
