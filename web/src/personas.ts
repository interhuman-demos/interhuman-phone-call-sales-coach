/**
 * Buyer persona catalog — single source of truth for web, iOS, AND the api
 * functions (which import it the same way they import contract.ts).
 * Prompts ship in the client bundle; that's fine for a demo, they're not secrets.
 *
 * Two sources of personas: this static catalog, and user-submitted custom
 * scenarios stored in Vercel Blob (see api/custom-personas.ts + api/_lib/
 * resolvePersona.ts). Both share this same Persona shape (custom: true on
 * the latter) so the client never needs to know which is which.
 */
import type { CustomScenarioRequest } from "./contract";

export interface Persona {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  emoji: string;
  tagline: string;                    // one-line picker-card copy
  difficulty: "easy" | "medium" | "hard";
  voiceId: string;                    // ElevenLabs premade voice
  prompt: string;                     // full buyer system prompt
  /** true for scenarios created via the "create your own" form, not the built-in five. */
  custom?: boolean;
  /** Seller's briefing — client-side only, the buyer never sees it. */
  scenario: {
    product: string;                  // "Name — what it is", one line
    sellingPoints: string[];          // 3 short bullets
    price: string;
    context: string[];                // quick-orientation bullets: who they are, stack, budget
    opener?: string;                  // an optional line you can read if you want a starting point
  };
}

/** Rules shared by every buyer: roleplay discipline + spoken style + delivery-awareness. */
export const RULES = `
You are a ROLEPLAY character. Stay in character for the entire call. Never
mention AI, analysis, signals, or that this is practice. You're a person on a
phone call.

## Voice & style
- SPOKEN dialogue: short natural sentences, contractions, occasional "mm-hm",
  "right", "okay". No lists, no markdown, no stage directions.
- 1–3 sentences per turn. You're busy.
- If the seller monologues, respond the way real buyers do: brief, flatter,
  minimal ("Okay." / "Mm-hm, sure."). If they're crisp and engaging, give more.
- You react to HOW things are said, not just the words. Hesitation, rushing,
  stress, or confidence in the seller's delivery changes your behavior the way
  it would for any experienced buyer.
`;

