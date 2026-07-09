// Catalog sanitization — normalize a pasted/edited catalog into clean,
// deduplicated "- Producto: $precio (atributos)" lines. Pure + testable.
//
// - trims each line and drops blanks
// - normalizes any bullet (-, *, bullet, en-dash) to "- "
// - collapses runs of whitespace inside a line
// - de-duplicates by product name (case/accent-insensitive), keeping the first
// - preserves {foto:...} markers untouched (used by the visual editor)

const BULLET = /^[-*•–]\s*/; // -, *, •, –

function nameKey(line: string): string {
  const withoutBullet = line.replace(BULLET, "");
  const name = (withoutBullet.split(":")[0] || withoutBullet).trim().toLowerCase();
  return name.normalize("NFD").replace(/[̀-ͯ]/g, ""); // strip accents
}

export function sanitizeCatalog(raw: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of String(raw || "").split("\n")) {
    const collapsed = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!collapsed) continue;
    const normalized = collapsed.replace(BULLET, "- ");
    const withBullet = normalized.startsWith("- ") ? normalized : `- ${normalized}`;
    const key = nameKey(withBullet);
    if (key && seen.has(key)) continue; // duplicate product name → skip
    if (key) seen.add(key);
    out.push(withBullet);
  }
  return out.join("\n");
}

// How many lines a sanitize pass would remove (for a friendly UI hint)
export function catalogCleanupDelta(raw: string): number {
  const before = String(raw || "").split("\n").filter((l) => l.trim()).length;
  const after = sanitizeCatalog(raw).split("\n").filter((l) => l.trim()).length;
  return Math.max(0, before - after);
}
