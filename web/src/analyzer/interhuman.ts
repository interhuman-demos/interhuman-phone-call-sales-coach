/**
 * Direct browser → Interhuman realtime connection, authenticated with a
 * client token minted by /api/interhuman-token. This is the integration
 * pattern the Interhuman docs recommend: keys stay server-side, the
 * long-lived socket lives in the client.
 */
import type { TokenResponse, TranscriptSegment } from "../contract";
import type { Analyzer, AnalyzerCallbacks } from "./index";

const FEEDBACK_INSTRUCTIONS =
  "Goal: help the seller land a sales pitch. The analyzed speaker is the seller. " +
  "Flag hesitation or uncertainty in the seller's delivery (especially around pricing), " +
  "monologuing without engaging the buyer, and moments where the seller's trajectory " +
  "is drifting worse. One actionable line. Maximum 8 words. Imperative. No preamble.";

export class InterhumanAnalyzer implements Analyzer {
  private ws?: WebSocket;
  private ready = false;
  private queue: ArrayBuffer[] = [];

  constructor(private cb: AnalyzerCallbacks) {}

  async start(): Promise<void> {
    const res = await fetch("/api/interhuman-token", { method: "POST" });
    if (!res.ok) throw new Error(`token mint failed: ${await res.text()}`);
    const token = (await res.json()) as TokenResponse;

    // Auth via WebSocket subprotocol (browsers can't set Authorization headers).
    // Stream docs: "open wss://... via the 'access_token' WebSocket subprotocol".
    const ws = new WebSocket(token.url, ["access_token", token.access_token]);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      switch (msg.type) {
        case "session.ready":
          this.ready = true;
          // Per the realtime AsyncAPI schema, the session-config frame is the
          // raw RealtimeSessionConfigV1 object — no `type` discriminator
          // (unlike transcript.updated / session.close). Sending `type` gets
          // rejected with ih6001 and the socket closes with 1008.
          // Server acks with a `session.updated` event.
          ws.send(JSON.stringify({
            analysis_groups: ["audio"],
            realtime_feedback_frequency: "high",
            realtime_feedback_instructions: FEEDBACK_INSTRUCTIONS,
          }));
          for (const b of this.queue.splice(0)) ws.send(b);
          break;
        case "signal.detected":
        case "signal.updated":
          this.cb.onSignal(msg.data);
          break;
        case "signal.ended":
          this.cb.onSignalEnded(msg.data.signal_type, msg.data.end);
          break;
        case "realtime_feedback.generated":
          if (msg.data.text && msg.data.text !== "NO_GUIDANCE") this.cb.onFeedback(msg.data.text);
          break;
        case "error":
          this.cb.onError(msg.message ?? "analysis error");
          break;
      }
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Interhuman WS connection failed"));
    });
  }

  pushAudio(audio: ArrayBuffer): void {
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) this.ws.send(audio);
    else this.queue.push(audio);
  }

  pushText(_t: string, _s: number, _d: number, transcript: TranscriptSegment[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "transcript.updated", transcript }));
    }
  }

  close(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "session.close" }));
      const ws = this.ws;
      setTimeout(() => ws.close(), 10_000);
    }
  }
}
