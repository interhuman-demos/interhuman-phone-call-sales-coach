# AI Buyer — Pitch Roleplay Demo (audio-only endpoint)

**One line:** You pitch a realistic AI buyer over voice — pure roleplay, it just
talks back. The screen shows what Interhuman's audio-only analysis hears in
real time: live signals, a call-trajectory meter, and warning nudges when the
pitch starts going sideways.

**Design decisions (Filip, 2026-07-09; revised 2026-07-14):**
- ~~No debrief/coach~~ **Superseded 2026-07-14:** this is a sales *coaching*
  tool. The buyer stays in character and never *mentions* signals, but replies
  ARE signal-aware (`/api/turn` receives a live snapshot of active signals +
  trajectory and reacts to the delivery). "End call" produces a full coaching
  debrief (`/api/debrief`): score, key moments, strengths/fixes, drill.
- **2026-07-14: multiple buyer personas.** `web/src/personas.ts` is the
  catalog (5 buyers across logistics/healthcare/fintech/retail/manufacturing,
  each with own prompt, ElevenLabs voice, difficulty, and a seller "briefing"
  scenario so nobody has to invent a pitch). Picker on the idle screen;
  briefing modal gates call start and reopens mid-call.
- Signals visible on screen: signal feed, trajectory meter, real-time nudges.
- **2026-07-14: real analysis is the default.** Token scope + session-config
  handshake are confirmed working (see `docs/session-2026-07-09.md`,
  `docs/session-2026-07-13.md`) — `App.tsx` calls `createAnalyzer(true, …)`
  unconditionally. Mock mode (`MockAnalyzer`, heuristics on the real
  transcript) still exists behind the same interface for offline dev/demo
  fallback; there's no URL flag anymore, swap the `true` → `false` in code.
- **Vercel-only deployment.** No custom server: client tokens let the browser
  connect *directly* to the Interhuman realtime WS (the docs' recommended
  pattern), and the conversation loop is a stateless serverless function.

## 1. The demo loop

```
You (mic, push-to-talk) ──► POST /api/turn ──► Dana's voice reply (OpenAI + ElevenLabs)
        │
        └─ same audio ──► DIRECT wss to Interhuman /v0/realtime/analyze
                          (client token, analysis_groups: ["audio"])
                                  │
                                  ▼
              SCREEN: live signal chips · call-trajectory meter ·
              info nudges (realtime_feedback) · warnings on drops
```

## 2. Architecture (all on Vercel)

- **`POST /api/interhuman-token`** — mints a short-lived, capped client token
  (API key stays in Vercel env). Caps: `expires_in`/`max_duration_seconds`
  900s, `max_concurrent` 1, optional `allowed_origins`. **No scopes passed**
  (server default). ⚠️ TODO: confirm default scope opens the realtime
  endpoint — scope table lists only stream/upload, but token caps explicitly
  cover "real-time" sessions.
- **`POST /api/turn`** — stateless: base64 webm utterance + conversation
  history in → Whisper STT → GPT buyer reply → ElevenLabs mp3 out. History is
  client-held, so functions scale to zero state. 60s maxDuration.
- **Browser (and iOS later)** — opens the Interhuman WSS directly with the
  minted token (`access_token` subprotocol), streams utterance audio, receives
  `signal.*` + `realtime_feedback.generated`. Health engine, nudges, and the
  mock analyzer all run client-side (`web/src/analyzer/`).
- **Contract** — `web/src/contract.ts` is the single source of truth for web
  and iOS: the two HTTP endpoints + the signal event shapes.

Trade-off accepted: analyzer/health logic is per-client (TS now, Swift later)
instead of once on a server — right call for a zero-ops demo with two clients.

## 3. Repo layout

```
ai-buyer-demo/
├── PLAN.md · README.md
├── docs/demo-script.md            # staged 4-minute arc
├── web/                           # THE app — a single Vercel project
│   ├── vercel.json                # vite + api/*.ts fns (maxDuration 60)
│   ├── api/
│   │   ├── interhuman-token.ts    # token mint (no scopes)
│   │   ├── turn.ts                # STT → buyer brain → TTS
│   │   └── _lib/persona.ts        # Dana (inlined for bundling)
│   └── src/
│       ├── App.tsx  audio.ts  contract.ts
│       └── analyzer/
│           ├── index.ts           # Analyzer interface + factory
│           ├── interhuman.ts      # direct WS client (client token)
│           ├── mock.ts            # transcript heuristics
│           └── health.ts          # trajectory + warnings
├── shared/protocol.ts             # pointer → web/src/contract.ts
└── server/                        # DEPRECATED; keeps phase0 spike script
```

## 4. Phases

1. ~~**Now:** Vercel app with mock signals — demo-complete.~~
2. ~~**When dev is back:** verify default token scope opens `/v0/realtime/analyze`~~
   **Done 2026-07-14:** real analysis is the default and only mode exposed
   in the UI; token scope confirmed, session-config handshake fixed.
3. **Polish:** rehearse demo script, presenter reveal, custom domain, tune
   health weights against real signal quality.
4. ~~**iOS:** SwiftUI client~~ **Done 2026-07-15** — `ios/` (SwiftUI, iOS 17+,
   XcodeGen). Same endpoints + direct WSS; `health.ts`/`interhuman.ts` ported;
   personas fetched from the new `GET /api/personas`. XCUITest e2e green
   against prod. See `docs/session-2026-07-15.md`.

## 5. Interhuman API cheat sheet (internal docs, 2026-07)

- Realtime: `wss://api.interhuman.ai/v0/realtime/analyze` (Beta).
- Client tokens: `POST /v1/client_tokens` server-side with API key →
  `access_token` (TTL 60–3600s), caps on duration/bytes/concurrency/origins.
  Scope enum lists `interhumanai.upload`, `interhumanai.stream`; caps text
  says they're "enforced on streaming sessions (stream / real-time)".
- Send: binary segments ≤32MB (webm ok) · `session.config`
  (`analysis_groups: ["audio"]`, `realtime_feedback_instructions` — enables
  feedback, `realtime_feedback_frequency` high|medium|low = 10/20/30s) ·
  `transcript.updated` (`{start,end,text,speaker}[]`) · `session.close`.
- Receive: `session.ready` → `signal.detected/updated/ended` (`signal_type`,
  `start`, `probability`, `rationale`, `modality`) · `transcript.generated` ·
  `realtime_feedback.generated` (`text`|`NO_GUIDANCE`) · `coverage_dropped` ·
  `error` · `session.closing` → `session.ended`.
- 12 signals: agreement, confidence, confusion, disagreement, disengagement,
  engagement, frustration, hesitation, interest, skepticism, stress, uncertainty.

## 6. Risks

1. ~~Token scope for realtime unverified~~ **Resolved 2026-07-09/13** — token
   scope opens the realtime endpoint and the session-config handshake fires
   real signals. Real analysis is now the default.
2. **Echo:** Dana's voice leaking into the mic → headphones on stage; browser
   AEC + push-to-talk otherwise.
3. **Turn latency:** STT + GPT + TTS per turn through a fn; target <2s
   perceived. If slow: stream TTS, or switch STT to gpt-4o-mini-transcribe.
4. **Payload limits:** base64 utterances over HTTP — fine up to ~2–3 min per
   utterance (Vercel 4.5MB body cap); push-to-talk keeps them short.
5. **Mock→real drift:** mock emits the exact AsyncAPI event shapes; keep it
   that way so the flip stays free.
