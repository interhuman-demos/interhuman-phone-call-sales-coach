import { useState } from "react";
import type { RefObject } from "react";
import type { HealthSample, SignalEvent, SignalSpan, SignalType } from "../contract";
import type { PublicPersona } from "../personas";
import { POSITIVE, type Line } from "../call";
import { initials } from "../avatar";
import Sparkline from "./Sparkline";
import Timeline from "./Timeline";
import BriefContent from "./BriefContent";

interface Props {
  persona: PublicPersona;
  elapsedSec: number;
  buyerSpeaking: boolean;
  thinking: boolean;
  talking: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onPressStart: () => void;
  onEndCall: () => void;
  onOpenDevices: () => void;
  briefOpen: boolean;
  onToggleBrief: () => void;
  transcriptOpen: boolean;
  onToggleTranscript: () => void;
  lines: Line[];
  liveText: string;
  buyerFirst: string;
  transcriptEndRef: RefObject<HTMLDivElement>;
  health: number;
  trend: "up" | "flat" | "down";
  healthSamples: HealthSample[];
  signals: Map<SignalType, SignalEvent>;
  signalLog: SignalSpan[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Full-chrome live call — Cockpit layout (mock 1b), collapsible Brief/Transcript (2a/2b). */
export default function LiveCall({
  persona, elapsedSec, buyerSpeaking, thinking, talking, muted, onToggleMute, onPressStart, onEndCall,
  onOpenDevices, briefOpen, onToggleBrief, transcriptOpen, onToggleTranscript, lines, liveText, buyerFirst,
  transcriptEndRef, health, trend, healthSamples, signals, signalLog,
}: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const s = persona.scenario;
  const healthColor = health >= 60 ? "var(--good)" : health >= 45 ? "var(--warn)" : "var(--bad)";
  const lastLine = lines[lines.length - 1];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "100vh" }}>
      <div style={{ display: "flex", minWidth: 0 }}>
        {/* Brief & notes — in-flow, width-animated */}
        <div style={{ width: briefOpen ? 312 : 0, overflow: "hidden", transition: "width .25s ease", flex: "none", borderRight: briefOpen ? "1px solid var(--line)" : "none" }}>
          <div style={{ width: 312, height: "100%", background: "var(--bg)", padding: 20, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ font: "11px var(--font-mono)", color: "var(--accent)", letterSpacing: 1 }}>BRIEF &amp; NOTES</span>
              <button onClick={onToggleBrief} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>✕</button>
            </div>
            <BriefContent persona={persona} />
          </div>
        </div>

