/**
 * MockAnalyzer — believable signals without the model, from the REAL
 * transcript of each utterance. Event shapes match the real endpoint,
 * so flipping to InterhumanAnalyzer changes nothing downstream.
 */
import type { SignalEvent, SignalType, TranscriptSegment } from "../contract";
import type { Analyzer, AnalyzerCallbacks } from "./index";

const FILLERS = /\b(um+|uh+|er+|hmm+|like,|you know|i mean|sort of|kind of)\b/gi;
const PRICE = /\b(price|pricing|cost|costs|dollar|thousand|per month|a month|\$\d)/i;
const QUESTION = /\?/;

export class MockAnalyzer implements Analyzer {
  private active = new Set<SignalType>();
  private monologueSec = 0;
  private timers: number[] = [];

  constructor(private cb: AnalyzerCallbacks) {}

  async start(): Promise<void> { /* nothing to connect */ }

  pushAudio(): void { /* mock only needs text */ }

  pushText(text: string, startSec: number, durationSec: number, _t: TranscriptSegment[]): void {
    const end = startSec + durationSec;
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    const fillerCount = (text.match(FILLERS) ?? []).length;
    const fillerRate = fillerCount / words;
    const wpm = (words / Math.max(durationSec, 1)) * 60;

    const fire = (signal_type: SignalType, probability: SignalEvent["probability"], rationale: string, delayMs = 900) =>
      this.later(() => {
        this.active.add(signal_type);
        this.cb.onSignal({ signal_type, start: startSec, probability, rationale, modality: ["audio"] });
      }, delayMs + Math.random() * 800);

    const endSignal = (signal_type: SignalType, delayMs = 1200) =>
      this.later(() => {
        if (this.active.delete(signal_type)) this.cb.onSignalEnded(signal_type, end);
      }, delayMs);

    // hesitation: filler-dense or halting delivery, worse near pricing
    if (fillerRate > 0.08 || (fillerCount >= 2 && durationSec < 8)) {
      const nearPrice = PRICE.test(text);
      fire(
        "hesitation",
        nearPrice || fillerRate > 0.15 ? "high" : "medium",
        nearPrice
          ? "Multiple filler words and restarts while discussing price; delivery slowed and flattened."
          : "Elevated filler-word rate and hesitant pacing across the utterance.",
      );
      if (nearPrice) fire("uncertainty", "medium", "Rising, unresolved intonation on the price statement.", 1600);
    } else {
      endSignal("hesitation");
      endSignal("uncertainty");
    }

    // confidence: fluent, well-paced, low fillers
    if (fillerRate < 0.03 && wpm > 110 && wpm < 190 && durationSec > 4) {
      fire("confidence", "high", "Steady pace, minimal fillers, declarative closes on statements.");
    } else {
      endSignal("confidence");
    }

    // monologue → buyer disengagement
    this.monologueSec = QUESTION.test(text) ? 0 : this.monologueSec + durationSec;
    if (this.monologueSec > 35) {
      fire("disengagement", this.monologueSec > 55 ? "high" : "medium",
        "Extended one-sided speech with no engagement check; listener backchannels dropped off.");
    } else if (this.monologueSec === 0) {
      endSignal("disengagement");
      if (durationSec > 2) fire("interest", "medium", "Question invited the listener in; energy lifted.", 1400);
    }

    // stress: rushed delivery
    if (wpm > 210) fire("stress", "medium", "Rushed delivery well above conversational pace.");
    else endSignal("stress");

    // periodic feedback, like realtime_feedback.generated
    if (this.monologueSec > 40) {
      this.later(() => this.cb.onFeedback("Stop pitching — ask something."), 2000);
    } else if (PRICE.test(text) && fillerRate > 0.08) {
      this.later(() => this.cb.onFeedback("Say the price plainly. Then pause."), 2200);
    }
  }

  close(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }
}