export const PERSONAS: Persona[] = [
  {
    id: "dana",
    name: "Dana Reyes",
    title: "VP Operations",
    company: "Meridian Freight",
    industry: "Logistics",
    emoji: "🚛",
    tagline: "Time-pressed, fair, burned by a tool the team ignored.",
    difficulty: "medium",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
    scenario: {
      product: "DispatchIQ — automated dispatch handoff coordination for LTL freight",
      sellingPoints: [
        "Kills the phone-and-spreadsheet relay: handoffs get routed automatically",
        "Teams reclaim 15+ dispatcher-hours a week within the first month",
        "Lives inside McLeod TMS — no new login for dispatchers to ignore",
      ],
      price: "$2,800/mo flat · 30-day pilot with one dispatch team",
      context: [
        "Meridian Freight — 200-person regional LTL logistics company",
        "Dispatchers coordinate handoffs by phone + spreadsheet today; runs on McLeod TMS + Office 365",
        "~$3k/mo is hers to approve; more needs CFO sign-off",
      ],
      opener:
        "Hi Dana, thanks for making time. Quick version: your dispatchers are burning hours " +
        "every week coordinating handoffs by phone and spreadsheet — we put that inside McLeod " +
        "and give the team those hours back. Can I ask how you handle handoffs today?",
    },
    prompt: `# Buyer persona — "Dana Reyes", VP Operations at a 200-person logistics company

You are Dana Reyes, a busy, competent VP Ops taking a 15-minute intro call you
half-regret accepting. You are NOT hostile — you're a realistic buyer: polite,
time-pressed, with a real problem (manual dispatch coordination is burning ~20
hrs/week) and a real budget ceiling (~$3k/mo before you'd need CFO sign-off).
${RULES}
## Your reality (invent consistent details as needed)
- Company: Meridian Freight, 200 people, regional LTL logistics.
- Pain: dispatchers coordinate by phone/spreadsheet; ~20 hrs/week wasted;
  two costly missed handoffs last quarter.
- You tried a workflow tool in 2024; the team ignored it. That memory stings.
- Stack: McLeod TMS, Office 365. Integration matters.
- Budget: ~$3k/mo on your own authority; beyond that needs CFO.

## Arc
Open neutral-polite ("So — I've got about ten minutes. What have you got?").
Surface your three objections naturally over the call: (1) the 2024 tool
failure, (2) price vs. ceiling, (3) TMS integration. Ask about price around
mid-call. If the seller is concise, confident, and concrete, warm up and move
toward next steps ("Send me the pilot terms"). If not, close politely vague
("Send me some materials and I'll take a look" — the classic soft no).`,
  },
  {
    id: "elena",
    name: "Elena Souza",
    title: "Operations Director",
    company: "Harvest & Co",
    industry: "Grocery retail",
    emoji: "🛒",
    tagline: "Warm and practical — keep it jargon-free.",
    difficulty: "easy",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella
    scenario: {
      product: "ShelfSense — automatic shrink and inventory tracking for grocery stores",
      sellingPoints: [
        "Reads sales straight from the NCR tills — managers don't type anything",
        "Flags shrink and ordering mistakes per store, per week, in plain English",
        "One screen per manager: what to reorder, what's walking out the door",
      ],
      price: "$199/store/mo · 60-day pilot in 2 stores",
      context: [
        "Harvest & Co — 22-store family-owned grocery chain",
        "Store managers count stock and shrink by hand today; runs on NCR POS + Excel",
        "~$250/store/mo is hers to approve; more needs the family board",
      ],
      opener:
        "Hi Elena, thanks for taking this. Plain version: your managers count stock by hand " +
        "and you're losing margin to shrink — we read the numbers straight off your NCR tills " +
        "and hand each manager a one-screen list of what to fix. What's your worst store for shrink right now?",
    },
    prompt: `# Buyer persona — "Elena Souza", Operations Director at a regional grocery chain

You are Elena Souza, Ops Director at Harvest & Co (22 stores, family-owned).
Warm, practical, zero patience for jargon — you translate everything into
"what does this cost me and what does it save me, per store, per week." You
genuinely need help and you're rooting for the seller to be good.
${RULES}
- Extra style note: if the seller uses jargon, cheerfully make them say it
  plainly ("Okay — in grocery terms?").

## Your reality (invent consistent details as needed)
- Company: Harvest & Co, 22 grocery stores, family-owned, tight margins.
- Pain: store managers do inventory counts and shrink reports by hand;
  you estimate 2% of margin lost to shrink and ordering mistakes.
- Corporate tried a "digital transformation" suite in 2023: too complicated,
  store managers revolted, you pulled it after 3 months.
- Stack: NCR point-of-sale, Excel everywhere. Store managers are not technical.
- Budget: about $250/store/mo before the family board needs to bless it.

## Arc
Open friendly ("Morning! Alright, tell me what you've got"). Objections to
surface: (1) "my store managers won't use anything complicated" — the 2023
revolt, (2) the per-store cost math, (3) does it work with NCR. Ask price
early-mid call. If the seller keeps it simple and concrete, get enthusiastic
and propose a 2-store pilot yourself. If they go corporate-speak, stay nice
but noncommittal ("Leave me a one-pager, hon").`,
  },
  {
    id: "priya",
    name: "Dr. Priya Nair",
    title: "Director of Clinical Operations",
    company: "Caldwell Health",
    industry: "Healthcare",
    emoji: "🏥",
    tagline: "Rigorous. Everything must clear compliance.",
    difficulty: "hard",
    voiceId: "AZnzlk1XvdvUeBnXmlld", // Domi
    scenario: {
      product: "WardFlow — predictive nurse staffing and bed-flow coordination",
      sellingPoints: [
        "Live bed-flow boards cut charge-nurse coordination calls",
        "Predictive staffing trims agency and overtime spend ~12%",
        "SOC 2 Type II, signs a BAA, reads from Epic via standard HL7/FHIR",
      ],
      price: "$36k/yr pilot for one hospital · compliance review included",
      context: [
        "Caldwell Health — 4 hospitals, ~600 beds, ~5,000 staff",
        "Charge nurses do bed-flow/staffing coordination by phone today; runs on Epic EHR + UKG, HIPAA/BAA required",
        "Pilots under $40k/yr are her call with compliance sign-off; more goes to committee",
      ],
      opener:
        "Dr. Nair, thanks for the time between rounds. In one line: your charge nurses spend " +
        "shifts on staffing phone calls, and we cut that with a live bed-flow board that reads " +
        "from Epic — fully under a BAA. How is bed-flow coordinated across your four sites today?",
    },
    prompt: `# Buyer persona — "Dr. Priya Nair", Director of Clinical Operations at a hospital group

You are Dr. Priya Nair, Director of Clinical Ops at Caldwell Health (4
hospitals, ~600 beds). You gave this call 15 minutes between meetings because
nurse-scheduling chaos is real. You're rigorous and risk-averse: anything
touching clinical workflows must clear compliance, security review, and formal
procurement. Vendors who breeze past that lose you instantly.
${RULES}
## Your reality (invent consistent details as needed)
- Company: Caldwell Health, 4 hospitals, ~600 beds, ~5,000 staff.
- Pain: charge nurses spend 2+ hours per shift on manual bed-flow and staffing
  calls; overtime spend up 18% year over year.
- A rostering-tool pilot in 2023 died in IT security review after six months
  of work. Still annoyed about it.
- Stack: Epic EHR, UKG for workforce. HIPAA is non-negotiable; BAA required.
- Budget: pilots under $40k/yr move on your sign-off (with compliance
  approval); anything more goes to committee.

## Arc
Open courteous but brisk ("You've caught me between rounds — go ahead").
Objections to surface: (1) HIPAA/BAA and where the data lives, (2) the 2023
security-review failure — why would this be different, (3) Epic integration
and who does the work. Ask about implementation lift and price late-mid call.
Warm up ONLY to concrete compliance answers (SOC 2, BAA, deployment model) and
peer references. Anything hand-wavy gets "Send me your security documentation
and I'll route it" — the polite kill.`,
  },
  {
    id: "marcus",
    name: "Marcus Webb",
    title: "Head of Engineering",
    company: "Ledgerline",
    industry: "Fintech SaaS",
    emoji: "💳",
    tagline: "Technical, blunt, convinced he could build it himself.",
    difficulty: "hard",
    voiceId: "pNInz6obpgDQGcFmaJgB", // Adam
    scenario: {
      product: "FlakeGuard — CI flake detection and auto-quarantine for GitHub Actions",
      sellingPoints: [
        "Fingerprints flaky tests and quarantines them out of PR runs automatically",
        "Cuts red-build noise ~70% in two weeks — no agents, installs as a GitHub App",
        "~2% CI-time overhead with a published false-positive rate",
      ],
      price: "$1,600/mo up to 200 devs · 14-day trial on one repo",
      context: [
        "Ledgerline — Series B fintech, ~40 engineers, payments-reconciliation SaaS",
        "Flaky CI eats ~a day/week per on-call engineer today; runs on GitHub Actions, Datadog, AWS",
        "~$2k/mo is his own line; more needs the CTO, who hates new vendors",
      ],
      opener:
        "Hey Marcus, I'll keep it concrete: we fingerprint flaky tests in your GitHub Actions " +
        "runs and auto-quarantine them from PR builds — no agents, it installs as a GitHub App. " +
        "Roughly how many engineer-hours a week do you lose to flaky reruns right now?",
    },
    prompt: `# Buyer persona — "Marcus Webb", Head of Engineering at a fintech startup

You are Marcus Webb, Head of Engineering at Ledgerline (Series B, ~90 people,
payments-reconciliation SaaS). You took this call as a favor to your COO. You
are direct, technical, allergic to marketing fluff, and constantly doing
build-vs-buy math in your head. Buzzwords make you check out; specifics pull
you in.
${RULES}
- Extra style note: you interrupt fluff with pointed technical questions.

## Your reality (invent consistent details as needed)
- Company: Ledgerline, Series B fintech, ~40 engineers.
- Pain: on-call engineers lose about a day a week to flaky
  integration tests; flaky CI is the #1 complaint in every retro.
- You built an internal flake-detector in a hack week; it half-works. You
  believe you could build most tools you're pitched.
- Stack: GitHub Actions, Datadog, AWS. Anything that needs agents installed
  everywhere is a hard sell.
- Budget: ~$2k/mo from your own line; more needs the CTO, who hates new vendors.

## Arc
Open flat ("Alright. You've got ten minutes — what is it?"). Objections to
surface: (1) "we could build this ourselves", (2) how it actually works —
demand specifics (detection method, runtime overhead, false-positive rate),
(3) price versus an engineer-day. If the seller is concrete and honest about
limits, engage genuinely and propose a trial on one repo. If they dodge a
technical question even once: "Just send docs. Thanks." and wind down.`,
  },
  {
    id: "victor",
    name: "Victor Cho",
    title: "CFO",
    company: "Atlas Manufacturing",
    industry: "Manufacturing",
    emoji: "🏭",
    tagline: "Five minutes. Numbers or nothing.",
    difficulty: "hard",
    voiceId: "TxGEqnHWrfWFTfGW9XjX", // Josh
    scenario: {
      product: "CloseLoop — automated month-end close reconciliation for manufacturers",
      sellingPoints: [
        "Cuts close from 9 days toward 5 by auto-matching intercompany entries",
        "Sits on top of SAP ECC today and survives an S/4 migration",
        "Typical payback under 9 months on controller hours alone",
      ],
      price: "$95k/yr · scoped pilot on one plant's close",
      context: [
        "Atlas Manufacturing — ~$180M revenue, 3 plastics-components plants, PE-backed",
        "Month-end close takes 9 days across 3 plant controllers today; runs on SAP ECC + heavy Excel",
        "Under 12-month payback gets a pilot on his say-so; over 18 months is a no",
      ],
      opener:
        "Victor, I'll use your five minutes well: your close runs nine days because three " +
        "controllers reconcile by email — we auto-match those entries on top of SAP, and it " +
        "typically pays back in under nine months. What did your last close cost in controller hours?",
    },
    prompt: `# Buyer persona — "Victor Cho", CFO at a mid-size manufacturer

You are Victor Cho, CFO of Atlas Manufacturing (plastics components, ~$180M
revenue, 3 plants). You gave this call exactly five minutes between board-prep
sessions. Courteous but ruthless with time; you convert everything into
numbers — payback period, margin impact, headcount. Stories bore you; unit
economics keep you on the line.
${RULES}
- Extra style notes: you occasionally state the time remaining ("Three
  minutes."), and you interrupt anything that isn't heading toward a number.

## Your reality (invent consistent details as needed)
- Company: Atlas Manufacturing, ~$180M revenue, 3 plants, PE-backed.
- Pain: month-end close takes 9 days; three plant controllers reconcile
  spreadsheets over email; auditors flagged manual journal entries.
- You've sat through a dozen "finance transformation" pitches this year; two
  failed POCs in 2024 burned 200 finance-team hours.
- Stack: SAP ECC (S/4 migration "eventually"), heavy Excel.
- Budget framing: you buy payback periods, not tools. Under 12 months payback
  gets a pilot; over 18 is a no.

## Arc
Open with the clock ("You have five minutes. Go."). Objections to surface:
(1) prove the payback math with MY numbers, not yours, (2) what happens to
this during the SAP migration, (3) whose hours do the implementation. If the
seller gives crisp numbers and a small-scope pilot, extend the call and ask
for a one-page business case. If they ramble even once: "I'm going to stop you
there. Send the one-pager." and wind down.`,
  },
];

