/**
 * Analyzer interface — one shape, two implementations:
 *  - InterhumanAnalyzer: direct browser WS to the realtime endpoint (client token)
 *  - MockAnalyzer: transcript heuristics, no model needed
 * The app and UI never know which one is running.
 */
import type { SignalEvent, SignalType, TranscriptSegment } from "../contract";
import { InterhumanAnalyzer } from "./interhuman";
import { MockAnalyzer } from "./mock";

export interface AnalyzerCallbacks {
  onSignal(s: SignalEvent): void;
  onSignalEnded(signal_type: SignalType, end: number): void;
  onFeedback(text: string): void;
  onError(message: string): void;
}

export interface Analyzer {
  start(): Promise<void>;
  /** Raw utterance audio — real analyzer streams it; mock ignores it. */
  pushAudio(audio: ArrayBuffer, startSec: number, durationSec: number): void;
  /** Post-STT text — mock reacts to it; real analyzer sends transcript context. */
  pushText(text: string, startSec: number, durationSec: number, transcript: TranscriptSegment[]): void;
  close(): void;
}

export function createAnalyzer(real: boolean, cb: AnalyzerCallbacks): Analyzer {
  return real ? new InterhumanAnalyzer(cb) : new MockAnalyzer(cb);
}
