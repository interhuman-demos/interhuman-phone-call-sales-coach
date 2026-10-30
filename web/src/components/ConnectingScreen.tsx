import { useEffect, useState } from "react";
import type { PublicPersona } from "../personas";
import { initials } from "../avatar";

interface Props {
  status: "connecting" | "ringing";
  persona: PublicPersona;
  micReady: boolean;
  linkReady: boolean;
  analysisReady: boolean;
  onCancel: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Connecting → Ringing, before the buyer picks up. Mock 3a/3b. */
export default function ConnectingScreen({ status, persona, micReady, linkReady, analysisReady, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const s = persona.scenario;

  useEffect(() => {
    if (status !== "ringing") { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        width: "min(1000px, 100%)", height: "min(640px, calc(100vh - 48px))", background: "var(--panel)",
        border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden",
        display: "grid", gridTemplateColumns: "300px 1fr", boxShadow: "var(--shadow-shell)",
      }}>
        {/* brief side panel */}
        <div style={{
          background: "var(--bg)", borderRight: "1px solid var(--line)", padding: 20,
          display: "flex", flexDirection: "column", gap: 18, overflow: "hidden",
        }}>
          <div>
            <div style={{ font: "11px var(--font-mono)", color: "var(--accent)", letterSpacing: 1, marginBottom: 10 }}>
              YOUR BRIEF
            </div>
            <div style={{ font: "400 20px var(--font-serif)", color: "var(--text)" }}>{s.product.split(" — ")[0]}</div>
            <div style={{ font: "12.5px/1.5 var(--font-sans)", color: "var(--muted)", marginBottom: 12 }}>
              {s.product.split(" — ").slice(1).join(" — ") || s.product}
            </div>
            <ul style={{ margin: "0 0 12px", paddingLeft: 16, font: "12.5px/1.7 var(--font-sans)", color: "var(--dim)" }}>
              {s.sellingPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <div style={{ font: "12.5px var(--font-sans)", color: "var(--dim)" }}>
              <b style={{ color: "var(--accent)" }}>Price:</b> {s.price}
            </div>
          </div>
          {status === "connecting" && s.opener && (
            <div style={{
              borderLeft: "3px solid var(--good)", background: "color-mix(in srgb, var(--good) 8%, transparent)",
              borderRadius: "0 8px 8px 0", padding: "10px 12px",
            }}>
              <div style={{ font: "10px var(--font-mono)", color: "var(--good)", letterSpacing: 1, marginBottom: 5 }}>
                NEED A LINE? TRY
              </div>
              <div style={{ font: "italic 12.5px/1.55 var(--font-sans)", color: "var(--dim)" }}>"{s.opener}"</div>
            </div>
          )}
        </div>

        {/* main stage */}
        <div style={{ display: "grid", gridTemplateRows: "60px 1fr 132px", minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 24px", borderBottom: "1px solid var(--line)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
                animation: "dvBlink 1s infinite",
              }} />
              <span style={{ font: "600 11px var(--font-mono)", color: "var(--accent)", letterSpacing: 1 }}>
                {status === "ringing" ? "CALLING" : "CONNECTING"}
              </span>
              {status === "ringing" && (
                <span style={{ font: "14px var(--font-mono)", color: "var(--muted)" }}>{fmt(elapsed)}</span>
              )}
            </div>
          </div>

          {status === "connecting" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
              <Portrait persona={persona} ringColor="var(--good)" dim />
              <div style={{ textAlign: "center" }}>
                <div style={{ font: "400 30px var(--font-serif)", color: "var(--text)" }}>
                  Connecting to {persona.name.split(" ")[0]}…
                </div>
                <div style={{ font: "13px var(--font-sans)", color: "var(--muted)", marginTop: 4 }}>
                  Getting the line ready — this takes a second
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 340 }}>
                <ChecklistRow label="Microphone ready" done={micReady} />
                <ChecklistRow label="Secure link established" done={linkReady} />
                <ChecklistRow label="Bringing live analysis online…" done={analysisReady} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <Portrait persona={persona} ringColor="var(--accent)" />
              <div style={{ textAlign: "center" }}>
                <div style={{ font: "400 34px var(--font-serif)", color: "var(--text)" }}>{persona.name}</div>
                <div style={{ font: "13px var(--font-sans)", color: "var(--muted)", marginTop: 3 }}>
                  {persona.title} · {persona.company}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ font: "14px var(--font-sans)", color: "var(--accent)" }}>Ringing…</span>
                <div style={{
                  display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--line-strong)",
                  borderRadius: 20, padding: "5px 12px", background: "var(--panel2)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 12 }}>
                    {[0, 0.3, 0.15].map((delay, i) => (
                      <span key={i} style={{
                        width: 2.5, height: "100%", background: "var(--accent)", borderRadius: 2,
                        transformOrigin: "bottom", animation: `dvWave .9s ease-in-out infinite`, animationDelay: `${delay}s`,
                      }} />
                    ))}
                  </div>
                  <span style={{ font: "10px var(--font-mono)", color: "var(--muted)", letterSpacing: 1 }}>RING TONE</span>
                </div>
              </div>
            </div>
          )}

          <div style={{
            borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <button onClick={onCancel} style={{
              width: 64, height: 64, borderRadius: "50%", background: "var(--bad)",
              border: "none", color: "#fff", font: "12px var(--font-sans)", cursor: "pointer",
            }}>
              Cancel
            </button>
            {status === "ringing" && (
              <span style={{ font: "11px var(--font-sans)", color: "var(--muted)" }}>
                Tip: headphones give the cleanest read on your delivery.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Portrait({ persona, ringColor, dim }: { persona: PublicPersona; ringColor: string; dim?: boolean }) {
  return (
    <div style={{ position: "relative", width: 190, height: 190, display: "grid", placeItems: "center", opacity: dim ? 0.75 : 1 }}>
      {[0, 0.66, 1.33].map((delay, i) => (
        <div key={i} style={{
          position: "absolute", inset: 20, borderRadius: "50%", border: `2px solid ${ringColor}`,
          animation: "dvRing 2s ease-out infinite", animationDelay: `${delay}s`,
        }} />
      ))}
      <div style={{
        width: 140, height: 140, borderRadius: "50%",
        background: "linear-gradient(150deg, var(--line-strong), var(--line))",
        border: "1px solid var(--line-strong)", display: "grid", placeItems: "center",
        font: "400 52px var(--font-serif)", color: "var(--text)",
      }}>
        {initials(persona.name)}
      </div>
    </div>
  );
}

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11, background: "var(--panel2)",
      border: `1px solid ${done ? "var(--line-strong)" : "var(--accent)"}`, borderRadius: 10, padding: "11px 14px",
    }}>
      {done ? (
        <span style={{
          width: 18, height: 18, borderRadius: "50%", background: "var(--good)", color: "var(--bg)",
          display: "grid", placeItems: "center", font: "11px var(--font-sans)", fontWeight: 700,
        }}>
          ✓
        </span>
      ) : (
        <span style={{
          width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--accent)",
          animation: "dvBlink 1s infinite",
        }} />
      )}
      <span style={{ font: "13px var(--font-sans)", color: done ? "var(--dim)" : "var(--text)", flex: 1 }}>{label}</span>
    </div>
  );
}
