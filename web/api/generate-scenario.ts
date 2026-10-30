/**
 * POST /api/generate-scenario — a sentence or two in, a full custom-scenario
 * draft out (pre-fills the create-scenario form; the user still reviews and
 * edits before POSTing /api/custom-personas to actually save it).
 * Env: OPENAI_API_KEY
 */
import OpenAI from "openai";
import { coerceCustomScenarioDraft } from "../src/personas.js";
import type { GenerateScenarioRequest, GenerateScenarioResponse } from "../src/contract.js";

const SYSTEM = `You turn a one- or two-sentence description into a structured buyer
persona for a roleplay sales-coaching tool. Given a free-text description of a buyer
and/or a product (either or both may be vague or missing), invent a specific, realistic,
named buyer and a specific product that fits what was described.

Respond with ONLY a JSON object with these keys — EVERY key is required, none may be
omitted or left empty, even if the input doesn't mention it (invent something plausible):
- name: a full person name
- title: their job title
- company: a plausible company name
- industry: short, e.g. "Healthcare", "B2B SaaS", "Manufacturing"
- icpNotes: REQUIRED, never empty — exactly 3 short lines separated by "\\n", in this order:
  (1) company size/type and their current pain point, (2) what tool/process they use today,
  (3) their budget ceiling and who has to approve above it. Written as the seller's private
  notes about the buyer, not addressed to them. Example: "60-person clinic group, still
  scheduling techs by phone tree.\\nRuns on a legacy Epic module + paper backup.\\n~$1.5k/mo
  is her call, more needs the practice board."
- product: the product being pitched, "Name — one-line description"; invent one if not specified
- sellingPoints: array of 2-3 short, punchy bullets
- price: a plausible price/pilot terms string
- difficulty: "easy" | "medium" | "hard" — how tough a sell this buyer should be
- personalityTags: array of 1-3 strings drawn ONLY from this fixed set: "Skeptical",
  "Friendly", "Budget-conscious", "Time-pressed", "Detail-oriented" — pick whichever fit
  the buyer you invented

Invent concrete, specific, plausible details for anything not specified. Keep it grounded
and realistic, not generic filler. Double-check every key above is present and non-empty
before responding.`;

export async function POST(req: Request): Promise<Response> {
  let body: GenerateScenarioRequest;
  try {
    body = (await req.json()) as GenerateScenarioRequest;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return new Response("missing prompt", { status: 400 });

  const openai = new OpenAI();
  const chat = await openai.chat.completions.create({
    model: process.env.BRAIN_MODEL ?? "gpt-4o",
    max_tokens: 500,
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt.slice(0, 500) },
    ],
  });

  const raw = chat.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("AI returned unparseable output — try again", { status: 502 });
  }

  const draft = coerceCustomScenarioDraft(parsed);
  return new Response(JSON.stringify({ draft } satisfies GenerateScenarioResponse), {
    headers: { "content-type": "application/json" },
  });
}
