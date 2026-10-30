import type { SignalSpan } from "../contract";

interface Props {
  log: SignalSpan[];
  /** Right edge of the time axis, in seconds since call start. */
  nowSec: number;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

/** Session timeline: one lane per signal type, bars for each occurrence. */
export default function Timeline({ log, nowSec }: Props) {
  const types = [...new Set(log.map((s) => s.signal_type))];
  if (types.length === 0) {
    return <div style={{ color: "var(--muted)", font: "12.5px var(--font-sans)" }}>Signal history shows up here.</div>;
  }
  const span = Math.max(nowSec, 30);

  return (
    <div>
      {types.map((type) => {
        const spans = log.filter((s) => s.signal_type === type);
        const color = spans[0].positive ? "var(--good)" : "var(--bad)";
        return (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{
              width: 88, minWidth: 88, font: "10px var(--font-mono)", color: "var(--muted)", textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {type}
            </span>
            <div style={{
              flex: 1, position: "relative", height: 9, borderRadius: 5,
              background: "var(--line)", overflow: "hidden",
            }}>
              {spans.map((s, i) => (
                <div key={i} style={{
                  position: "absolute", top: 0, bottom: 0, borderRadius: 5,
                  left: `${(s.startSec / span) * 100}%`,
                  width: `${Math.max((((s.endSec ?? nowSec) - s.startSec) / span) * 100, 1.5)}%`,
                  background: color,
                  opacity: s.probability === "high" ? 0.95 : s.probability === "low" ? 0.4 : 0.65,
                }} />
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", font: "10px var(--font-mono)", color: "var(--muted)", marginLeft: 96 }}>
        <span>0:00</span>
        <span>{fmt(span)}</span>
      </div>
    </div>
  );
}
