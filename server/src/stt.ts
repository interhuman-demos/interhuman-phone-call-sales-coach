import OpenAI, { toFile } from "openai";

let _openai: OpenAI | undefined;
const openai = () => (_openai ??= new OpenAI());

/** Transcribe one rep utterance (webm/opus buffer). */
export async function transcribe(audio: Buffer): Promise<string> {
  const file = await toFile(audio, "utterance.webm", { type: "audio/webm" });
  const res = await openai().audio.transcriptions.create({
    file,
    model: process.env.STT_MODEL ?? "whisper-1",
    language: "en",
  });
  return res.text.trim();
}
