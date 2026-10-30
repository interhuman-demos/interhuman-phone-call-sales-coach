# AI Buyer — audio-only pitch roleplay demo

Pitch **Dana Reyes** (VP Ops, Meridian Freight) over voice. Pure roleplay — she
just talks back. The screen shows what Interhuman's audio-only analysis hears:
live signals, a call-trajectory meter, and warning nudges when your pitch
drifts.

**Deploys entirely on Vercel.** No servers: two serverless functions + a
static Vite app + a direct browser→Interhuman WebSocket via client tokens
(the integration pattern the Interhuman docs recommend).

- **[PLAN.md](./PLAN.md)** — architecture, phases, risks
- **[docs/demo-script.md](./docs/demo-script.md)** — the staged 4-minute arc

## Architecture

```
Browser / iOS
 ├─ POST /api/interhuman-token   Vercel fn: mints capped client token (key in env)
 ├─ POST /api/turn               Vercel fn, stateless: utterance+history+live signals in →
 │                               transcript + signal-aware Dana reply + mp3 out (OpenAI+ElevenLabs)
 ├─ POST /api/transcribe         Vercel fn: STT-only partials while the talk key is held
 ├─ POST /api/debrief            Vercel fn: transcript+signal log in → coaching summary JSON
 └─ wss → api.interhuman.ai/v0/realtime/analyze   DIRECT, via client token
                                 → signal.* / realtime_feedback events
Client-side: health engine, nudges, mock analyzer (web/src/analyzer/)
Client contract for web + iOS: web/src/contract.ts
```

## Run locally

```bash
cd web
npm i
cp .env.example .env        # OPENAI_API_KEY, ELEVENLABS_*, INTERHUMAN_API_KEY, BLOB_READ_WRITE_TOKEN
npx vercel dev              # runs Vite + the api/ functions together
```

`BLOB_READ_WRITE_TOKEN` needs a Vercel Blob store connected to the project
(`vercel blob create-store <name> --access public`, or the dashboard) — it
backs the "create your own scenario" feature (`web/api/custom-personas.ts`),
shared across every visitor.

Open http://localhost:3000, **pick a buyer** (5 industries, easy→hard, or
create your own) and browse the brief in the side rail — it's optional, you
can pitch your own product. Hit **Call** and the buyer answers first; hold
**Space** (or the button), pitch, release to send. Notes stay reachable
in-call via the collapsible panel. **End call** for the coaching debrief.
Headphones on.

## Deploy

```bash
cd web && npx vercel        # set the same env vars in the Vercel dashboard
```

## Signal modes

- **Real (default)** — mints a client token and connects directly to the
  Interhuman realtime endpoint (`InterhumanAnalyzer`,
  `web/src/analyzer/interhuman.ts`). Requires `INTERHUMAN_API_KEY` in `web/.env`.
- **Mock** — heuristics on your real transcript (`MockAnalyzer`,
  `web/src/analyzer/mock.ts`): filler words → `hesitation` (worse near
  pricing), 35s+ without a question → `disengagement` + warning, fluent
  delivery → `confidence`. Same event shapes as real, so the two are drop-in
  compatible — swap `createAnalyzer(true, …)` → `createAnalyzer(false, …)` in
  `App.tsx` if you need to demo without live API access.

## iOS (shipped 2026-07-15)

Native SwiftUI client in `ios/` against the same backend — same call loop,
personas (fetched from `GET /api/personas`), live signals, and debrief.

```bash
cd ios
xcodegen generate          # brew install xcodegen; the .xcodeproj is gitignored
open SalesCoach.xcodeproj  # simulator needs no signing; devices need a team
```

Audio note: the realtime WS rejects WAV but accepts m4a (probe-verified), so
the recorder sends WAV to Whisper and a parallel m4a to the WS — see
`ios/SalesCoach/Audio/Recorder.swift` and `docs/session-2026-07-15.md`.
Simulator quirk: keep Simulator.app open (headless `AVAudioEngine` aborts).

## Layout

```
web/api/                interhuman-token.ts · turn.ts · transcribe.ts · debrief.ts · personas.ts ·
                         custom-personas.ts · generate-scenario.ts (+ _lib/stt.ts, resolvePersona.ts, customStore.ts)
web/src/                App.tsx · audio.ts · contract.ts · personas.ts (5 buyers + custom scenarios)
web/src/components/     Sparkline.tsx · Timeline.tsx · Debrief.tsx · BriefContent.tsx · NotesPanel.tsx ·
                         ScenarioForm.tsx · DeviceSettings.tsx
web/src/analyzer/       index.ts · interhuman.ts · mock.ts · health.ts
ios/                    SwiftUI app (XcodeGen project.yml · SalesCoach/ · SalesCoachUITests/)
server/                 DEPRECATED — kept for spike/probe-realtime-config.mjs
```
