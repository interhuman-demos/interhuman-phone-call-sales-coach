import { useState } from "react";
import type { PublicPersona } from "../personas";
import type { CustomScenarioRequest, GenerateScenarioResponse } from "../contract";

interface Props {
  onClose: () => void;
  onCreated: (persona: PublicPersona) => void;
}

const PERSONALITY_OPTIONS = ["Skeptical", "Friendly", "Budget-conscious", "Time-pressed", "Detail-oriented"];

const EMPTY: CustomScenarioRequest = {
  name: "", title: "", company: "", industry: "",
  icpNotes: "", product: "", sellingPoints: ["", "", ""], price: "",
  difficulty: "medium", personalityTags: ["Skeptical"],
};

/** "New scenario" — your own ICP + product, stored server-side so every
 * visitor sees it in the picker (see api/custom-personas.ts). Mock 6a/6b. */
export default function ScenarioForm({ onClose, onCreated }: Props) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [form, setForm] = useState<CustomScenarioRequest>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string>();

  function set<K extends keyof CustomScenarioRequest>(key: K, value: CustomScenarioRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      personalityTags: f.personalityTags.includes(tag)
        ? f.personalityTags.filter((t) => t !== tag)
        : [...f.personalityTags, tag],
    }));
  }

  async function generate() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGenerateError(undefined);
    try {
      const res = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { draft } = (await res.json()) as GenerateScenarioResponse;
      setForm({
        ...draft,
        sellingPoints: [draft.sellingPoints[0] ?? "", draft.sellingPoints[1] ?? "", draft.sellingPoints[2] ?? ""],
        personalityTags: draft.personalityTags.length > 0 ? draft.personalityTags : ["Skeptical"],
      });
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/custom-personas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          sellingPoints: form.sellingPoints.map((p) => p.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { persona } = (await res.json()) as { persona: PublicPersona };
      onCreated(persona);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const valid = form.name && form.title && form.company && form.industry &&
    form.icpNotes && form.product && form.price && form.sellingPoints.some((p) => p.trim());

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 20,
      display: "grid", placeItems: "center", padding: 24,
    }}>
      <div style={{
        width: "min(660px, 100%)", maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column",
        background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-shell)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: "1px solid var(--line)", flex: "none",
        }}>
          <div style={{ font: "400 21px var(--font-serif)", color: "var(--text)" }}>New scenario</div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer",
          }}>
            ✕
          </button>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 6, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 4 }}>
            {(["ai", "manual"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: mode === m ? "var(--panel2)" : "none",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,.2)" : "none",
                color: mode === m ? "var(--text)" : "var(--muted)",
                font: `${mode === m ? 600 : 400} 12px var(--font-sans)`,
              }}>
                {m === "ai" ? "✨ Describe it, I'll fill it in" : "Fill in manually"}
              </button>
            ))}
          </div>

          {mode === "ai" && (
            <div>
              <FieldLabel>Tell us about the call</FieldLabel>
              <TextArea
                value={aiPrompt}
                onChange={setAiPrompt}
                placeholder="A skeptical CFO at a 300-person manufacturer, hard to reach, wants to cut AP processing costs but burned by a bad ERP rollout last year. I'm pitching LedgerSync at $1,900/mo."
                rows={4}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  onClick={() => void generate()}
                  disabled={!aiPrompt.trim() || generating}
                  style={{
                    height: 36, padding: "0 18px", borderRadius: "var(--radius-sm)", background: "var(--accent)",
                    color: "var(--accent-text)", border: "none", font: "600 12.5px var(--font-sans)",
                    cursor: !aiPrompt.trim() || generating ? "not-allowed" : "pointer",
                    opacity: !aiPrompt.trim() || generating ? 0.6 : 1,
                  }}
                >
                  {generating ? "Generating…" : "✨ Generate scenario"}
                </button>
              </div>
              {generateError && <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 8 }}>{generateError}</div>}
              <div style={{
                borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 14,
                font: "10px var(--font-mono)", letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase",
              }}>
                AI filled this in — review &amp; edit
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Buyer</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input value={form.name} onChange={(v) => set("name", v)} placeholder="Name" />
              <Input value={form.title} onChange={(v) => set("title", v)} placeholder="Title, e.g. VP Operations" />
            </div>
            <Input value={form.company} onChange={(v) => set("company", v)} placeholder="Company" style={{ marginTop: 10 }} />
            <Input value={form.industry} onChange={(v) => set("industry", v)} placeholder="Industry, e.g. B2B SaaS" style={{ marginTop: 10 }} />
          </div>

          <div>
            <FieldLabel>The pitch</FieldLabel>
            <Input value={form.product} onChange={(v) => set("product", v)} placeholder="Product / service name — one line" />
            <TextArea
              value={form.icpNotes}
              onChange={(v) => set("icpNotes", v)}
              placeholder={"What are you selling, and why does it matter to this buyer? Pain points, current process/stack, budget & who approves it."}
              rows={3}
              style={{ marginTop: 10 }}
            />
            {form.sellingPoints.map((p, i) => (
              <Input
                key={i}
                value={p}
                onChange={(v) => set("sellingPoints", form.sellingPoints.map((x, j) => (j === i ? v : x)))}
                placeholder={`Selling point ${i + 1}`}
                style={{ marginTop: 10 }}
              />
            ))}
            <Input value={form.price} onChange={(v) => set("price", v)} placeholder="Price / terms" style={{ marginTop: 10 }} />
          </div>

          <div>
            <FieldLabel>Personality</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PERSONALITY_OPTIONS.map((tag) => {
                const active = form.personalityTags.includes(tag);
                return (
                  <button key={tag} onClick={() => toggleTag(tag)} style={{
                    border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                    background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "none",
                    color: active ? "var(--accent)" : "var(--dim)",
                    borderRadius: 20, font: "11.5px var(--font-sans)", padding: "6px 13px", cursor: "pointer",
                  }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Difficulty</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {(["easy", "medium", "hard"] as const).map((d) => {
                const active = form.difficulty === d;
                const color = d === "easy" ? "var(--good)" : d === "hard" ? "var(--bad)" : "var(--accent)";
                return (
                  <button key={d} onClick={() => set("difficulty", d)} style={{
                    flex: 1, textAlign: "center", padding: "9px 0", borderRadius: "var(--radius-sm)",
                    border: `1px solid ${color}`, background: active ? color : "none",
                    color: active ? "var(--accent-text)" : color,
                    font: "600 12px var(--font-sans)", cursor: "pointer", textTransform: "capitalize",
                  }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div style={{ color: "var(--bad)", fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--line)", display: "flex",
          justifyContent: "flex-end", gap: 10, flex: "none",
        }}>
          <button onClick={onClose} style={{
            height: 38, padding: "0 18px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)",
            color: "var(--dim)", background: "none", font: "12.5px var(--font-sans)", cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!valid || submitting} style={{
            height: 38, padding: "0 20px", borderRadius: "var(--radius-sm)", background: "var(--accent)",
            color: "var(--accent-text)", border: "none", font: "600 12.5px var(--font-sans)",
            cursor: valid && !submitting ? "pointer" : "not-allowed", opacity: valid && !submitting ? 1 : 0.6,
          }}>
            {submitting ? "Creating…" : "Save & call →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: "10px var(--font-mono)", letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 12px", font: "13px var(--font-sans)", color: "var(--text)",
  background: "var(--panel2)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)",
  boxSizing: "border-box",
};

function Input({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, ...style }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows: number; style?: React.CSSProperties;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, height: "auto", padding: "10px 12px", lineHeight: 1.6, resize: "vertical", ...style }}
    />
  );
}
