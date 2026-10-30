# Deprecated (2026-07-09)

This Node orchestrator was replaced by the Vercel-native architecture:
serverless functions in `web/api/` + direct browser→Interhuman WS via client
tokens. See `../PLAN.md`.

Still useful here:
- `spike/phase0-audio-spike.ts` — validates real audio-only signal quality
  from a recorded pitch (uses the raw API key). Run when the model improves.

Safe to delete the rest.
