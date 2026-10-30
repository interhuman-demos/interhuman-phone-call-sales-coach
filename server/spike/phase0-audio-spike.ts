/**
 * Phase 0 spike — answer the go/no-go question before building anything:
 * do audio-only signals fire reliably and usefully on real speech?
 *
 * Usage:
 *   1. Record a ~2 min "pitch" with planted moments (hesitate after pricing,
 *      ramble in the middle, recover at the end). Any format ffmpeg reads.
 *   2. ffmpeg -i pitch.m4a -c:a libopus -f webm pitch.webm
 *   3. cd server && npm i && cp .env.example .env  (fill INTERHUMAN_API_KEY)
 *   4. npm run spike -- ../pitch.webm
 *
 * Streams the file in 4s-paced chunks (simulating live mic) and logs every
 * event with wall-clock latency. Review the log for:
 *   - did hesitation/uncertainty fire where you planted them?
 *   - detection lag (event wall time vs. media time of the moment)
 *   - is `rationale` quotable audio evidence, or video-flavored boilerplate?
 *   - realtime_feedback quality with the sales instructions below
 */
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import "dotenv/config";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run spike -- <pitch.webm>");
  process.exit(1);
}

const url = process.env.INTERHUMAN_REALTIME_URL ?? "wss://api.interhuman.ai/v0/realtime/analyze";
const apiKey = process.env.INTERHUMAN_API_KEY;
if (!apiKey) throw new Error("INTERHUMAN_API_KEY not set");

const CHUNK_SECONDS = 4;
const media = readFileSync(file);
// Rough byte pacing: send the file in N slices, one per CHUNK_SECONDS.
// (Opus/webm slices aren't clean container segments, but the endpoint accepts
// segmented binary; if it rejects mid-file slices, switch to pre-segmenting
// with: ffmpeg -i pitch.webm -f segment -segment_time 4 -c copy seg_%03d.webm)
const SLICES = 30;
const sliceSize = Math.ceil(media.length / SLICES);

const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

const ws = new WebSocket(url, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

ws.on("open", () => {
  console.log(ts(), "connected");
  ws.send(JSON.stringify({
    type: "session.config",
    analysis_groups: ["audio"],
    realtime_feedback_frequency: "high",
    realtime_feedback_instructions:
      "Goal: help the seller close a sales call. The analyzed speaker is the seller pitching a buyer. Flag hesitation or uncertainty in the seller's own delivery, especially around pricing. Keep guidance concise and specific.",
  }));

  let i = 0;
  const timer = setInterval(() => {
    if (i >= SLICES) {
      clearInterval(timer);
      console.log(ts(), "all media sent → session.close");
      ws.send(JSON.stringify({ type: "session.close" }));
      return;
    }
    ws.send(media.subarray(i * sliceSize, (i + 1) * sliceSize));
    console.log(ts(), `sent slice ${++i}/${SLICES}`);
  }, CHUNK_SECONDS * 1000);
});

ws.on("message", (raw, isBinary) => {
  if (isBinary) return;
  const msg = JSON.parse(raw.toString());
  switch (msg.type) {
    case "signal.detected":
    case "signal.updated":
    case "signal.ended":
      console.log(ts(), `🔔 ${msg.type}`, JSON.stringify(msg.data));
      break;
    case "realtime_feedback.generated":
      console.log(ts(), `🧭 feedback [${msg.data.start}-${msg.data.end}s]:`, msg.data.text);
      break;
    case "transcript.generated":
      console.log(ts(), `📝 transcript:`, JSON.stringify(msg.data));
      break;
    case "session.ended":
      console.log(ts(), "session ended");
      ws.close();
      break;
    case "error":
      console.error(ts(), "❌ error:", JSON.stringify(msg));
      break;
    default:
      console.log(ts(), msg.type, JSON.stringify(msg.data ?? {}));
  }
});

ws.on("close", (code, reason) => console.log(ts(), "closed", code, reason.toString()));
ws.on("error", (err) => console.error(ts(), "ws error", err));
