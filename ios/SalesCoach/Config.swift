import Foundation

/// Backend configuration. Points at the production Vercel deployment by
/// default; override with the COACH_BASE_URL environment variable in the
/// scheme for local dev (e.g. http://localhost:8788 via `npm run dev:local`).
enum Config {
    static let baseURL: URL = {
        if let raw = ProcessInfo.processInfo.environment["COACH_BASE_URL"],
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://interhuman-phone-call-sales-coach-interhuman.vercel.app")!
    }()
}
