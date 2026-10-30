import Foundation

/// Client-local record of the last practice per scenario — the backend has no
/// history today, so Home's "last score / 2h ago" rows and the Recent filter
/// are powered from here (UserDefaults-backed). Not synced across devices.
struct PracticeHistoryStore {
    struct Entry: Codable {
        let score: Int
        let date: Date
    }

    private static let key = "practiceHistory.v1"
    private var byPersona: [String: Entry]

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.key),
           let decoded = try? JSONDecoder().decode([String: Entry].self, from: data) {
            byPersona = decoded
        } else {
            byPersona = [:]
        }
    }

    func entry(for personaId: String) -> Entry? { byPersona[personaId] }

    /// True once a scenario has at least one completed practice — powers "Recent".
    func hasPracticed(_ personaId: String) -> Bool { byPersona[personaId] != nil }

    /// Most-recent-first persona ids, for ordering the Recent tab.
    var recentPersonaIds: [String] {
        byPersona.sorted { $0.value.date > $1.value.date }.map(\.key)
    }

    mutating func record(personaId: String, score: Int, date: Date) {
        byPersona[personaId] = Entry(score: score, date: date)
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(byPersona) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }

    /// "just now" / "2h ago" / "3d ago" — compact relative time for list rows.
    static func relative(_ date: Date, now: Date = Date()) -> String {
        let s = max(0, now.timeIntervalSince(date))
        if s < 60 { return "just now" }
        if s < 3600 { return "\(Int(s / 60))m ago" }
        if s < 86_400 { return "\(Int(s / 3600))h ago" }
        return "\(Int(s / 86_400))d ago"
    }
}
