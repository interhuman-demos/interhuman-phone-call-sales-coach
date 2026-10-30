/**
 * Custom-scenario persistence — one JSON doc in Vercel Blob, shared by every
 * visitor. Not a database: last-write-wins, fine for a demo's volume of
 * "create your own scenario" submissions.
 *
 * IMPORTANT: don't overwrite a fixed pathname. Verified empirically
 * (2026-07-16): `list()` is strongly consistent (reflects a write
 * immediately), but fetching the SAME public blob URL after an
 * `allowOverwrite` PUT can keep serving a stale CDN-cached copy for a while
 * — `cacheControlMaxAge: 0` on put() did not fix it. Instead, every write
 * gets a fresh, never-before-requested URL (nothing stale to serve), and
 * reads use `list()` to find the newest one. The previous blob is deleted
 * best-effort so the store doesn't grow unbounded.
 *
 * Env: BLOB_READ_WRITE_TOKEN (auto-set once a Blob store is connected to the
 * Vercel project; for local dev, `vercel env pull` or copy into web/.env).
 */
import { put, list, del } from "@vercel/blob";
import type { Persona } from "../../src/personas.js";

const PREFIX = "custom-personas-";

async function latestBlob() {
  const { blobs } = await list({ prefix: PREFIX });
  if (blobs.length === 0) return undefined;
  return blobs.reduce((a, b) => (a.uploadedAt > b.uploadedAt ? a : b));
}

export async function listCustomPersonas(): Promise<Persona[]> {
  const found = await latestBlob();
  if (!found) return [];
  const res = await fetch(found.url, { cache: "no-store" });
  if (!res.ok) return [];
  try {
    return (await res.json()) as Persona[];
  } catch {
    return [];
  }
}

export async function appendCustomPersona(persona: Persona): Promise<void> {
  const previous = await latestBlob();
  const existing = previous ? await listCustomPersonas() : [];
  const next = [...existing, persona];
  await put(`${PREFIX}${Date.now()}.json`, JSON.stringify(next), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  if (previous) void del(previous.url).catch(() => {}); // best-effort cleanup, never blocks the write
}

export async function findCustomPersona(id: string): Promise<Persona | undefined> {
  const all = await listCustomPersonas();
  return all.find((p) => p.id === id);
}
