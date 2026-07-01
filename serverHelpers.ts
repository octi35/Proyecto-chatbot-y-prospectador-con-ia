// ---------------------------------------------------------------------------
// Pure helpers shared by server.ts — extracted so they can be unit-tested.
// ---------------------------------------------------------------------------

// Turn a conversation history into a readable transcript for prompts.
export function formatTranscript(history: { role: string; text: string }[]): string {
  return (history || [])
    .map((m) => `${m.role === "user" ? "Cliente" : "Agente"}: ${m.text}`)
    .join("\n");
}

// Best-effort JSON array extraction from an LLM response.
export function extractJsonArray(text: string): string[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) return arr.map((x) => String(x)).filter(Boolean);
    }
  } catch { /* fall through */ }
  // Fallback: split into lines, stripping bullets/numbering
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s\-\*\d.)]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

// Best-effort JSON object extraction from an LLM response.
export function extractJsonObject(text: string): any | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* ignore */ }
  return null;
}

// True if the lead wrote to us within the last 24h (Meta free-form window)
export function isInside24hWindow(conversationHistory: any[], now: number = Date.now()): boolean {
  const lastUser = [...(conversationHistory || [])].reverse().find((m: any) => m.role === "user" && m.timestamp);
  if (!lastUser) return false;
  return now - new Date(lastUser.timestamp).getTime() < 24 * 60 * 60 * 1000;
}
