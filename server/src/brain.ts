import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import OpenAI from "openai";

let _openai: OpenAI | undefined;
const openai = () => (_openai ??= new OpenAI());
const persona = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "personas", "buyer.md"),
  "utf8",
);

export interface Turn {
  role: "rep" | "buyer";
  text: string;
}

/** Generate the buyer's next spoken line. Pure roleplay — no signal input. */
export async function buyerReply(history: Turn[]): Promise<string> {
  const messages = [
    { role: "system" as const, content: persona },
    ...history.map((t) => ({
      role: t.role === "rep" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    })),
  ];
  const res = await openai().chat.completions.create({
    model: process.env.BRAIN_MODEL ?? "gpt-4o",
    messages,
    max_tokens: 150,
    temperature: 0.8,
  });
  return res.choices[0]?.message?.content?.trim() ?? "Sorry, say that again?";
}
