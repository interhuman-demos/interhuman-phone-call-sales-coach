import Foundation

/// Public persona fields, fetched from GET /api/personas at launch (the buyer
/// prompts and voice ids stay server-side).
struct Persona: Codable, Identifiable, Hashable {
    struct Scenario: Codable, Hashable {
        let product: String          // "Name — what it is", one line
        let sellingPoints: [String]  // 3 short bullets
        let price: String
        let context: [String]        // quick-orientation bullets: who they are, stack, budget
        let opener: String?          // optional — a line you can read if you want a starting point
    }

    let id: String
    let name: String
    let title: String
    let company: String
    let industry: String
    let emoji: String
    let tagline: String
    let difficulty: String           // "easy" | "medium" | "hard"
    /// true for scenarios created via the "create your own" form, not the built-in five.
    let custom: Bool?
    let scenario: Scenario

    /// "Dana" from "Dana Reyes", "Priya" from "Dr. Priya Nair" — mirrors App.tsx.
    var firstName: String {
        name.replacingOccurrences(of: "Dr. ", with: "").components(separatedBy: " ").first ?? name
    }
}

struct PersonasResponse: Codable {
    let personas: [Persona]
}
