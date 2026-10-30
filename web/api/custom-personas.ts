/**
 * GET  /api/custom-personas  → list of user-submitted scenarios (public fields)
 * POST /api/custom-personas  → create one, stored in Vercel Blob, visible to everyone
 * Env: BLOB_READ_WRITE_TOKEN
 */
import { buildCustomPersona, validateCustomScenarioInput } from "../src/personas.js";
import { appendCustomPersona, listCustomPersonas } from "./_lib/customStore.js";
import type { CustomScenarioRequest } from "../src/contract.js";

export async function GET(): Promise<Response> {
  const personas = await listCustomPersonas();
  const pub = personas.map(({ prompt: _p, voiceId: _v, ...rest }) => rest);
  return new Response(JSON.stringify({ personas: pub }), {
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: CustomScenarioRequest;
  try {
    body = (await req.json()) as CustomScenarioRequest;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  let clean: CustomScenarioRequest;
  try {
    clean = validateCustomScenarioInput(body);
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }

  const slug = clean.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "buyer";
  const id = `custom-${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const persona = buildCustomPersona(id, clean);
  await appendCustomPersona(persona);

  const { prompt: _p, voiceId: _v, ...pub } = persona;
  return new Response(JSON.stringify({ persona: pub }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
