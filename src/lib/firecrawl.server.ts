// Firecrawl REST helpers — server only.
const BASE = "https://api.firecrawl.dev/v2";

function key() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY not configured");
  return k;
}

async function call(path: string, body: any, timeoutMs = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `Firecrawl ${path} ${res.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

export async function fcMap(url: string, opts?: { search?: string; limit?: number }) {
  return call("/map", { url, search: opts?.search, limit: opts?.limit ?? 50 });
}

export async function fcScrape(url: string, opts?: { formats?: string[]; onlyMainContent?: boolean }) {
  return call("/scrape", {
    url,
    formats: opts?.formats ?? ["markdown"],
    onlyMainContent: opts?.onlyMainContent ?? true,
  });
}

export async function fcSearch(query: string, opts?: { limit?: number; scrape?: boolean }) {
  return call("/search", {
    query,
    limit: opts?.limit ?? 5,
    ...(opts?.scrape ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
  });
}
