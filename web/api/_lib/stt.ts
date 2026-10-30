/** Shared Whisper transcription — used by /api/turn (final) and /api/transcribe (partial). */
import OpenAI, { toFile } from "openai";

export async function transcribe(openai: OpenAI, base64Webm: string): Promise<string> {
  const stt = await openai.audio.transcriptions.create({
    file: await toFile(Buffer.from(base64Webm, "base64"), "utterance.webm", { type: "audio/webm" }),
    model: process.env.STT_MODEL ?? "whisper-1",
    language: "en",
  });
  return stt.text.trim();
}
