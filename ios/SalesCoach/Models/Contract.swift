import Foundation

/// Codable mirror of web/src/contract.ts — the single source of truth for the
/// client contract. Property names intentionally match the JSON keys exactly
/// (including snake_case where the API uses it) so the two files can be
/// compared side by side.

// MARK: - Signals (Interhuman AsyncAPI shapes)

enum SignalType: String, Codable, CaseIterable {
    case agreement, confidence, confusion, disagreement
    case disengagement, engagement, frustration, hesitation
    case interest, skepticism, stress, uncertainty

    /// Mirrors the POSITIVE list in web/src/App.tsx.
    var isPositive: Bool {
        switch self {
        case .engagement, .interest, .confidence, .agreement: return true
        default: return false
        }
    }
}

enum Probability: String, Codable {
    case low, medium, high
}

struct SignalEvent: Codable {
    let signal_type: SignalType
    let start: Double            // session-cumulative seconds
    let probability: Probability?
    let rationale: String?
    let modality: [String]?
}

struct TranscriptSegment: Codable {
    let start: Double
    let end: Double
    let text: String
    let speaker: Int             // 0 = rep, 1 = buyer
}

// MARK: - /api/turn

struct Turn: Codable {
    let role: String             // "rep" | "buyer"
    let text: String
}

/// What the analysis currently hears — sent with each turn so the buyer
/// reacts to delivery, not just words.
struct SignalsSnapshot: Codable {
    struct Active: Codable {
        let signal_type: SignalType
        let probability: Probability?
    }
    let active: [Active]
    let health: Int              // call-trajectory score 0..100
    let trend: String            // "up" | "flat" | "down"
}

struct TurnRequest: Codable {
    let audio: String            // base64 audio (one rep utterance) — ignored when kickoff is true
    let history: [Turn]
    let signals: SignalsSnapshot?
    let personaId: String?
    let kickoff: Bool?           // true for the buyer's opening line — no audio, no STT
}

struct TurnResponse: Codable {
    let repText: String          // "" if nothing was transcribed
    let buyerText: String
    let audio: String            // base64 audio/mpeg of the buyer's reply
}

// MARK: - /api/transcribe

struct TranscribeResponse: Codable {
    let text: String
}

// MARK: - /api/debrief

/// One signal occurrence over wall-clock call time (seconds since call start).
struct SignalSpan: Codable, Identifiable {
    let signal_type: SignalType
    var probability: Probability?
    let positive: Bool
    let startSec: Double
    var endSec: Double?          // nil = still active when logged

    var id: String { "\(signal_type.rawValue)-\(startSec)" }
}

struct HealthSample: Codable, Identifiable {
    let t: Double                // seconds since call start
    let score: Int               // trajectory 0..100

    var id: Double { t }
}

struct DebriefRequest: Codable {
    let history: [Turn]
    let signalLog: [SignalSpan]
    let healthSamples: [HealthSample]
    let nudges: [String]
    let personaId: String?
    let transcript: [TranscriptSegment]  // timed segments — lets the client compute talk ratio & pace itself
}

struct DebriefMoment: Codable, Identifiable {
    let atSec: Double
    let label: String
    let detail: String
    let tag: String              // "objection handled" | "watch out" | "strong close" | "neutral"

    var id: Double { atSec }
}

struct ObjectionsHandled: Codable {
    let handled: Int
    let raised: Int
}

struct SkillScores: Codable {
    let discovery: Int           // 0..100 each
    let listening: Int
    let valueFraming: Int
    let objectionHandling: Int
    let closing: Int
}

struct DebriefResponse: Codable {
    let score: Int
    let headline: String
    let moments: [DebriefMoment]
    let strengths: [String]
    let improvements: [String]
    let drill: String
    let objectionsHandled: ObjectionsHandled
    let skillScores: SkillScores
}

// MARK: - /api/custom-personas

struct CustomScenarioRequest: Codable {
    let name: String
    let title: String
    let company: String
    let industry: String
    let icpNotes: String          // free text: pain points, current stack/process, budget & who approves
    let product: String           // "Name — one-line description"
    let sellingPoints: [String]   // 2-3 short bullets
    let price: String
    let difficulty: String        // "easy" | "medium" | "hard"
    let personalityTags: [String] // e.g. ["Skeptical", "Time-pressed"] — shapes the buyer's prompt
}

struct CustomScenarioResponse: Codable {
    let persona: Persona
}

// MARK: - /api/generate-scenario

struct GenerateScenarioRequest: Codable {
    let prompt: String            // a sentence or two describing the buyer and/or product
}

struct GenerateScenarioResponse: Codable {
    let draft: CustomScenarioRequest  // pre-fills the create-scenario form; user still reviews before saving
}

// MARK: - /api/interhuman-token

struct TokenResponse: Codable {
    let access_token: String
    let expires_in: Int
    let url: String              // wss endpoint to connect to
}
