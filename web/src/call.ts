import type { SignalType } from "./contract";

export const POSITIVE: SignalType[] = ["engagement", "interest", "confidence", "agreement"];

export interface Line { speaker: "rep" | "buyer"; text: string }
