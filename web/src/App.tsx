import { useEffect, useRef, useState } from "react";
import type {
  DebriefResponse, HealthSample, SignalEvent, SignalSpan, SignalType,
  TranscriptSegment, Turn, TurnResponse,
} from "./contract";
import { createAnalyzer, type Analyzer } from "./analyzer/index";
import { HealthEngine } from "./analyzer/health";
import { Recorder, Player } from "./audio";
import { PERSONAS, type PublicPersona } from "./personas";
import { POSITIVE, type Line } from "./call";
import Debrief from "./components/Debrief";
import ScenarioForm from "./components/ScenarioForm";
import DeviceSettings from "./components/DeviceSettings";
import Home from "./components/Home";
import ConnectingScreen from "./components/ConnectingScreen";
import LiveCall from "./components/LiveCall";

interface Nudge { id: number; severity: "info" | "warning"; text: string }

export default function App() {
  const [status, setStatus] = useState<"idle" | "connecting" | "ringing" | "live" | "ended">("idle");
  const [micReady, setMicReady] = useState(false);
  const [linkReady, setLinkReady] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("theme") as "dark" | "light" | null) ?? "dark",
  );
  const [briefOpen, setBriefOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [signals, setSignals] = useState<Map<SignalType, SignalEvent>>(new Map());
  const [signalLog, setSignalLog] = useState<SignalSpan[]>([]);
  const [healthSamples, setHealthSamples] = useState<HealthSample[]>([]);
  const [health, setHealth] = useState(65);
  const [trend, setTrend] = useState<"up" | "flat" | "down">("flat");
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [talking, setTalking] = useState(false);
  const [buyerSpeaking, setBuyerSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [debrief, setDebrief] = useState<DebriefResponse>();
  const [debriefError, setDebriefError] = useState<string>();
  const [endedAtSec, setEndedAtSec] = useState(0);
  const [personas, setPersonas] = useState<PublicPersona[]>(PERSONAS);
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [scenarioFormOpen, setScenarioFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [micId, setMicId] = useState(() => localStorage.getItem("micId") ?? "");
  const [speakerId, setSpeakerId] = useState(() => localStorage.getItem("speakerId") ?? "");

  const persona = personas.find((p) => p.id === personaId) ?? personas[0];
  const buyerFirst = persona.name.replace(/^Dr\. /, "").split(" ")[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data: { personas: PublicPersona[] }) => {
        if (data.personas?.length) setPersonas(data.personas);
      })
      .catch(() => { /* static catalog already rendering — fine to skip */ });
  }, []);

  const analyzer = useRef<Analyzer>();
  const engine = useRef(new HealthEngine());
  const recorder = useRef(new Recorder());
  const player = useRef(new Player());
  const history = useRef<Turn[]>([]);
  const transcript = useRef<TranscriptSegment[]>([]);
  const clockSec = useRef(0);
  const nudgeId = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  // live mirrors for values read inside analyzer callbacks and turn payloads
  const signalsRef = useRef<Map<SignalType, SignalEvent>>(new Map());
  const healthRef = useRef(65);
  const trendRef = useRef<"up" | "flat" | "down">("flat");
  const talkingRef = useRef(false);
  const callStartedAt = useRef(0);
  const callAborted = useRef(false);
  const personaIdRef = useRef(personaId);
  const nudgeLog = useRef<string[]>([]);
  const pendingNudges = useRef<Map<"info" | "warning", string>>(new Map());

  // partial-transcription bookkeeping, while the talk button is held
  const partialText = useRef("");
  const partialAt = useRef(0);
  const partialTimer = useRef<number>();

  const nowSec = () => (Date.now() - callStartedAt.current) / 1000;
  const elapsedSec = status === "ended" ? endedAtSec : healthSamples[healthSamples.length - 1]?.t ?? 0;

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, liveText]);

  // Hold Space to talk; release anywhere (key or pointer) to send. The ref
  // always points at this render's handlers so the listeners stay fresh.
  const handlers = useRef({ pressStart, pressEnd });
  handlers.current = { pressStart, pressEnd };
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.(); // Space must not re-click a focused button
      handlers.current.pressStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      void handlers.current.pressEnd();
    };
    const pointerUp = () => void handlers.current.pressEnd();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
    };
  }, []);

  function showNudge(severity: "info" | "warning", text: string) {
    const id = ++nudgeId.current;
    setNudges((ns) => [...ns.slice(-1), { id, severity, text }]); // at most 2 on screen
    setTimeout(() => setNudges((ns) => ns.filter((n) => n.id !== id)), 9000);
  }

  function pushNudge(severity: "info" | "warning", text: string) {
    nudgeLog.current.push(text);
    if (talkingRef.current) pendingNudges.current.set(severity, text); // hold until the rep stops talking
    else showNudge(severity, text);
  }

  function applyHealth(u: { score: number; trend: "up" | "flat" | "down"; warning?: string }) {
    healthRef.current = u.score;
    trendRef.current = u.trend;
    setHealth(u.score);
    setTrend(u.trend);
    if (u.warning) pushNudge("warning", u.warning);
  }

  /** Starts the decay + sampler loops — only meaningful once the call is actually live. */
  function startTimers() {
    // gentle decay toward neutral while the call runs
    const decay = setInterval(() => {
      if (analyzer.current) applyHealth(engine.current.decay(Date.now()));
      else clearInterval(decay);
    }, 5000);
    // trajectory samples for the moving graph
    const sampler = setInterval(() => {
      if (!analyzer.current) { clearInterval(sampler); return; }
      setHealthSamples((hs) => [...hs, { t: nowSec(), score: healthRef.current }]);
    }, 500);
  }

  /**
   * Connecting → Ringing → Live, driven by real work instead of fake timers:
   * connecting covers mic init + analyzer construction/start (the checklist),
   * ringing covers kickoffTurn's network+LLM+TTS round trip (the buyer "picking up"),
   * live begins the instant the buyer's opening audio actually starts playing.
   */
  async function startCall() {
    callAborted.current = false;
    setStatus("connecting");
    setMicReady(false);
    setLinkReady(false);
    setAnalysisReady(false);
    try {
      await recorder.current.init(micId);
      if (callAborted.current) return;
      setMicReady(true);

      analyzer.current = createAnalyzer(true, {
        onSignal: (signal) => {
          signalsRef.current.set(signal.signal_type, signal);
          setSignals((m) => new Map(m).set(signal.signal_type, signal));
          const t = nowSec();
          setSignalLog((log) => {
            const open = log.findIndex((s) => s.signal_type === signal.signal_type && s.endSec === undefined);
            if (open >= 0) {
              const next = [...log];
              next[open] = { ...next[open], probability: signal.probability ?? next[open].probability };
              return next;
            }
            return [...log, {
              signal_type: signal.signal_type,
              probability: signal.probability,
              positive: POSITIVE.includes(signal.signal_type),
              startSec: t,
            }];
          });
          applyHealth(engine.current.onSignal(signal, Date.now()));
        },
        onSignalEnded: (signal_type) => {
          signalsRef.current.delete(signal_type);
          setSignals((m) => { const n = new Map(m); n.delete(signal_type); return n; });
          const t = nowSec();
          setSignalLog((log) => log.map((s) =>
            s.signal_type === signal_type && s.endSec === undefined ? { ...s, endSec: t } : s));
        },
        onFeedback: (text) => pushNudge("info", text),
        onError: (message) => console.error("analyzer:", message),
      });
      if (callAborted.current) { analyzer.current.close(); analyzer.current = undefined; return; }
      setLinkReady(true);

      await analyzer.current.start();
      if (callAborted.current) { analyzer.current?.close(); analyzer.current = undefined; return; }
      setAnalysisReady(true);

      setStatus("ringing");
    } catch (err) {
      console.error(err);
      pushNudge("warning", `Couldn't start: ${(err as Error).message}`);
      setStatus("idle");
      return;
    }
    void kickoffTurn();
  }

  /** Abort a call still in Connecting/Ringing and return to the picker. */
  function cancelConnecting() {
    callAborted.current = true;
    analyzer.current?.close();
    analyzer.current = undefined;
    recorder.current.dispose();
    setThinking(false);
    setStatus("idle");
  }

  /** The buyer answers the phone first — one line, no rep audio involved. */
  async function kickoffTurn() {
    setThinking(true);
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio: "", history: [], personaId: personaIdRef.current, kickoff: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const turn = (await res.json()) as TurnResponse;
      setThinking(false);
      if (callAborted.current) return;
      if (!turn.buyerText) {
        callStartedAt.current = Date.now();
        setStatus("live");
        startTimers();
        return;
      }

      // the buyer "picks up" — call is live from here
      callStartedAt.current = Date.now();
      setStatus("live");
      startTimers();

      setLines((l) => [...l, { speaker: "buyer", text: turn.buyerText }]);
      history.current.push({ role: "buyer", text: turn.buyerText });
      const est = Math.max(1.5, turn.buyerText.split(/\s+/).length / 2.5);
      transcript.current.push({ start: clockSec.current, end: clockSec.current + est, text: turn.buyerText, speaker: 1 });
      clockSec.current += est;

      player.current.setSink(speakerId);
      await player.current.play(fromBase64(turn.audio), setBuyerSpeaking);
    } catch (err) {
      setThinking(false);
      if (callAborted.current) return;
      pushNudge("warning", `${buyerFirst} couldn't start the call: ${(err as Error).message}`);
      setStatus("idle");
    }
  }

  function handleMicChange(id: string) {
    setMicId(id);
    localStorage.setItem("micId", id);
    if (status === "live") void recorder.current.init(id); // hot-swap mid-call
  }

  function handleSpeakerChange(id: string) {
    setSpeakerId(id);
    localStorage.setItem("speakerId", id);
  }

  /** Keeps personaIdRef in sync so async call-setup code never reads a stale id from closure. */
  function selectPersona(id: string) {
    personaIdRef.current = id;
    setPersonaId(id);
  }

  function handleCall(id: string) {
    selectPersona(id);
    void startCall();
  }

  function handleScenarioCreated(created: PublicPersona) {
    setPersonas((ps) => [...ps, created]);
    selectPersona(created.id);
    setScenarioFormOpen(false);
    void startCall();
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function pressStart() {
    if (status !== "live" || buyerSpeaking || thinking || talkingRef.current || muted) return;
    talkingRef.current = true;
    setTalking(true);
    setLiveText("");
    partialText.current = "";
    partialAt.current = performance.now();

    recorder.current.start((chunk) => {
      // stream raw bytes to the real analyzer continuously, as they're captured
      void chunk.arrayBuffer().then((buf) => analyzer.current?.pushAudio(buf, clockSec.current, 0.25));
    });

    // every ~2.5s while still holding: transcribe what's been said so far and
    // feed just the new part to the analyzer, so signals update live instead
    // of waiting for release.
    partialTimer.current = window.setInterval(async () => {
      const snap = recorder.current.snapshot();
      if (snap.size < 3000) return; // not enough audio yet to bother
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audio: toBase64(await snap.arrayBuffer()) }),
        });
        if (!res.ok) return;
        const { text } = (await res.json()) as { text: string };
        if (!text || text === partialText.current) return;

        const newPart = text.startsWith(partialText.current)
          ? text.slice(partialText.current.length).trim()
          : text;
        const now = performance.now();
        const deltaSec = (now - partialAt.current) / 1000;
        partialText.current = text;
        partialAt.current = now;
        setLiveText(text);
        if (newPart) analyzer.current?.pushText(newPart, clockSec.current, deltaSec, transcript.current);
      } catch { /* best-effort; next tick will catch up */ }
    }, 2500);
  }

  async function pressEnd() {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    setTalking(false);
    clearInterval(partialTimer.current);
    // nudges held back while talking land now, when they can be read
    for (const [severity, text] of pendingNudges.current) showNudge(severity, text);
    pendingNudges.current.clear();

    const pressEndAt = performance.now();
    const { blob, durationMs } = await recorder.current.stop();
    if (durationMs < 300) { setLiveText(""); return; } // accidental tap

    const durationSec = durationMs / 1000;
    const start = clockSec.current;
    clockSec.current += durationSec;

    const buf = await blob.arrayBuffer();
    setThinking(true);

    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audio: toBase64(buf),
          history: history.current,
          personaId: personaIdRef.current,
          signals: {
            active: [...signalsRef.current.values()].map((s) => ({
              signal_type: s.signal_type,
              probability: s.probability,
            })),
            health: healthRef.current,
            trend: trendRef.current,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const turn = (await res.json()) as TurnResponse;
      if (!turn.repText) { setThinking(false); setLiveText(""); return; }

      // rep line
      setLines((l) => [...l, { speaker: "rep", text: turn.repText }]);
      setLiveText("");
      history.current.push({ role: "rep", text: turn.repText });
      transcript.current.push({ start, end: start + durationSec, text: turn.repText, speaker: 0 });
      // only analyze the tail that wasn't already covered by live partial ticks, to avoid double-firing
      const remainder = turn.repText.startsWith(partialText.current)
        ? turn.repText.slice(partialText.current.length).trim()
        : turn.repText;
      const remainderSec = Math.max(0.3, (pressEndAt - partialAt.current) / 1000);
      if (remainder) analyzer.current?.pushText(remainder, start, remainderSec, transcript.current);

      // buyer line
      setLines((l) => [...l, { speaker: "buyer", text: turn.buyerText }]);
      history.current.push({ role: "buyer", text: turn.buyerText });
      const est = Math.max(1.5, turn.buyerText.split(/\s+/).length / 2.5);
      transcript.current.push({ start: clockSec.current, end: clockSec.current + est, text: turn.buyerText, speaker: 1 });
      clockSec.current += est;

      setThinking(false);
      player.current.setSink(speakerId);
      await player.current.play(fromBase64(turn.audio), setBuyerSpeaking);
    } catch (err) {
      setThinking(false);
      pushNudge("warning", `Turn failed: ${(err as Error).message}`);
    }
  }

  async function endCall() {
    if (status !== "live") return;
    talkingRef.current = false;
    setTalking(false);
    clearInterval(partialTimer.current);
    analyzer.current?.close();
    analyzer.current = undefined; // stops the decay + sampler loops
    recorder.current.dispose();
    player.current.stop();
    setBuyerSpeaking(false);
    setEndedAtSec(nowSec());
    setStatus("ended");

    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: history.current,
          signalLog,
          healthSamples,
          nudges: nudgeLog.current,
          personaId: personaIdRef.current,
          transcript: transcript.current,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDebrief((await res.json()) as DebriefResponse);
    } catch (err) {
      setDebriefError((err as Error).message);
    }
  }

  let screen: React.ReactNode;
  if (status === "ended") {
    screen = (
      <Debrief
        data={debrief}
        error={debriefError}
        samples={healthSamples}
        log={signalLog}
        transcript={transcript.current}
        durationSec={endedAtSec}
        personaName={persona.name}
        productName={persona.scenario.product.split(" — ")[0]}
        onRestart={() => location.reload()}
      />
    );
  } else if (status === "connecting" || status === "ringing") {
    screen = (
      <ConnectingScreen
        status={status}
        persona={persona}
        micReady={micReady}
        linkReady={linkReady}
        analysisReady={analysisReady}
        onCancel={cancelConnecting}
      />
    );
  } else if (status === "live") {
    screen = (
      <LiveCall
        persona={persona}
        elapsedSec={elapsedSec}
        buyerSpeaking={buyerSpeaking}
        thinking={thinking}
        talking={talking}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPressStart={pressStart}
        onEndCall={endCall}
        onOpenDevices={() => setSettingsOpen(true)}
        briefOpen={briefOpen}
        onToggleBrief={() => setBriefOpen((b) => !b)}
        transcriptOpen={transcriptOpen}
        onToggleTranscript={() => setTranscriptOpen((t) => !t)}
        lines={lines}
        liveText={liveText}
        buyerFirst={buyerFirst}
        transcriptEndRef={transcriptEnd}
        health={health}
        trend={trend}
        healthSamples={healthSamples}
        signals={signals}
        signalLog={signalLog}
      />
    );
  } else {
    screen = (
      <Home
        personas={personas}
        onCall={handleCall}
        onNewScenario={() => setScenarioFormOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <>
      {screen}

      {scenarioFormOpen && (
        <ScenarioForm onClose={() => setScenarioFormOpen(false)} onCreated={handleScenarioCreated} />
      )}

      {settingsOpen && (
        <DeviceSettings
          micId={micId}
          speakerId={speakerId}
          onMicChange={handleMicChange}
          onSpeakerChange={handleSpeakerChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ---- nudge toasts ---- */}
      <div style={{ position: "fixed", bottom: 150, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 10, pointerEvents: "none" }}>
        {nudges.map((n) => (
          <div key={n.id} style={{
            padding: "12px 18px", borderRadius: "var(--radius-sm)", maxWidth: 480,
            background: "var(--panel)",
            border: `1px solid ${n.severity === "warning" ? "var(--warn)" : "var(--good)"}`,
            color: "var(--text)", font: "13px var(--font-sans)", boxShadow: "var(--shadow-shell)",
          }}>
            {n.severity === "warning" ? "⚠️ " : "💡 "}{n.text}
          </div>
        ))}
      </div>
    </>
  );
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