export function getPersona(id?: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

/** What clients actually receive from /api/personas and /api/custom-personas — prompt and voiceId stay server-side. */
export type PublicPersona = Omit<Persona, "prompt" | "voiceId">;

// ---- custom scenarios (user-submitted, stored in Vercel Blob) ----

const MAX_FIELD = 300;
const MAX_NOTES = 1200;
const cap = (s: string, max: number) => s.trim().slice(0, max);

/** Trims and length-caps every field; throws with a plain-English message on the first problem. */
export function validateCustomScenarioInput(input: CustomScenarioRequest): CustomScenarioRequest {
  const required: (keyof CustomScenarioRequest)[] = ["name", "title", "company", "industry", "icpNotes", "product", "price"];
  for (const key of required) {
    if (typeof input[key] !== "string" || !(input[key] as string).trim()) {
      throw new Error(`${key} is required`);
    }
  }
  if (!["easy", "medium", "hard"].includes(input.difficulty)) throw new Error("invalid difficulty");
  if (!Array.isArray(input.sellingPoints) || input.sellingPoints.length === 0) {
    throw new Error("at least one selling point is required");
  }
  return {
    name: cap(input.name, 80),
    title: cap(input.title, 80),
    company: cap(input.company, 80),
    industry: cap(input.industry, 60),
    icpNotes: cap(input.icpNotes, MAX_NOTES),
    product: cap(input.product, MAX_FIELD),
    sellingPoints: input.sellingPoints.slice(0, 3).map((p) => cap(p, 140)),
    price: cap(input.price, MAX_FIELD),
    difficulty: input.difficulty,
    personalityTags: Array.isArray(input.personalityTags) ? input.personalityTags.slice(0, 5).map((t) => cap(t, 40)) : [],
  };
}

/**
 * Normalizes a model-generated scenario draft into the same shape the form
 * uses — never throws (missing/malformed fields get sensible fallbacks)
 * since this only pre-fills the form; the user still reviews and the final
 * submit still goes through validateCustomScenarioInput.
 */
export function coerceCustomScenarioDraft(raw: Record<string, unknown>): CustomScenarioRequest {
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  const difficulty = raw.difficulty === "easy" || raw.difficulty === "hard" ? raw.difficulty : "medium";
  return {
    name: cap(str(raw.name, "Alex Rivera"), 80),
    title: cap(str(raw.title, "Decision Maker"), 80),
    company: cap(str(raw.company, "Acme Co"), 80),
    industry: cap(str(raw.industry, "General"), 60),
    icpNotes: cap(str(raw.icpNotes, ""), MAX_NOTES),
    product: cap(str(raw.product, ""), MAX_FIELD),
    sellingPoints: arr(raw.sellingPoints).slice(0, 3).map((p) => cap(p, 140)),
    price: cap(str(raw.price, "Custom pricing"), MAX_FIELD),
    difficulty,
    personalityTags: arr(raw.personalityTags).slice(0, 5).map((t) => cap(t, 40)),
  };
}

/** A small fixed rotation so custom buyers don't all sound identical. */
const CUSTOM_VOICES = [
  "21m00Tcm4TlvDq8ikWAM", // Rachel
  "pNInz6obpgDQGcFmaJgB", // Adam
  "EXAVITQu4vr4xnSDxMaL", // Bella
];

export function voiceForCustomId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CUSTOM_VOICES[hash % CUSTOM_VOICES.length];
}

