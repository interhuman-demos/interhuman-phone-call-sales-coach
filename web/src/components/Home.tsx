import { useState } from "react";
import type { PublicPersona } from "../personas";
import { initials } from "../avatar";

interface Props {
  personas: PublicPersona[];
  onCall: (id: string) => void;
  onNewScenario: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

const diffColor = (d: PublicPersona["difficulty"]) =>
  d === "easy" ? "var(--good)" : d === "hard" ? "var(--bad)" : "var(--accent)";

/** Home / buyer picker — mock 5a/5b. Pick a buyer to call, or start a custom scenario. */
export default function Home({ personas, onCall, onNewScenario, theme, onToggleTheme }: Props) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  const q = query.trim().toLowerCase();
  const filtered = personas.filter((p) => {
    if (difficulty !== "all" && p.difficulty !== difficulty) return false;
    if (!q) return true;
    return [p.name, p.company, p.tagline, p.scenario.product].some((s) => s.toLowerCase().includes(q));
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 30px", height: 64, borderBottom: "1px solid var(--line)", flex: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)" }} />
          <span style={{ font: "600 13px var(--font-sans)", color: "var(--text)" }}>Pitch Practice</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <span style={{ font: "12px var(--font-sans)", color: "var(--muted)" }}>History</span>
          <span style={{ font: "12px var(--font-sans)", color: "var(--muted)" }}>Library</span>
          <button onClick={onToggleTheme} title="Toggle theme" style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--panel)",
            border: "1px solid var(--line)", color: "var(--dim)", cursor: "pointer", fontSize: 14,
          }}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <span style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--panel)",
            border: "1px solid var(--line)", display: "grid", placeItems: "center",
            font: "600 11px var(--font-sans)", color: "var(--dim)",
          }}>
            YOU
          </span>
        </div>
      </header>

      <div style={{ padding: "34px 36px 0", flex: "none" }}>
        <div style={{ font: "600 10px var(--font-mono)", letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase" }}>
          Today
        </div>
        <h1 style={{ font: "400 34px var(--font-serif)", color: "var(--text)", margin: "8px 0 4px" }}>
          Who are you calling?
        </h1>
        <p style={{ font: "13.5px var(--font-sans)", color: "var(--muted)", margin: "0 0 22px" }}>
          {personas.length} brief{personas.length === 1 ? "" : "s"} ready · pick up where you left off or start fresh
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buyers or products…"
            style={{
              flex: 1, height: 42, border: "1px solid var(--line)", background: "var(--panel)",
              borderRadius: "var(--radius-sm)", padding: "0 14px", font: "13px var(--font-sans)",
              color: "var(--text)", outline: "none",
            }}
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            style={{
              height: 42, padding: "0 14px", border: "1px solid var(--line)", background: "var(--panel)",
              borderRadius: "var(--radius-sm)", font: "12px var(--font-sans)", color: "var(--dim)", cursor: "pointer",
            }}
          >
            <option value="all">All difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", padding: "0 36px 30px",
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignContent: "start",
      }}>
        {filtered.map((p) => (
          <div key={p.id} style={{
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
            padding: 18, display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(150deg, var(--line-strong), var(--line))",
                display: "grid", placeItems: "center", font: "400 20px var(--font-serif)", color: "var(--text)",
                flex: "none",
              }}>
                {initials(p.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "600 14px var(--font-sans)", color: "var(--text)" }}>{p.name}</div>
                <div style={{ font: "11px var(--font-sans)", color: "var(--muted)" }}>{p.title} · {p.company}</div>
              </div>
            </div>
            <div style={{ font: "12px/1.5 var(--font-sans)", color: "var(--dim)" }}>{p.scenario.product}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <span style={{
                font: "10px var(--font-mono)", color: diffColor(p.difficulty),
                border: `1px solid ${diffColor(p.difficulty)}`, borderRadius: 20, padding: "3px 9px",
              }}>
                {p.difficulty}
              </span>
              <button onClick={() => onCall(p.id)} style={{
                height: 32, padding: "0 16px", borderRadius: 16, background: "var(--accent)",
                color: "var(--accent-text)", border: "none", font: "600 12px var(--font-sans)", cursor: "pointer",
              }}>
                Call →
              </button>
            </div>
          </div>
        ))}
        <button onClick={onNewScenario} style={{
          border: "1.5px dashed var(--line-strong)", borderRadius: "var(--radius-md)", background: "none",
          padding: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, minHeight: 120, cursor: "pointer",
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: "50%", border: "1.5px solid var(--accent)", color: "var(--accent)",
            font: "400 20px var(--font-sans)", display: "grid", placeItems: "center",
          }}>
            +
          </span>
          <span style={{ font: "600 13px var(--font-sans)", color: "var(--text)" }}>New scenario</span>
          <span style={{ font: "11px var(--font-sans)", color: "var(--muted)", textAlign: "center" }}>
            Build a custom buyer &amp; brief
          </span>
        </button>
      </div>
    </div>
  );
}
