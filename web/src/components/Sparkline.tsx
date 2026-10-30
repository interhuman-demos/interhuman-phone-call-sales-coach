import type { HealthSample } from "../contract";

interface Props {
  samples: HealthSample[];
  /** Show only the trailing N seconds (rolling window); omit for the whole session. */
  windowSec?: number;
  height?: number;
}

/** Continuously-moving call-trajectory line. viewBox 300x100, y = 100 - score. */
export default function Sparkline({ samples, windowSec, height = 48 }: Props) {
  const last = samples[samples.length - 1];
  const tEnd = last?.t ?? 0;
  const tStart = windowSec !== undefined
    ? Math.max(samples[0]?.t ?? 0, tEnd - windowSec)
    : samples[0]?.t ?? 0;
  const visible = samples.filter((s) => s.t >= tStart);
  const span = Math.max(tEnd - tStart, 5); // don't cramp the first seconds — grow into the window
  const x = (t: number) => ((t - tStart) / span) * 300;
  const pts = visible.map((s) => `${x(s.t).toFixed(1)},${(100 - s.score).toFixed(1)}`);
  const color = !last ? "var(--muted)" : last.score >= 60 ? "var(--good)" : last.score >= 45 ? "var(--warn)" : "var(--bad)";

  return (
    <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      {/* neutral line at score 60 */}
      <line x1={0} y1={40} x2={300} y2={40} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 5" />
      {pts.length >= 2 && (
        <>
          <polygon
            points={`${x(visible[0].t).toFixed(1)},100 ${pts.join(" ")} ${x(tEnd).toFixed(1)},100`}
            fill={color}
            opacity={0.1}
          />
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
