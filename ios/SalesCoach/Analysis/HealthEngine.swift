import Foundation

/// Call-trajectory engine — direct port of web/src/analyzer/health.ts.
/// Score 0..100, starts at 65, decays toward 60 (neutral), valence-weighted.
struct HealthUpdate {
    let score: Int
    let trend: String            // "up" | "flat" | "down"
    let warning: String?
}

final class HealthEngine {
    private static let valence: [SignalType: Double] = [
        .engagement: 6, .interest: 5, .confidence: 5, .agreement: 4,
        .confusion: -4, .skepticism: -4, .uncertainty: -4, .hesitation: -5,
        .stress: -5, .disagreement: -6, .frustration: -7, .disengagement: -8,
    ]
    private static let probWeight: [Probability: Double] = [.low: 0.4, .medium: 0.7, .high: 1.0]

    private var score = 65.0
    private var history: [Double] = [65]
    private var lastWarningAt: TimeInterval = 0

    func onSignal(_ s: SignalEvent, nowMs: TimeInterval) -> HealthUpdate {
        let w = Self.probWeight[s.probability ?? .medium] ?? 0.7
        score = (score + (Self.valence[s.signal_type] ?? 0) * w).clamped()
        return tick(nowMs: nowMs, signal: s)
    }

    func decay(nowMs: TimeInterval) -> HealthUpdate {
        score = (score + (60 - score) * 0.06).clamped()
        return tick(nowMs: nowMs, signal: nil)
    }

    private func tick(nowMs: TimeInterval, signal s: SignalEvent?) -> HealthUpdate {
        history.append(score)
        if history.count > 12 { history.removeFirst() }

        let delta = score - history[0]
        let trend = delta > 2 ? "up" : delta < -2 ? "down" : "flat"

        var warning: String?
        let hardNegative = s.map { $0.probability == .high && (Self.valence[$0.signal_type] ?? 0) <= -6 } ?? false
        let sustainedDrop = trend == "down" && score < 45
        if (hardNegative || sustainedDrop) && nowMs - lastWarningAt > 20_000 {
            lastWarningAt = nowMs
            warning = hardNegative ? s.map(Self.warningFor) : "Trajectory dropping — change gears."
        }
        return HealthUpdate(score: Int(score.rounded()), trend: trend, warning: warning)
    }

    private static func warningFor(_ s: SignalEvent) -> String {
        switch s.signal_type {
        case .disengagement: return "Buyer's checking out — ask something."
        case .frustration:   return "Frustration rising — acknowledge it."
        case .disagreement:  return "Resistance — explore it, don't push."
        default:             return "Strong \(s.signal_type.rawValue) — adjust."
        }
    }
}

private extension Double {
    func clamped() -> Double { Swift.max(0, Swift.min(100, self)) }
}
