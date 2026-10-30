/**
 * MockAnalyzer — believable signals without the model.
 * Heuristics over the REAL transcript of each rep utterance, so the demo
 * reacts to how you actually pitch. Event shapes match the real endpoint.
 */
import { EventEmitter } from "node:events";
import type { Analyzer, TranscriptSegment } from "./interhuman.js";
import type { SignalEvent, SignalType } from "../../shared/protocol.js";

const FILLERS = /\b(um+|uh+|er+|hmm+|like,|you know|i mean|sort of|kind of)\b/gi;
const PRICE = /\b(price|pricing|cost|costs|dollar|thousand|per month|a month|\$\d)/i;
const QUESTION = /\?/;

export class MockAnalyzer extends EventEmitter implements Analyzer {
  private active = new Set<SignalType>();
  private monologueSec = 0; // consecutive rep speech without a question

  async start(): Promise<void> {
    /* nothing to connect */
  }

  pushUtterance(_audio: Buffer, text: string, startSec: number, durationSec: number): void {
    const end = startSec + durationSec;
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    const fillerCount = (text.match(FILLERS) ?? []).length;
    const fillerRate = fillerCount / words;
    const wpm = (words / Math.max(durationSec, 1)) * 60;

    const fire = (signal_type: SignalType, probability: SignalEvent["probability"], rationale: string, delayMs = 900) =>
      setTimeout(() => {
        this.active.add(signal_type);
        this.emit("signal", { signal_type, start: startSec, probability, rationale, modality: ["audio"] });
      }, delayMs + Math.random() * 800);

    const endSignal = (signal_type: SignalType, delayMs = 1200) =>
      setTimeout(() => {
        if (this.active.delete(signal_type)) this.emit("signalEnded", signal_type, end);
      }, delayMs);

    // hesitation: filler-dense or very slow delivery, worse around pricing
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

    // stress: very fast delivery
    if (wpm > 210) fire("stress", "medium", "Rushed delivery well above conversational pace.");
    else endSignal("stress");

    // periodic feedback nudge, like realtime_feedback.generated
    if (this.monologueSec > 40) {
      setTimeout(() =>
        this.emit("feedback",
          `You've been talking for ${Math.round(this.monologueSec)}s without asking anything — hand the buyer the mic.`,
          startSec, end), 2000);
    } else if (PRICE.test(text) && fillerRate > 0.08) {
      setTimeout(() =>
        this.emit("feedback",
          "The price landed with hesitation — restate the number plainly and pause.",
          startSec, end), 2200);
    }
  }

  pushTranscript(_segments: TranscriptSegment[]): void {
    /* mock doesn't need it */
  }

  close(): void {
    this.removeAllListeners();
  }
}
