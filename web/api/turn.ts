/**
 * POST /api/turn — one conversation turn, fully stateless.
 * base64 webm utterance + history (+ personaId) in → rep transcript + the
 * buyer's signal-aware reply + mp3 out. `kickoff: true` skips STT entirely
 * and asks the buyer to open the call instead (no rep utterance yet).
 * Env: OPENAI_API_KEY, ELEVENLABS_API_KEY (ELEVENLABS_VOICE_ID = voice fallback)
 */
import OpenAI from "openai";
import { resolvePersona } from "./_lib/resolvePersona.js";
import { transcribe } from "./_lib/stt.js";
import type { TurnRequest, TurnResponse } from "../src/contract.js";

export async function POST(req: Request): Promise<Response> {
  let body: TurnRequest;
  try {
    body = (await req.json()) as TurnRequest;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  if (!body.kickoff && !body.audio) return new Response("missing audio", { status: 400 });

  const openai = new OpenAI();

  // 1. STT (skipped entirely for the buyer's opening line)
  const repText = body.kickoff ? "" : await transcribe(openai, body.audio);
  if (!body.kickoff && !repText) return json({ repText: "", buyerText: "", audio: "" });

  // 2. The buyer's reply — shaped by the live voice analysis when present
  const persona = await resolvePersona(body.personaId);
  const firstName = persona.name.replace(/^Dr\. /, "").split(" ")[0];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: persona.prompt },
    ...(body.history ?? []).map((t) => ({
      role: t.role === "rep" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    })),
  ];
  if (body.kickoff) {
    messages.push({
      role: "system",
      content:
        `The call just connected. Answer the phone as ${firstName} and open the conversation — ` +
        `a short, natural, in-character greeting (one line, e.g. how you'd actually pick up a call ` +
        `you were expecting). Do not wait for the seller to speak first.`,
    });
  }
  if (body.signals?.active?.length) {
    const cues = body.signals.active
      .map((s) => s.probability ? `${s.signal_type} (${s.probability})` : s.signal_type)
      .join(", ");
    const trendWord = body.signals.trend === "down" ? "falling" : body.signals.trend === "up" ? "improving" : "steady";
    messages.push({
      role: "system",
      content:
        `AUDIO READ (invisible to the seller): their next utterance was DELIVERED sounding ${cues}. ` +
        `Call trajectory ${body.signals.health}/100, ${trendWord}` +
        `${body.signals.health < 45 ? " — this call is going badly" : ""}. ` +
        `${firstName} HEARS this in their voice, and their reply MUST visibly reflect it — an experienced buyer ` +
        `never responds warmly to a badly delivered pitch. Map what you heard to behavior: ` +
        `hesitation/uncertainty → distrust what was just said and probe it ("you don't sound too sure about that"); ` +
        `stress or rushing → pull back, get guarded, maybe name it ("you okay? you're going a mile a minute"); ` +
        `frustration → go cool and clipped, protect your time; confusion → make them land the point; ` +
        `confidence/engagement → open up and give more. ` +
        `Stay in character as ${firstName}; never mention analysis, signals, or scores.`,
    });
  }
  if (!body.kickoff) messages.push({ role: "user", content: repText });

  const chat = await openai.chat.completions.create({
    model: process.env.BRAIN_MODEL ?? "gpt-4o",
    max_tokens: 150,
    temperature: 0.8,
    messages,
  });
  const buyerText = chat.choices[0]?.message?.content?.trim() ?? "Sorry, say that again?";

  // 3. Voice
  const tts = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${persona.voiceId || process.env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({
        text: buyerText,
        model_id: process.env.ELEVENLABS_MODEL ?? "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    },
  );
  if (!tts.ok) return new Response(`tts failed: ${await tts.text()}`, { status: 502 });
  const mp3 = Buffer.from(await tts.arrayBuffer()).toString("base64");

  return json({ repText, buyerText, audio: mp3 });
}

const json = (data: TurnResponse) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
