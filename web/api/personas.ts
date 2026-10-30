/**
 * GET /api/personas — the full picker catalog (built-in + community custom
 * scenarios), public fields only. Used by both web and iOS pickers. Strips
 * `prompt` (server-side concern) and `voiceId` (ditto).
 */
import { PERSONAS } from "../src/personas.js";
import { listCustomPersonas } from "./_lib/customStore.js";

export async function GET(): Promise<Response> {
  const custom = await listCustomPersonas();
  const all = [...PERSONAS, ...custom];
  const publicPersonas = all.map(({ prompt: _p, voiceId: _v, ...pub }) => pub);
  return new Response(JSON.stringify({ personas: publicPersonas }), {
    headers: { "content-type": "application/json" }, // no cache — new customs should appear immediately
  });
}
