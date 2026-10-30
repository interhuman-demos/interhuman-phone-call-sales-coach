import type { DebriefResponse, HealthSample, Probability, SignalSpan, SignalType, TranscriptSegment } from "../contract";
import Sparkline from "./Sparkline";
import SkillRadar from "./SkillRadar";

interface Props {
  data?: DebriefResponse;      // undefined while the coach is still writing
  error?: string;
  samples: HealthSample[];
  log: SignalSpan[];
  transcript: TranscriptSegment[];
  durationSec: number;
  personaName?: string;
  productName?: string;
  onRestart: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

const PROB_VALUE: Record<Probability, number> = { low: 30, medium: 60, high: 90 };
const SPARKLINE_TYPES: { type: SignalType; label: string; positive: boolean }[] = [
  { type: "interest", label: "Interest", positive: true },
  { type: "confidence", label: "Confidence", positive: true },
  { type: "hesitation", label: "Hesitation", positive: false },
];

const TAG_COLOR: Record<string, string> = {
  "objection handled": "var(--good)",
  "strong close": "var(--good)",
  "watch out": "var(--bad)",
  neutral: "var(--muted)",
};

function talkRatio(transcript: TranscriptSegment[]) {
  let rep = 0, buyer = 0;
  for (const seg of transcript) {
    const dur = Math.max(0, seg.end - seg.start);
    if (seg.speaker === 0) rep += dur; else buyer += dur;
  }
  const total = rep + buyer;
  if (total <= 0) return { repPct: 50, buyerPct: 50 };
  return { repPct: Math.round((rep / total) * 100), buyerPct: Math.round((buyer / total) * 100) };
}

function pace(transcript: TranscriptSegment[]) {
  let words = 0, seconds = 0;
  for (const seg of transcript) {
    if (seg.speaker !== 0) continue;
    words += seg.text.trim().split(/\s+/).filter(Boolean).length;
    seconds += Math.max(0, seg.end - seg.start);
  }
  return seconds > 0 ? Math.round(words / (seconds / 60)) : 0;
}

function signalSeries(log: SignalSpan[], type: SignalType): number[] {
  return log.filter((s) => s.signal_type === type).map((s) => PROB_VALUE[s.probability ?? "medium"]);
}

const card: React.CSSProperties = {
  background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 18,
};
const label: React.CSSProperties = {
  margin: "0 0 10px", font: "10px var(--font-mono)", letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase",
};

/** Post-call summary and coaching — mock 7a/7b. */
export default function Debrief({ data, error, samples, log, transcript, durationSec, personaName, productName, onRestart }: Props) {
  const scoreColor = !data ? "var(--muted)" : data.score >= 60 ? "var(--good)" : data.score >= 45 ? "var(--warn)" : "var(--bad)";
  const { repPct, buyerPct } = talkRatio(transcript);
  const wpm = pace(transcript);
  const objections = data?.objectionsHandled ?? { handled: 0, raised: 0 };

  return (
    <div style={{ height: "100vh", overflowY: "auto" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 58, borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onRestart} style={{ background: "none", border: "none", color: "var(--muted)", font: "12px var(--font-sans)", cursor: "pointer" }}>
            ← Buyers
          </button>
          <span style={{ width: 1, height: 16, background: "var(--line-strong)" }} />
          <span style={{ font: "600 13px var(--font-sans)", color: "var(--text)" }}>
            Debrief{personaName ? ` · ${personaName}` : ""}{productName ? ` · ${productName}` : ""}
          </span>
        </div>
        <span style={{ font: "12px var(--font-mono)", color: "var(--muted)" }}>call length {fmt(durationSec)}</span>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 32px" }}>
        {!data && !error && <div style={{ ...card, color: "var(--muted)" }}>The coach is reviewing your call…</div>}
        {error && <div style={{ ...card, borderColor: "var(--warn)", color: "var(--warn)" }}>Debrief failed: {error}</div>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* stat row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <div style={card}>
                <div style={label}>Score</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 4 }}>
                  <span style={{ font: "400 36px var(--font-serif)", color: scoreColor }}>{data.score}</span>
                  <span style={{ font: "11px var(--font-sans)", color: "var(--dim)" }}>{data.headline}</span>
                </div>
              </div>
              <div style={card}>
                <div style={label}>Talk ratio</div>
                <div style={{ font: "600 13px var(--font-sans)", color: "var(--text)", margin: "5px 0 6px" }}>
                  You {repPct}% · {personaName ?? "Buyer"} {buyerPct}%
                </div>
                <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${repPct}%`, background: "var(--accent)" }} />
                  <div style={{ width: `${buyerPct}%`, background: "var(--line-strong)" }} />
                </div>
              </div>
              <div style={card}>
                <div style={label}>Your pace</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span style={{ font: "400 26px var(--font-serif)", color: "var(--text)" }}>{wpm}</span>
                  <span style={{ font: "11px var(--font-sans)", color: "var(--good)" }}>wpm</span>
                </div>
              </div>
              <div style={card}>
                <div style={label}>Objections handled</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <span style={{ font: "400 26px var(--font-serif)", color: "var(--good)" }}>{objections.handled}</span>
                  <span style={{ font: "11px var(--font-sans)", color: "var(--dim)" }}>of {objections.raised} raised</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                <div style={card}>
                  <div style={label}>Trajectory over the call</div>
                  <Sparkline samples={samples} height={84} />
                  <div style={{ display: "flex", justifyContent: "space-between", font: "11px var(--font-sans)", color: "var(--muted)", marginTop: 4 }}>
                    <span>0:00</span>
                    <span>{fmt(durationSec)}</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {SPARKLINE_TYPES.map(({ type, label: l, positive }) => {
                    const series = signalSeries(log, type);
                    const last = series[series.length - 1] ?? 0;
                    const color = positive ? "var(--good)" : "var(--bad)";
                    const pts = series.length >= 2
                      ? series.map((v, i) => `${(i / (series.length - 1)) * 100},${28 - (v / 100) * 24 - 2}`).join(" ")
                      : "";
                    return (
                      <div key={type} style={card}>
                        <div style={{ display: "flex", justifyContent: "space-between", font: "11px var(--font-sans)", color: "var(--dim)" }}>
                          <span>{l}</span>
                          <span style={{ color, fontWeight: 600 }}>{last}</span>
                        </div>
                        {pts && (
                          <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: "100%", height: 26, marginTop: 4 }}>
                            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ ...card, maxHeight: 260, overflowY: "auto" }}>
                  <div style={label}>Key moments</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.moments.map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <span style={{ font: "11px var(--font-mono)", color: "var(--muted)", width: 38, flex: "none", paddingTop: 2 }}>
                          {fmt(m.atSec)}
                        </span>
                        <p style={{ margin: 0, flex: 1, font: "12.5px/1.5 var(--font-sans)", color: "var(--text)" }}>{m.detail}</p>
                        <span style={{
                          flex: "none", font: "10px var(--font-sans)", color: TAG_COLOR[m.tag] ?? "var(--muted)",
                          border: `1px solid ${TAG_COLOR[m.tag] ?? "var(--muted)"}`, borderRadius: 20, padding: "3px 10px",
                        }}>
                          {m.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                <div style={card}>
                  <div style={label}>Skill breakdown</div>
                  <SkillRadar scores={data.skillScores} />
                </div>
                <div style={{ ...card, flex: 1, overflowY: "auto" }}>
                  <div style={label}>Coaching notes</div>
                  <ul style={{ margin: 0, paddingLeft: 16, font: "12px/1.65 var(--font-sans)", color: "var(--dim)" }}>
                    {data.strengths.map((s, i) => <li key={`s${i}`}>{s}</li>)}
                    {data.improvements.map((s, i) => <li key={`i${i}`}>{s}</li>)}
                    <li>{data.drill}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "6px 0 20px" }}>
              <button onClick={onRestart} style={{
                height: 40, padding: "0 20px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line-strong)",
                background: "none", color: "var(--dim)", font: "600 13px var(--font-sans)", cursor: "pointer",
              }}>
                Try again
              </button>
              <button onClick={onRestart} style={{
                height: 40, padding: "0 22px", borderRadius: "var(--radius-sm)", background: "var(--accent)",
                color: "var(--accent-text)", border: "none", font: "600 13px var(--font-sans)", cursor: "pointer",
              }}>
                Next buyer →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
