export function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === "Ahora") return "Ahora";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // not a parseable date, return as-is
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "Ahora";
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)} h`;
  if (secs < 86400 * 7) return `hace ${Math.floor(secs / 86400)} días`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