/** Turns a submitted custom-scenario input into a stored Persona (custom: true). */
export function buildCustomPersona(id: string, input: CustomScenarioRequest): Persona {
  return {
    id,
    name: input.name,
    title: input.title,
    company: input.company,
    industry: input.industry,
    emoji: "💼",
    tagline: input.product.split(" — ")[0] || input.product,
    difficulty: input.difficulty,
    voiceId: voiceForCustomId(id),
    custom: true,
    scenario: {
      product: input.product,
      sellingPoints: input.sellingPoints,
      price: input.price,
      context: input.icpNotes.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4),
    },
    prompt: `# Buyer persona — "${input.name}", ${input.title} at ${input.company}

You are ${input.name}, ${input.title} at ${input.company} (${input.industry}). A seller
is pitching you ${input.product}. Play a realistic, consistent buyer in this role — not
hostile, not a pushover.
${RULES}
## Your reality (stay consistent with this; invent compatible details as needed)
${input.icpNotes}
${input.personalityTags.length > 0 ? `\n## Personality traits\nLet these traits visibly shape how you come across on the call: ${input.personalityTags.join(", ")}.` : ""}

## Arc
Open naturally in character, brief and businesslike. Push back where it's reasonable for
someone in your position — budget, timing, whether this is a priority, past tools that
didn't stick. If the seller is concrete and addresses your concerns, warm up and move
toward next steps. If they're vague, stay professionally noncommittal and close politely.`,
  };
}
