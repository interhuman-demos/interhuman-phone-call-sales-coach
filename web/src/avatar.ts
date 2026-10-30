/** Initials for a buyer's monogram avatar — no real photos, so this stands in for one. */
export function initials(name: string): string {
  return name.replace(/^Dr\. /, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
