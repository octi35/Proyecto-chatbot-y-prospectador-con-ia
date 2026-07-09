// ---------------------------------------------------------------------------
// Pure helpers shared by server.ts — extracted so they can be unit-tested.
// ---------------------------------------------------------------------------
import crypto from "crypto";

// Verify a Meta webhook signature (X-Hub-Signature-256) against the RAW request
// body. Meta signs the exact bytes it sent, so we must HMAC the raw buffer, not
// a re-serialized object. Uses timingSafeEqual to avoid timing attacks and to
// safely handle length mismatches.
export function verifyMetaSignature(rawBody: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!secret) return true;               // no secret configured → skip (dev)
  if (!signatureHeader) return false;     // secret set but no signature → reject
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

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

// Normalize a phone number for the Meta Cloud API, which expects digits only
// (country code included, no "+", spaces, dashes or parentheses). Argentine
// mobiles are commonly written "+54 9 11 1234-5678" → "5491112345678".
export function normalizePhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

// True if the lead wrote to us within the last 24h (Meta free-form window)
export function isInside24hWindow(conversationHistory: any[], now: number = Date.now()): boolean {
  const lastUser = [...(conversationHistory || [])].reverse().find((m: any) => m.role === "user" && m.timestamp);
  if (!lastUser) return false;
  return now - new Date(lastUser.timestamp).getTime() < 24 * 60 * 60 * 1000;
}
