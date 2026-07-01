/**
 * Return the URL only if its scheme is http(s). Otherwise return null.
 * Prevents `javascript:`, `data:`, `vbscript:`, etc. from ever being
 * rendered as an anchor `href`.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const u = new URL(trimmed, base);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}
