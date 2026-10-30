/**
 * POST /api/interhuman-token — mint a short-lived, capped client token
 * server-side, hand it to the browser/iOS for a DIRECT connection to the
 * Interhuman realtime endpoint.
 *
 * NOTE: we pass no `scopes` (defaults apply — 'interhumanai.stream').
 * Verified: the default scope does open /v0/realtime/analyze (WS connects,
 * session.ready received) — confirmed 2026-07-09 against a live token.
 *
 * Env: INTERHUMAN_API_KEY, optional INTERHUMAN_REALTIME_URL, ALLOWED_ORIGIN
 */
import type { TokenResponse } from "../src/contract.js";

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.INTERHUMAN_API_KEY;
  if (!apiKey) return new Response("INTERHUMAN_API_KEY not configured", { status: 500 });

  const mint = await fetch("https://api.interhuman.ai/v1/client_tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      // no scopes → server default
      expires_in: 900,               // one demo call
      max_duration_seconds: 900,
      max_concurrent: 1,
      ...(process.env.ALLOWED_ORIGIN
        ? { allowed_origins: [process.env.ALLOWED_ORIGIN] }
        : {}),
    }),
  });
  if (!mint.ok) return new Response(`mint failed: ${await mint.text()}`, { status: 502 });

  const data = (await mint.json()) as { access_token: string; expires_in: number };
  const out: TokenResponse = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    url: process.env.INTERHUMAN_REALTIME_URL ?? "wss://api.interhuman.ai/v0/realtime/analyze",
  };
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
}