        {/* main call stage */}
        <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateRows: "60px minmax(0,1fr) auto 132px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "dvBlink 1.6s infinite" }} />
              <span style={{ font: "600 11px var(--font-mono)", color: "var(--accent)", letterSpacing: 1 }}>LIVE</span>
              <span style={{ font: "14px var(--font-mono)", color: "var(--muted)" }}>{fmt(elapsedSec)}</span>
            </div>
            <button onClick={onOpenDevices} style={{
              background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)",
              font: "12px var(--font-sans)", padding: "6px 12px", cursor: "pointer",
            }}>
              Devices
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 0 }}>
            <div style={{ position: "relative", width: 168, height: 168, display: "grid", placeItems: "center" }}>
              <div style={{
                position: "absolute", inset: 12, borderRadius: "50%",
                border: `2px solid ${buyerSpeaking ? "var(--good)" : "var(--line-strong)"}`,
                animation: buyerSpeaking ? "dvRing 2.6s ease-out infinite" : "none",
              }} />
              <div style={{
                width: 140, height: 140, borderRadius: "50%",
                background: "linear-gradient(150deg, var(--line-strong), var(--line))",
                border: "1px solid var(--line-strong)", display: "grid", placeItems: "center",
                font: "400 52px var(--font-serif)", color: "var(--text)",
              }}>
                {initials(persona.name)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ font: "400 28px var(--font-serif)", color: "var(--text)" }}>{persona.name}</div>
              <div style={{ font: "12.5px var(--font-sans)", color: "var(--muted)", marginTop: 3 }}>{persona.title} · {persona.company}</div>
            </div>
            <div style={{ font: "13px var(--font-sans)", color: buyerSpeaking ? "var(--good)" : "var(--muted)", minHeight: 18 }}>
              {buyerSpeaking ? `${buyerFirst} is speaking…` : thinking ? `${buyerFirst} is thinking…` : talking ? "Listening to you…" : "Hold Space (or the button) and pitch"}
            </div>
          </div>

          {/* transcript peek / drawer */}
          {transcriptOpen ? (
            <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg)", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ font: "10px var(--font-mono)", color: "var(--muted)", letterSpacing: 1 }}>TRANSCRIPT</span>
                <button onClick={onToggleTranscript} style={{ background: "none", border: "none", color: "var(--muted)", font: "11px var(--font-sans)", cursor: "pointer" }}>Collapse ▾</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lines.length === 0 && !liveText && <span style={{ color: "var(--muted)", font: "13px var(--font-sans)" }}>The call transcript appears here.</span>}
                {lines.map((l, i) => (
                  <p key={i} style={{ margin: 0, font: "13px/1.45 var(--font-sans)", color: "var(--dim)" }}>
                    <b style={{ color: l.speaker === "rep" ? "var(--accent)" : "var(--good)" }}>{l.speaker === "rep" ? "You" : buyerFirst}:</b> {l.text}
                  </p>
                ))}
                {liveText && (
                  <p style={{ margin: 0, font: "13px/1.45 var(--font-sans)", color: "var(--dim)", opacity: 0.6 }}>
                    <b style={{ color: "var(--accent)" }}>You:</b> {liveText}
                  </p>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          ) : (
            <button onClick={onToggleTranscript} style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
              padding: "0 24px", height: 52, borderTop: "1px solid var(--line)", background: "var(--bg)", boxSizing: "border-box",
            }}>
              <span style={{ font: "10px var(--font-mono)", color: "var(--muted)", letterSpacing: 1 }}>TRANSCRIPT</span>
              <span style={{ flex: 1, font: "13px var(--font-sans)", color: "var(--dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lastLine ? <><b style={{ color: lastLine.speaker === "rep" ? "var(--accent)" : "var(--good)" }}>{lastLine.speaker === "rep" ? "You" : buyerFirst}:</b> {lastLine.text}</> : "Nothing said yet."}
              </span>
              <span style={{ font: "11px var(--font-sans)", color: "var(--muted)" }}>Expand ▴</span>
            </button>
          )}

          {/* controls */}
          <div style={{ borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, position: "relative" }}>
            <button onClick={onToggleMute} style={{
              width: 58, height: 58, borderRadius: "50%",
              background: muted ? "var(--bad)" : "var(--panel2)",
              border: `1px solid ${muted ? "var(--bad)" : "var(--line-strong)"}`,
              color: muted ? "#fff" : "var(--dim)", font: "11px var(--font-sans)", cursor: "pointer",
            }}>
              {muted ? "Muted" : "Mute"}
            </button>
            <button
              onPointerDown={onPressStart}
              style={{
                height: 58, padding: "0 36px", borderRadius: 29,
                background: talking ? "var(--bad)" : "var(--accent)", border: "none",
                color: talking ? "#fff" : "var(--accent-text)", font: "600 15px var(--font-sans)", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1,
              }}
            >
              {talking ? "Release to send" : "Hold to talk"}
              <span style={{ font: "9px var(--font-mono)", opacity: 0.65, letterSpacing: 1 }}>SPACE</span>
            </button>
            <button onClick={() => setConfirmEnd(true)} style={{
              width: 58, height: 58, borderRadius: "50%", background: "var(--bad)",
              border: "none", color: "#fff", font: "11px var(--font-sans)", cursor: "pointer",
            }}>
              End
            </button>

            {confirmEnd && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
                background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)",
                padding: 14, boxShadow: "var(--shadow-shell)", display: "flex", flexDirection: "column", gap: 10,
                alignItems: "center", zIndex: 5, whiteSpace: "nowrap",
              }}>
                <span style={{ font: "13px var(--font-sans)", color: "var(--text)" }}>End this call?</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmEnd(false)} style={{
                    height: 30, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)",
                    background: "none", color: "var(--dim)", font: "12px var(--font-sans)", cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button onClick={() => { setConfirmEnd(false); onEndCall(); }} style={{
                    height: 30, padding: "0 14px", borderRadius: 8, border: "none",
                    background: "var(--bad)", color: "#fff", font: "600 12px var(--font-sans)", cursor: "pointer",
                  }}>
                    End call
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HUD rail */}
      <aside style={{
        borderLeft: "1px solid var(--line)", padding: 20, display: "flex",
        flexDirection: "column", gap: 18, background: "var(--bg)", minHeight: 0, overflowY: "auto",
      }}>
        <button onClick={onToggleBrief} style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--panel2)", border: `1px solid ${briefOpen ? "var(--accent)" : "var(--line-strong)"}`,
          borderRadius: 10, padding: "11px 13px",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ font: "11px var(--font-mono)", color: "var(--accent)", letterSpacing: 1 }}>BRIEF</span>
            <span style={{ font: "13px var(--font-sans)", color: "var(--dim)" }}>
              {briefOpen ? "Open ›" : `${s.product.split(" — ")[0]} · ${s.price.split(" ")[0]}`}
            </span>
          </span>
          <span style={{ font: "12px var(--font-sans)", color: briefOpen ? "var(--accent)" : "var(--muted)" }}>{briefOpen ? "▴" : "▾"}</span>
        </button>

        <div>
          <div style={{ font: "11px var(--font-mono)", color: "var(--muted)", letterSpacing: 1, marginBottom: 10 }}>CALL TRAJECTORY</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ font: "400 50px var(--font-serif)", color: healthColor, lineHeight: 1 }}>{health}</span>
            <span style={{ font: "14px var(--font-sans)", color: healthColor }}>
              {trend === "up" ? "↗ warming" : trend === "down" ? "↘ cooling" : "→ steady"}
            </span>
          </div>
          <Sparkline samples={healthSamples} windowSec={90} height={58} />
        </div>

        <div>
          <div style={{ font: "11px var(--font-mono)", color: "var(--muted)", letterSpacing: 1, marginBottom: 10 }}>LIVE SIGNALS</div>
          {signals.size === 0 && <div style={{ color: "var(--muted)", font: "12.5px var(--font-sans)" }}>Nothing active.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...signals.values()].map((sig) => {
              const positive = POSITIVE.includes(sig.signal_type);
              const color = positive ? "var(--good)" : "var(--bad)";
              return (
                <div key={sig.signal_type} style={{
                  border: `1px solid ${color}`, background: `color-mix(in srgb, ${color} 8%, transparent)`,
                  borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <b style={{ color, font: "600 13px var(--font-sans)" }}>{sig.signal_type}</b>
                  <span style={{ font: "11px var(--font-mono)", color: "var(--muted)" }}>{sig.probability ?? ""}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ font: "11px var(--font-mono)", color: "var(--muted)", letterSpacing: 1, marginBottom: 10 }}>TIMELINE</div>
          <Timeline log={signalLog} nowSec={elapsedSec} />
        </div>
      </aside>
    </div>
  );
}
