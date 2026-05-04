import Foundation

enum BackendConfig {
    /// Stage 1 ships without monetization. Flip to `true` once the backend
    /// credit ledger and StoreKit IAP wiring land in Stage 2.
    static let isMonetizationEnabled = false

    static var apiBaseURL: URL {
        if let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           let url = URL(string: value), !value.isEmpty {
            return url
        }
        return URL(string: "http://localhost:3000")!
    }

    static var supabaseURL: URL {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           let url = URL(string: value), !value.isEmpty {
            return url
        }
        return URL(string: "https://YOUR_PROJECT.supabase.co")!
    }

    static var supabaseAnonKey: String {
        (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String) ?? ""
    }
}
