/**
 * Call-trajectory engine: signals in → health score + nudges out.
 * Score 0..100, starts at 65, decays toward 60 (neutral), valence-weighted.
 */
import type { SignalEvent, SignalType, ServerMessage } from "../../shared/protocol.js";

const VALENCE: Record<SignalType, number> = {
  engagement: +6, interest: +5, confidence: +5, agreement: +4,
  confusion: -4, skepticism: -4, uncertainty: -4, hesitation: -5,
  stress: -5, disagreement: -6, frustration: -7, disengagement: -8,
};

const PROB_WEIGHT = { low: 0.4, medium: 0.7, high: 1.0 } as const;

export class HealthEngine {
  private score = 65;
  private history: number[] = [65];
  private lastWarningAt = 0;

  /** Returns UI messages to emit (health always; nudge when warranted). */
  onSignal(s: SignalEvent, nowMs: number): ServerMessage[] {
    const w = PROB_WEIGHT[s.probability ?? "medium"];
    this.score = clamp(this.score + VALENCE[s.signal_type] * w);
    return this.tick(nowMs, s);
  }

  /** Gentle decay toward neutral; call periodically. */
  decay(nowMs: number): ServerMessage[] {
    this.score = clamp(this.score + (60 - this.score) * 0.06);
    return this.tick(nowMs);
  }

  private tick(nowMs: number, s?: SignalEvent): ServerMessage[] {
    this.history.push(this.score);
    if (this.history.length > 12) this.history.shift();

    const prev = this.history[0];
    const delta = this.score - prev;
    const trend = delta > 2 ? "up" : delta < -2 ? "down" : "flat";
    const out: ServerMessage[] = [{ type: "health", score: Math.round(this.score), trend }];

    // warning: sustained drop or a hard negative signal, rate-limited to 1/20s
    const hardNegative = s && s.probability === "high" && VALENCE[s.signal_type] <= -6;
    const sustainedDrop = trend === "down" && this.score < 45;
    if ((hardNegative || sustainedDrop) && nowMs - this.lastWarningAt > 20_000) {
      this.lastWarningAt = nowMs;
      out.push({
        type: "nudge",
        severity: "warning",
        text: hardNegative && s
          ? warningFor(s)
          : "Trajectory is dropping — change gears: ask a question, or address what's landed badly.",
      });
    }
    return out;
  }
}

function warningFor(s: SignalEvent): string {
  switch (s.signal_type) {
    case "disengagement": return "The buyer is checking out — stop pitching and ask them something.";
    case "frustration":   return "Frustration detected — acknowledge it before moving on.";
    case "disagreement":  return "You've hit resistance — explore it, don't talk past it.";
    default:              return `Strong ${s.signal_type} detected — adjust course.`;
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
