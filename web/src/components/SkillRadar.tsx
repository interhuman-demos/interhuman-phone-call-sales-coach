import type { SkillScores } from "../contract";

const AXES: { key: keyof SkillScores; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "listening", label: "Listening" },
  { key: "valueFraming", label: "Value framing" },
  { key: "objectionHandling", label: "Objections" },
  { key: "closing", label: "Closing" },
];

const CX = 150, CY = 130, MAX_R = 85;
const angleFor = (i: number) => (-90 + i * (360 / AXES.length)) * (Math.PI / 180);
const point = (i: number, r: number): [number, number] => {
  const a = angleFor(i);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

/** 5-axis skill radar, generated from real debrief scores (mock 7a/7b). */
export default function SkillRadar({ scores }: { scores: SkillScores }) {
  const dataPoints = AXES.map((ax, i) => point(i, (Math.max(0, Math.min(100, scores[ax.key])) / 100) * MAX_R));

  return (
    <svg viewBox="0 0 320 260" style={{ width: "100%", height: 210, display: "block" }}>
      {[1, 0.66, 0.33].map((lvl) => (
        <polygon
          key={lvl}
          points={AXES.map((_, i) => point(i, MAX_R * lvl).join(",")).join(" ")}
          fill="none" stroke="var(--line)" strokeWidth={1}
        />
      ))}
      <polygon
        points={dataPoints.map((p) => p.join(",")).join(" ")}
        fill="color-mix(in srgb, var(--good) 16%, transparent)"
        stroke="var(--good)" strokeWidth={2}
      />
      {AXES.map((ax, i) => {
        const [lx, ly] = point(i, MAX_R + 26);
        const cos = Math.cos(angleFor(i));
        const anchor = Math.abs(cos) < 0.15 ? "middle" : cos > 0 ? "start" : "end";
        return (
          <text key={ax.key} x={lx} y={ly} textAnchor={anchor} fontSize={11} fill="var(--dim)" fontFamily="var(--font-sans)">
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}
