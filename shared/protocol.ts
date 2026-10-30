/**
 * MOVED (2026-07-09): the client contract now lives in `web/src/contract.ts`
 * — single source of truth for web and iOS.
 *
 * Architecture: Vercel serverless (POST /api/interhuman-token, POST /api/turn)
 * + direct client→Interhuman realtime WebSocket via minted client tokens.
 * There is no custom WS server anymore; this file described its old protocol.
 *
 * iOS: implement against web/src/contract.ts —
 *   1. POST /api/interhuman-token → open direct WSS with the client token
 *   2. per utterance: POST /api/turn (base64 webm + history) → play mp3 reply
 *   3. handle signal.* / realtime_feedback.generated events from the WSS
 */
export {};
