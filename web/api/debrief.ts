/**
 * POST /api/debrief — end-of-call coaching summary, fully stateless.
 * Transcript + audio-signal log + trajectory curve in → structured coaching JSON out.
 * Env: OPENAI_API_KEY
 */
import OpenAI from "openai";
import { resolvePersona } from "./_lib/resolvePersona.js";
import type { DebriefRequest, DebriefResponse } from "../src/contract.js";

const coachPrompt = (buyer: string) =>
  'You are a blunt, generous sales coach debriefing a practice pitch call. The trainee (role "rep") ' +
  `pitched ${buyer}, a realistic AI buyer. You receive the transcript, ` +
  "a log of audio-only delivery signals detected in the rep's voice (spans with start/end in seconds), " +
  "a call-trajectory curve (0-100, 60 is neutral), and the real-time nudges that were shown. " +
  "Ground every claim in that data. " +
  "Respond with ONLY a JSON object with these keys: " +
  "score (integer 0-100, honestly calibrated — 50 is a mediocre call), " +
  "headline (one direct sentence summing up the call), " +
  "moments (array of 2-3 {atSec, label, detail, tag}: the pivotal moments; atSec in seconds from the data; " +
  "label under 6 words; detail 1-2 plain sentences, quote the transcript where useful; " +
  'tag is ONE OF "objection handled" | "watch out" | "strong close" | "neutral" — whichever best ' +
  "characterizes that moment), " +
  "strengths (exactly 2 short strings), " +
  "improvements (2-3 short strings, concrete and behavioral), " +
  "drill (one specific exercise to run before the next call), " +
  "objectionsHandled ({handled, raised}: count how many distinct objections the buyer raised in the " +
  "transcript, and how many of those the rep addressed reasonably well), " +
  "skillScores ({discovery, listening, valueFraming, objectionHandling, closing}, each an integer 0-100 " +
  "judged strictly from what actually happened on this call — discovery: did the rep ask questions and " +
  "understand the buyer's situation before pitching; listening: did the rep respond to what the buyer " +
  "actually said rather than talking past them; valueFraming: was the pitch tied to the buyer's specific " +
  "pain/numbers; objectionHandling: how well pushback was addressed; closing: was there a concrete next step). " +
  "Plain text values only, no markdown.";

export async function POST(req: Request): Promise<Response> {
  let body: DebriefRequest;
  try {
    body = (await req.json()) as DebriefRequest;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  if (!body.history?.length) return new Response("empty call — nothing to debrief", { status: 400 });

  const persona = await resolvePersona(body.personaId);
  const openai = new OpenAI();
  const chat = await openai.chat.completions.create({
    model: process.env.BRAIN_MODEL ?? "gpt-4o",
    max_tokens: 700,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: coachPrompt(`${persona.name} (${persona.title} at ${persona.company})`) },
      {
        role: "user",
        content: JSON.stringify({
          transcript: body.history,
          delivery_signals: body.signalLog ?? [],
          // thin the 500ms samples — the shape matters, not every point
          trajectory_curve: (body.healthSamples ?? []).filter((_, i) => i % 4 === 0),
          nudges_shown: body.nudges ?? [],
        }),
      },
    ],
  });

  const raw = chat.choices[0]?.message?.content ?? "";
  try {
    const debrief = JSON.parse(raw) as DebriefResponse;
    return new Response(JSON.stringify(debrief), { headers: { "content-type": "application/json" } });
  } catch {
    return new Response(`coach returned unparseable JSON: ${raw.slice(0, 200)}`, { status: 502 });
  }
}
