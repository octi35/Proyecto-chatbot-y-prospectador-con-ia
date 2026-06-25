const COLORS = ["#3b82f6","#8b5cf6","#ec4899","#10b981","#f59e0b","#6366f1","#ef4444","#14b8a6"];

export function makeAvatarUrl(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "?";
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="26" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="white" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
