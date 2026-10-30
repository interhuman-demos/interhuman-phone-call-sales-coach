import type { PublicPersona } from "../personas";

/** Pure brief content — no modal chrome, so it can be dropped into a browsable
 * pre-call rail AND a persistent in-call notes panel without duplicating copy. */
export default function BriefContent({ persona }: { persona: PublicPersona }) {
  const s = persona.scenario;
  return (
    <div>
      <h3 style={{ margin: "0 0 4px", font: "400 19px var(--font-serif)", color: "var(--text)", fontWeight: 400 }}>
        Selling to {persona.name}
      </h3>
      <div style={{ color: "var(--muted)", font: "12.5px/1.5 var(--font-sans)", marginBottom: 14 }}>{s.product}</div>

      {s.context.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: "10px var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>
            Quick context
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, font: "12.5px/1.65 var(--font-sans)", color: "var(--dim)" }}>
            {s.context.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <div style={{ font: "10px var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>
        Selling points
      </div>
      <ul style={{ margin: "0 0 12px", paddingLeft: 16, font: "12.5px/1.65 var(--font-sans)", color: "var(--dim)" }}>
        {s.sellingPoints.map((p, i) => <li key={i}>{p}</li>)}
      </ul>

      <div style={{ font: "12.5px var(--font-sans)", color: "var(--dim)", marginBottom: 14 }}>
        <b style={{ color: "var(--accent)" }}>Price:</b> {s.price}
      </div>

      {s.opener && (
        <div style={{
          borderLeft: "3px solid var(--good)", background: "color-mix(in srgb, var(--good) 8%, transparent)",
          borderRadius: "0 8px 8px 0", padding: "10px 12px", font: "12.5px var(--font-sans)", marginBottom: 14,
        }}>
          <div style={{ font: "10px var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--good)", marginBottom: 5 }}>
            Need a line? Try
          </div>
          <em style={{ color: "var(--dim)", fontStyle: "italic" }}>"{s.opener}"</em>
        </div>
      )}

      <div style={{ font: "12px var(--font-sans)", color: "var(--muted)", fontStyle: "italic" }}>
        This scenario is optional — {persona.name.split(" ")[0]} answers the phone either
        way, so feel free to pitch your own product instead.
      </div>
    </div>
  );
}
