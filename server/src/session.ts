/** Per-call orchestrator: mic utterances in → buyer voice + analysis events out. */
import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.js";
import { InterhumanClient, type Analyzer, type TranscriptSegment } from "./interhuman.js";
import { MockAnalyzer } from "./mock.js";
import { HealthEngine } from "./health.js";
import { transcribe } from "./stt.js";
import { buyerReply, type Turn } from "./brain.js";
import { speak } from "./tts.js";

export class Session {
  private analyzer: Analyzer;
  private health = new HealthEngine();
  private history: Turn[] = [];
  private transcript: TranscriptSegment[] = [];
  private clockSec = 0;            // session-cumulative media time
  private pendingUtterance?: { durationMs: number };
  private decayTimer?: NodeJS.Timeout;
  private busy = false;

  constructor(private client: WebSocket) {
    const mock = (process.env.MOCK_SIGNALS ?? "true").toLowerCase() !== "false";
    this.analyzer = mock ? new MockAnalyzer() : new InterhumanClient();

    this.analyzer.on("signal", (signal) => {
      this.send({ type: "signal.detected", signal });
      for (const m of this.health.onSignal(signal, Date.now())) this.send(m);
    });
    this.analyzer.on("signalEnded", (signal_type, end) =>
      this.send({ type: "signal.ended", signal_type, end }));
    this.analyzer.on("feedback", (text) =>
      this.send({ type: "nudge", severity: "info", text }));

    client.on("message", (raw, isBinary) => {
      if (isBinary) void this.onUtteranceAudio(raw as Buffer);
      else void this.onText(raw.toString());
    });
    client.on("close", () => this.destroy());
  }

  private async onText(raw: string): Promise<void> {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "session.start": {
        try {
          await this.analyzer.start();
        } catch (err) {
          this.send({ type: "error", message: `analyzer: ${(err as Error).message}` });
          return;
        }
        this.decayTimer = setInterval(() => {
          for (const m of this.health.decay(Date.now())) this.send(m);
        }, 5000);
        this.send({ type: "session.ready", mock: this.analyzer instanceof MockAnalyzer });
        break;
      }
      case "utterance":
        this.pendingUtterance = { durationMs: msg.durationMs };
        break;
      case "session.end":
        this.destroy();
        break;
    }
  }

  private async onUtteranceAudio(audio: Buffer): Promise<void> {
    if (this.busy) return; // ignore overlapping sends; push-to-talk makes this rare
    this.busy = true;
    try {
      const durationSec = (this.pendingUtterance?.durationMs ?? 4000) / 1000;
      this.pendingUtterance = undefined;
      const start = this.clockSec;
      this.clockSec += durationSec;

      // 1. transcribe
      const text = await transcribe(audio);
      if (!text) return;
      this.send({ type: "transcript.line", speaker: "rep", text });
      this.send({ type: "buyer.thinking" });
      this.history.push({ role: "rep", text });
      this.transcript.push({ start, end: start + durationSec, text, speaker: 0 });

      // 2. analysis (parallel to the reply — never blocks the conversation)
      this.analyzer.pushUtterance(audio, text, start, durationSec);
      this.analyzer.pushTranscript(this.transcript);

      // 3. buyer reply → voice
      const reply = await buyerReply(this.history);
      this.history.push({ role: "buyer", text: reply });
      // buyer line goes into the shared transcript with an estimated duration
      const est = Math.max(1.5, reply.split(/\s+/).length / 2.5);
      this.transcript.push({ start: this.clockSec, end: this.clockSec + est, text: reply, speaker: 1 });
      this.clockSec += est;

      this.send({ type: "transcript.line", speaker: "buyer", text: reply });
      const mp3 = await speak(reply);
      if (this.client.readyState === this.client.OPEN) this.client.send(mp3);
    } catch (err) {
      this.send({ type: "error", message: (err as Error).message });
    } finally {
      this.busy = false;
    }
  }

  private send(msg: ServerMessage): void {
    if (this.client.readyState === this.client.OPEN) this.client.send(JSON.stringify(msg));
  }

  private destroy(): void {
    clearInterval(this.decayTimer);
    this.analyzer.close();
  }
}
