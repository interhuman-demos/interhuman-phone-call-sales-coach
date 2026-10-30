/**
 * Standalone probe for the Interhuman realtime endpoint — no browser/mic needed.
 * Mints a client token directly (key from web/.env), opens the WS, sends the
 * schema-conformant session config (raw object, NO `type` field — see
 * docs/session-2026-07-09.md for the ih6001 bug), optionally pushes an audio
 * file, and logs every event.
 *
 *   node server/spike/probe-realtime-config.mjs [audio-file.webm]
 *
 * Success looks like: session.ready → session.updated (config accepted),
 * no `error` event, no 1008 close. With real speech audio you should also
 * see signal.* / transcript.generated events.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// key from web/.env
let apiKey = process.env.INTERHUMAN_API_KEY;
const envPath = resolve(root, "web/.env");
if (!apiKey && existsSync(envPath)) {
  const m = readFileSync(envPath, "utf8").match(/^INTERHUMAN_API_KEY=(.*)$/m);
  if (m) apiKey = m[1].trim().replace(/^["']|["']$/g, "");
}
if (!apiKey) { console.error("no INTERHUMAN_API_KEY"); process.exit(1); }

// 1. mint token (same call as web/api/interhuman-token.ts)
const mint = await fetch("https://api.interhuman.ai/v1/client_tokens", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ api_key: apiKey, expires_in: 900, max_duration_seconds: 900, max_concurrent: 1 }),
});
if (!mint.ok) { console.error("mint failed:", mint.status, await mint.text()); process.exit(1); }
const { access_token } = await mint.json();
console.log("[probe] token minted");

// 2. connect (auth via subprotocol, like the browser client)
const ws = new WebSocket("wss://api.interhuman.ai/v0/realtime/analyze", ["access_token", access_token]);
ws.binaryType = "arraybuffer";

let sawUpdated = false;
const audioFile = process.argv[2];

ws.onopen = () => console.log("[probe] ws open");
ws.onclose = (e) => {
  console.log(`[probe] ws closed code=${e.code} reason=${e.reason}`);
  process.exit(sawUpdated && e.code !== 1008 ? 0 : 1);
};
ws.onerror = () => console.error("[probe] ws error");

ws.onmessage = (e) => {
  if (typeof e.data !== "string") return;
  const msg = JSON.parse(e.data);
  console.log("[event]", msg.type, JSON.stringify(msg.data ?? msg.message ?? "").slice(0, 200));
  if (msg.type === "session.ready") {
    // THE FIX: raw RealtimeSessionConfigV1 — no `type` discriminator.
    ws.send(JSON.stringify({
      analysis_groups: ["audio"],
      realtime_feedback_frequency: "high",
      realtime_feedback_instructions:
        "Goal: help the seller land a sales pitch. Flag hesitation, monologuing, drift. One short line.",
    }));
    console.log("[probe] sent session config (raw, no type field)");
  }
  if (msg.type === "session.updated") {
    sawUpdated = true;
    console.log("[probe] ✅ config ACCEPTED (session.updated)");
    if (audioFile) {
      const buf = readFileSync(audioFile);
      ws.send(buf);
      console.log(`[probe] pushed ${buf.length} bytes of audio from ${audioFile}`);
    }
  }
  if (msg.type === "error") console.log("[probe] ❌ server error event");
};

// listen for a while, then close gracefully
setTimeout(() => {
  console.log("[probe] timeout — closing");
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "session.close" }));
  setTimeout(() => ws.close(), 5000);
}, 30_000);
