/**
 * POST /api/transcribe — STT only, no buyer reply.
 * Used while the rep is still holding the talk button: transcribes the
 * growing utterance-so-far every few seconds so signals can update live
 * instead of waiting for release. Env: OPENAI_API_KEY
 */
import OpenAI from "openai";
import { transcribe } from "./_lib/stt.js";

interface TranscribeRequest { audio: string }
interface TranscribeResponse { text: string }

export async function POST(req: Request): Promise<Response> {
  let body: TranscribeRequest;
  try {
    body = (await req.json()) as TranscribeRequest;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  if (!body.audio) return new Response("missing audio", { status: 400 });

  const text = await transcribe(new OpenAI(), body.audio);
  return new Response(JSON.stringify({ text } satisfies TranscribeResponse), {
    headers: { "content-type": "application/json" },
  });
}
