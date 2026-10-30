import "dotenv/config";
import { WebSocketServer } from "ws";
import { Session } from "./session.js";

const port = Number(process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
  console.log("client connected");
  new Session(ws);
  ws.on("close", () => console.log("client disconnected"));
});

console.log(
  `ai-buyer-demo server on ws://localhost:${port} · ` +
  `signals: ${(process.env.MOCK_SIGNALS ?? "true") !== "false" ? "MOCK" : "Interhuman realtime"}`,
);
