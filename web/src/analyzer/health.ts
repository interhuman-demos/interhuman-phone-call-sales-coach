/**
 * Call-trajectory engine: signals in → health score + optional warning out.
 * Score 0..100, starts at 65, decays toward 60 (neutral), valence-weighted.
 */
import type { SignalEvent, SignalType } from "../contract";

const VALENCE: Record<SignalType, number> = {
  engagement: +6, interest: +5, confidence: +5, agreement: +4,
  confusion: -4, skepticism: -4, uncertainty: -4, hesitation: -5,
  stress: -5, disagreement: -6, frustration: -7, disengagement: -8,
};

const PROB_WEIGHT = { low: 0.4, medium: 0.7, high: 1.0 } as const;

export interface HealthUpdate {
  score: number;
  trend: "up" | "flat" | "down";
  warning?: string;
}

export class HealthEngine {
  private score = 65;
  private history: number[] = [65];
  private lastWarningAt = 0;

  onSignal(s: SignalEvent, nowMs: number): HealthUpdate {
    const w = PROB_WEIGHT[s.probability ?? "medium"];
    this.score = clamp(this.score + VALENCE[s.signal_type] * w);
    return this.tick(nowMs, s);
  }

  decay(nowMs: number): HealthUpdate {
    this.score = clamp(this.score + (60 - this.score) * 0.06);
    return this.tick(nowMs);
  }

  private tick(nowMs: number, s?: SignalEvent): HealthUpdate {
    this.history.push(this.score);
    if (this.history.length > 12) this.history.shift();

    const delta = this.score - this.history[0];
    const trend = delta > 2 ? "up" : delta < -2 ? "down" : "flat";
    const update: HealthUpdate = { score: Math.round(this.score), trend };

    const hardNegative = s && s.probability === "high" && VALENCE[s.signal_type] <= -6;
    const sustainedDrop = trend === "down" && this.score < 45;
    if ((hardNegative || sustainedDrop) && nowMs - this.lastWarningAt > 20_000) {
      this.lastWarningAt = nowMs;
      update.warning = hardNegative && s
        ? warningFor(s)
        : "Trajectory dropping — change gears.";
    }
    return update;
  }
}

function warningFor(s: SignalEvent): string {
  switch (s.signal_type) {
    case "disengagement": return "Buyer's checking out — ask something.";
    case "frustration":   return "Frustration rising — acknowledge it.";
    case "disagreement":  return "Resistance — explore it, don't push.";
    default:              return `Strong ${s.signal_type} — adjust.`;
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
