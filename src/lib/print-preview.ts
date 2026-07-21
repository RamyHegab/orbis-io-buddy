// Shared branded print-preview helper.
// Opens a new window with the given HTML body wrapped in a branded shell
// (university logo + primary colour pulled from app_settings) and triggers
// the browser's native print dialog — user picks "Save as PDF" or prints.
//
// This replaces jsPDF-generated exports which produce inconsistent PDFs.

import { supabase } from "@/integrations/supabase/client";

type BrandingSnapshot = {
  logoUrl: string | null;
  primary: string;
  accent: string;
  orgName: string;
};

let brandingCache: BrandingSnapshot | null = null;

async function loadBranding(): Promise<BrandingSnapshot> {
  if (brandingCache) return brandingCache;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("logo_url, theme_primary, theme_accent")
      .eq("id", 1)
      .maybeSingle();
    brandingCache = {
      logoUrl: data?.logo_url ?? null,
      primary: data?.theme_primary ?? "#1e3a8a",
      accent: data?.theme_accent ?? "#d4a017",
      orgName: "Orbis CRM",
    };
  } catch {
    brandingCache = { logoUrl: null, primary: "#1e3a8a", accent: "#d4a017", orgName: "Orbis CRM" };
  }
  return brandingCache!;
}

export function invalidateBrandingCache() {
  brandingCache = null;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

/** Wrap a body of HTML in the standard branded print shell and open a print preview. */
export async function openPrintPreview(opts: {
  title: string;
  bodyHtml: string;
  subtitle?: string;
  /** Extra CSS to append inside the print shell. */
  extraCss?: string;
}) {
  const branding = await loadBranding();
  const html = renderPrintShell({ ...opts, branding });
  openInNewWindow(html, opts.title);
}

/** Same as openPrintPreview but returns the full HTML string (for saving as a file, etc.). */
export async function renderBrandedHtml(opts: {
  title: string;
  bodyHtml: string;
  subtitle?: string;
  extraCss?: string;
}): Promise<string> {
  const branding = await loadBranding();
  return renderPrintShell({ ...opts, branding });
}

function renderPrintShell(opts: {
  title: string;
  bodyHtml: string;
  subtitle?: string;
  extraCss?: string;
  branding: BrandingSnapshot;
}): string {
  const { title, bodyHtml, subtitle, extraCss, branding } = opts;
  const primary = branding.primary || "#1e3a8a";
  const accent = branding.accent || "#d4a017";
  const logo = branding.logoUrl
    ? `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.orgName)}" crossorigin="anonymous" />`
    : `<div class="logo-fallback">${esc(branding.orgName)}</div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  :root { --primary: ${primary}; --accent: ${accent}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 18mm 16mm;
  }
  .brand-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid var(--primary);
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .brand-bar img { max-height: 56px; max-width: 220px; object-fit: contain; }
  .brand-bar .logo-fallback {
    font-weight: 700; color: var(--primary); font-size: 18px; letter-spacing: 0.5px;
  }
  .brand-bar .meta { font-size: 11px; color: #666; text-align: right; }
  h1 { color: var(--primary); font-size: 22px; margin: 6px 0 4px 0; }
  h2 { color: var(--primary); font-size: 16px; margin: 20px 0 8px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 14px 0 6px 0; }
  p, li, td, th { font-size: 11.5px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: var(--primary); color: #fff; font-weight: 600; }
  a { color: var(--primary); text-decoration: underline; }
  .subtitle { color: #555; font-size: 12px; margin-bottom: 8px; }
  .print-actions {
    position: fixed; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 1000;
  }
  .print-actions button {
    background: var(--primary); color: #fff; border: 0; padding: 8px 14px;
    border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;
  }
  .print-actions button.secondary { background: #6b7280; }
  .field-grid { display: grid; grid-template-columns: 200px 1fr; gap: 6px 14px; margin: 4px 0 12px 0; }
  .field-grid dt { font-weight: 600; color: #444; font-size: 11px; }
  .field-grid dd { margin: 0; font-size: 11.5px; }
  .muted { color: #666; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print {
    .print-actions { display: none !important; }
    .page { padding: 12mm 12mm; }
    thead { display: table-header-group; }
    tr, td, th { page-break-inside: avoid; }
    h2, h3 { page-break-after: avoid; }
  }
  ${extraCss ?? ""}
</style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="page">
    <div class="brand-bar">
      <div>${logo}</div>
      <div class="meta">
        <div>${esc(branding.orgName)}</div>
        <div>${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>
    </div>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
    ${bodyHtml}
    <div class="footer">Generated by ${esc(branding.orgName)} · Orbis CRM</div>
  </div>
</body>
</html>`;
}

function openInNewWindow(html: string, title: string) {
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) {
    // Popup blocked — fall back to blob URL
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the new window a moment to render the logo before print dialog opens.
  const trigger = () => {
    try { w.focus(); } catch { /* ignore */ }
    // Do NOT auto-invoke print — the user clicks the header button. This
    // avoids blocking on cross-origin logo loads and lets them inspect first.
  };
  if (w.document.readyState === "complete") trigger();
  else w.addEventListener("load", trigger);
  try { w.document.title = title; } catch { /* ignore */ }
}
