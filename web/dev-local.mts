/**
 * Local dev without the Vercel CLI: serves the two api/ functions on :8788
 * and starts Vite on :5173 (which proxies /api → :8788, see vite.config.ts).
 *
 *   npm run dev:local  →  http://localhost:5173
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { createServer as createViteServer } from "vite";
import { POST as turnHandler } from "./api/turn.ts";
import { POST as tokenHandler } from "./api/interhuman-token.ts";
import { POST as transcribeHandler } from "./api/transcribe.ts";
import { POST as debriefHandler } from "./api/debrief.ts";
import { GET as personasHandler } from "./api/personas.ts";
import { GET as customPersonasGet, POST as customPersonasPost } from "./api/custom-personas.ts";
import { POST as generateScenarioHandler } from "./api/generate-scenario.ts";

// minimal .env loader (no dependency)
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Handler = (req: Request) => Promise<Response>;

const routes: Record<string, Handler | Partial<Record<"GET" | "POST", Handler>>> = {
  "/api/turn": turnHandler,
  "/api/interhuman-token": tokenHandler,
  "/api/transcribe": transcribeHandler,
  "/api/debrief": debriefHandler,
  "/api/personas": personasHandler,
  "/api/custom-personas": { GET: customPersonasGet, POST: customPersonasPost },
  "/api/generate-scenario": generateScenarioHandler,
};

createServer(async (req, res) => {
  const route = routes[req.url?.split("?")[0] ?? ""];
  const handler = typeof route === "function" ? route : route?.[req.method as "GET" | "POST"];
  if (!handler) { res.writeHead(404).end("not found"); return; }
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" }).end(String(err));
  }
}).listen(8788, () => console.log("api functions on http://localhost:8788"));

const vite = await createViteServer({ server: { port: 5173 } });
await vite.listen();
console.log("\n  ➜  open http://localhost:5173\n");
