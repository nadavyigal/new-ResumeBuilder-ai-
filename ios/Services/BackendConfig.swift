import Foundation

/// Central backend configuration.
/// Set BACKEND_BASE_URL in Info.plist (or here) before shipping.
enum BackendConfig {
    static let baseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "BACKEND_BASE_URL") as? String,
              let url = URL(string: raw)
        else {
            return URL(string: "https://www.resumelybuilderai.com")!
        }
        return url
    }()

    static let supabaseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              let url = URL(string: raw)
        else {
            fatalError("SUPABASE_URL must be set in Info.plist")
        }
        return url
    }()

    static let supabaseAnonKey: String = {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String
        else {
            fatalError("SUPABASE_ANON_KEY must be set in Info.plist")
        }
        return key
    }()

    /// Flip to true to use in-memory mock services during development / unit tests.
    static let useMockServices: Bool = {
#if DEBUG
        return ProcessInfo.processInfo.environment["USE_MOCK_SERVICES"] == "1"
#else
        return false
#endif
    }()

    /// Shared URLSession with generous timeouts for all API calls.
    /// - timeoutIntervalForRequest: 120 s  — time to receive first byte from server
    /// - timeoutIntervalForResource: 600 s — total download budget (for large PDF uploads)
    static let urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 120
        config.timeoutIntervalForResource = 600
        return URLSession(configuration: config)
    }()
}
