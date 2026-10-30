/**
 * The full client contract — single source of truth for web AND iOS.
 *
 * Two channels:
 *  1. HTTP to our Vercel functions:
 *     POST /api/interhuman-token  → TokenResponse   (mint client token server-side)
 *     POST /api/turn              → TurnRequest/TurnResponse (STT → buyer reply → TTS)
 *  2. Direct WebSocket to Interhuman realtime (browser/iOS → api.interhuman.ai),
 *     authenticated with the minted client token. Signal/feedback events below.
 */

// ---- signals (mirrors Interhuman AsyncAPI shapes) ----

export type SignalType =
  | "agreement" | "confidence" | "confusion" | "disagreement"
  | "disengagement" | "engagement" | "frustration" | "hesitation"
  | "interest" | "skepticism" | "stress" | "uncertainty";

export type Probability = "low" | "medium" | "high";

export interface SignalEvent {
  signal_type: SignalType;
  start: number;               // session-cumulative seconds
  probability?: Probability;
  rationale?: string;
  modality?: string[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: number;             // 0 = rep, 1 = buyer
}

// ---- /api/turn ----

export interface Turn {
  role: "rep" | "buyer";
  text: string;
}

/** What the analysis currently hears — sent with each turn so the buyer reacts to delivery, not just words. */
export interface SignalsSnapshot {
  active: { signal_type: SignalType; probability?: Probability }[];
  health: number;              // call-trajectory score 0..100
  trend: "up" | "flat" | "down";
}

export interface TurnRequest {
  audio: string;               // base64 audio/webm;codecs=opus (one rep utterance) — ignored when kickoff is true
  history: Turn[];             // conversation so far (client-held state)
  signals?: SignalsSnapshot;   // live read on the rep's delivery at time of send
  personaId?: string;          // which buyer (web/src/personas.ts); defaults to dana
  kickoff?: boolean;           // true for the buyer's opening line — no audio, no STT
}

export interface TurnResponse {
  repText: string;             // "" if nothing was transcribed
  buyerText: string;
  audio: string;               // base64 audio/mpeg of the buyer's reply
}

// ---- /api/debrief ----

/** One signal occurrence over wall-clock call time (seconds since call start). */
export interface SignalSpan {
  signal_type: SignalType;
  probability?: Probability;
  positive: boolean;
  startSec: number;
  endSec?: number;             // undefined = still active when logged
}

export interface HealthSample {
  t: number;                   // seconds since call start
  score: number;               // trajectory 0..100
}

export interface DebriefRequest {
  history: Turn[];
  signalLog: SignalSpan[];
  healthSamples: HealthSample[];
  nudges: string[];            // real-time coaching lines that were shown
  personaId?: string;          // which buyer was pitched; defaults to dana
  transcript: TranscriptSegment[]; // timed segments — lets the client compute talk ratio & pace itself
}

export type MomentTag = "objection handled" | "watch out" | "strong close" | "neutral";

export interface DebriefMoment {
  atSec: number;
  label: string;               // under 6 words
  detail: string;              // 1-2 sentences
  tag: MomentTag;
}

export interface SkillScores {
  discovery: number;           // 0..100 each
  listening: number;
  valueFraming: number;
  objectionHandling: number;
  closing: number;
}

export interface DebriefResponse {
  score: number;               // 0..100, honestly calibrated
  headline: string;
  moments: DebriefMoment[];
  strengths: string[];
  improvements: string[];
  drill: string;               // one exercise for the next call
  objectionsHandled: { handled: number; raised: number };
  skillScores: SkillScores;
}

// ---- /api/custom-personas ----

export interface CustomScenarioRequest {
  name: string;
  title: string;
  company: string;
  industry: string;
  icpNotes: string;            // free text: pain points, current stack/process, budget & who approves
  product: string;             // "Name — one-line description"
  sellingPoints: string[];     // 2-3 short bullets
  price: string;
  difficulty: "easy" | "medium" | "hard";
  personalityTags: string[];   // e.g. ["Skeptical", "Time-pressed"] — shapes the buyer's prompt
}

// ---- /api/generate-scenario ----

export interface GenerateScenarioRequest {
  prompt: string;               // a sentence or two describing the buyer and/or product
}

export interface GenerateScenarioResponse {
  draft: CustomScenarioRequest; // pre-fills the create-scenario form; user still reviews before saving
}

// ---- /api/interhuman-token ----

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  url: string;                 // wss endpoint to connect to
}
