/**
 * Realtime analysis source. Two implementations behind one interface:
 *  - InterhumanClient: real wss://api.interhuman.ai/v0/realtime/analyze
 *  - MockAnalyzer (mock.ts): heuristic events from STT output
 * Both emit the same shapes, so session/UI code never knows the difference.
 */
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { SignalEvent, SignalType } from "../../shared/protocol.js";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: number; // 0 = rep, 1 = buyer
}

export interface AnalyzerEvents {
  signal: (s: SignalEvent) => void;
  signalEnded: (signal_type: SignalType, end: number) => void;
  feedback: (text: string, start: number, end: number) => void;
}

export interface Analyzer extends EventEmitter {
  start(): Promise<void>;
  /** Rep utterance audio + its transcript info (mock uses text/duration; real uses bytes). */
  pushUtterance(audio: Buffer, text: string, startSec: number, durationSec: number): void;
  pushTranscript(segments: TranscriptSegment[]): void;
  close(): void;
}

const FEEDBACK_INSTRUCTIONS =
  "Goal: help the seller land a sales pitch. The analyzed speaker is the seller. " +
  "Flag hesitation or uncertainty in the seller's delivery (especially around pricing), " +
  "monologuing without engaging the buyer, and moments where the seller's trajectory " +
  "is drifting worse. One short, specific, actionable line.";

export class InterhumanClient extends EventEmitter implements Analyzer {
  private ws?: WebSocket;
  private ready = false;
  private queue: Buffer[] = [];

  async start(): Promise<void> {
    const url = process.env.INTERHUMAN_REALTIME_URL ?? "wss://api.interhuman.ai/v0/realtime/analyze";
    const key = process.env.INTERHUMAN_API_KEY;
    if (!key) throw new Error("INTERHUMAN_API_KEY not set (or run MOCK_SIGNALS=true)");

    this.ws = new WebSocket(url, { headers: { Authorization: `Bearer ${key}` } });

    this.ws.on("message", (raw, isBinary) => {
      if (isBinary) return;
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      switch (msg.type) {
        case "session.ready":
          this.ready = true;
          this.ws!.send(JSON.stringify({
            type: "session.config",
            analysis_groups: ["audio"],
            realtime_feedback_frequency: "high",
            realtime_feedback_instructions: FEEDBACK_INSTRUCTIONS,
          }));
          for (const b of this.queue.splice(0)) this.ws!.send(b);
          break;
        case "signal.detected":
        case "signal.updated":
          this.emit("signal", msg.data as SignalEvent);
          break;
        case "signal.ended":
          this.emit("signalEnded", msg.data.signal_type as SignalType, msg.data.end as number);
          break;
        case "realtime_feedback.generated":
          if (msg.data.text && msg.data.text !== "NO_GUIDANCE") {
            this.emit("feedback", msg.data.text, msg.data.start, msg.data.end);
          }
          break;
        case "error":
          console.error("[interhuman] error envelope:", JSON.stringify(msg));
          break;
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.ws!.once("open", () => resolve());
      this.ws!.once("error", reject);
    });
  }

  pushUtterance(audio: Buffer): void {
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) this.ws.send(audio);
    else this.queue.push(audio);
  }

  pushTranscript(segments: TranscriptSegment[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "transcript.updated", transcript: segments }));
    }
  }

  close(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "session.close" }));
      // let the drain finish; hard-close as a backstop
      setTimeout(() => this.ws?.close(), 10_000).unref();
    }
  }
}
