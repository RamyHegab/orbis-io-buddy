import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Branding = {
  logo_url: string | null;
  logo_path: string | null;
  theme_mode: "default" | "from_logo" | "custom";
  theme_primary: string | null;
  theme_accent: string | null;
  theme_sidebar: string | null;
};

// Convert #rrggbb -> oklch(L C H) using a light-touch conversion.
// We approximate: sRGB -> linear -> XYZ D65 -> OKLab -> OKLCH.
export function hexToOklch(hex: string): string | null {
  const m = hex.trim().replace("#", "");
  if (!/^([0-9a-f]{6})$/i.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  // OKLab from linear sRGB (Björn Ottosson)
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const mm = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(mm), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

// Simple foreground picker for text on a given hex.
export function foregroundFor(hex: string): string {
  const m = hex.replace("#", "");
  if (!/^([0-9a-f]{6})$/i.test(m)) return "oklch(0.22 0.06 260)";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "oklch(0.22 0.06 260)" : "oklch(0.97 0.02 90)";
}

// Mix a hex colour toward white (amount 0..1) or toward black (negative amount).
function mixHex(hex: string, amount: number): string | null {
  const m = hex.replace("#", "");
  if (!/^([0-9a-f]{6})$/i.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + toHex(mix(r)) + toHex(mix(g)) + toHex(mix(b));
}

function applyBranding(b: Branding | null | undefined) {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  const keys = [
    "--primary", "--primary-foreground", "--accent", "--accent-foreground",
    "--sidebar", "--sidebar-foreground", "--sidebar-border", "--sidebar-accent",
    "--ring", "--gold", "--gold-foreground",
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--secondary", "--secondary-foreground",
    "--muted",
  ];
  const clear = () => keys.forEach((k) => root.style.removeProperty(k));
  if (!b || b.theme_mode === "default") {
    clear();
    return;
  }
  const primary = b.theme_primary;
  const accent = b.theme_accent;
  // In "from_logo" mode, derive the sidebar from the primary if not explicitly set.
  const sidebar =
    b.theme_sidebar ??
    (b.theme_mode === "from_logo" && primary ? mixHex(primary, -0.35) : null);
  clear();
  if (primary) {
    const v = hexToOklch(primary);
    if (v) {
      root.style.setProperty("--primary", v);
      root.style.setProperty("--primary-foreground", foregroundFor(primary));
      root.style.setProperty("--ring", v);
    }
    // Tint page background as a very light wash of the primary.
    const bgHex = mixHex(primary, 0.94);
    if (bgHex) {
      const bgV = hexToOklch(bgHex);
      if (bgV) {
        root.style.setProperty("--background", bgV);
        root.style.setProperty("--foreground", foregroundFor(bgHex));
      }
    }
    const cardHex = mixHex(primary, 0.97);
    if (cardHex) {
      const cardV = hexToOklch(cardHex);
      if (cardV) {
        root.style.setProperty("--card", cardV);
        root.style.setProperty("--card-foreground", foregroundFor(cardHex));
        root.style.setProperty("--popover", cardV);
        root.style.setProperty("--popover-foreground", foregroundFor(cardHex));
      }
    }
    const secHex = mixHex(primary, 0.88);
    if (secHex) {
      const secV = hexToOklch(secHex);
      if (secV) {
        root.style.setProperty("--secondary", secV);
        root.style.setProperty("--secondary-foreground", foregroundFor(secHex));
        root.style.setProperty("--muted", secV);
      }
    }
  }
  if (accent) {
    const v = hexToOklch(accent);
    if (v) {
      root.style.setProperty("--accent", v);
      root.style.setProperty("--accent-foreground", foregroundFor(accent));
      root.style.setProperty("--gold", v);
      root.style.setProperty("--gold-foreground", foregroundFor(accent));
    }
  }
  if (sidebar) {
    const v = hexToOklch(sidebar);
    if (v) {
      root.style.setProperty("--sidebar", v);
      root.style.setProperty("--sidebar-foreground", foregroundFor(sidebar));
      const border = mixHex(sidebar, 0.15);
      const sAccent = mixHex(sidebar, 0.2);
      if (border) {
        const bv = hexToOklch(border);
        if (bv) root.style.setProperty("--sidebar-border", bv);
      }
      if (sAccent) {
        const av = hexToOklch(sAccent);
        if (av) root.style.setProperty("--sidebar-accent", av);
      }
    }
  }
}

export function useBranding() {
  const q = useQuery({
    queryKey: ["branding"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Branding> => {
      const { data } = await supabase
        .from("app_settings")
        .select("logo_url, logo_path, theme_mode, theme_primary, theme_accent, theme_sidebar")
        .eq("id", 1)
        .maybeSingle();
      return {
        logo_url: data?.logo_url ?? null,
        logo_path: data?.logo_path ?? null,
        theme_mode: (data?.theme_mode as any) ?? "default",
        theme_primary: data?.theme_primary ?? null,
        theme_accent: data?.theme_accent ?? null,
        theme_sidebar: data?.theme_sidebar ?? null,
      };
    },
  });
  return q.data;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const b = useBranding();
  useEffect(() => {
    applyBranding(b);
  }, [b?.theme_mode, b?.theme_primary, b?.theme_accent, b?.theme_sidebar]);
  return <>{children}</>;
}

// Extract dominant + secondary colour from an <img> element via canvas.
export async function extractPaletteFromImage(url: string): Promise<{ primary: string; accent: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 64;
        const h = Math.max(1, Math.round((img.height / img.width) * 64));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const light = (max + min) / 2;
          if (light > 240 || light < 15) continue; // drop near-white / near-black
          const sat = max === 0 ? 0 : (max - min) / max;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const cur = buckets.get(key);
          if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n++; cur.sat += sat; }
          else buckets.set(key, { r, g, b, n: 1, sat });
        }
        const arr = Array.from(buckets.values())
          .map((v) => ({ r: Math.round(v.r / v.n), g: Math.round(v.g / v.n), b: Math.round(v.b / v.n), n: v.n, sat: v.sat / v.n }))
          .sort((a, b) => b.n * (0.3 + b.sat) - a.n * (0.3 + a.sat));
        if (arr.length === 0) return resolve(null);
        const toHex = (x: { r: number; g: number; b: number }) =>
          "#" + [x.r, x.g, x.b].map((n) => n.toString(16).padStart(2, "0")).join("");
        const primary = arr[0];
        // pick an accent visibly different in hue
        const dist = (a: any, b: any) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
        const accent = arr.slice(1).find((c) => dist(c, primary) > 120) ?? arr[1] ?? primary;
        resolve({ primary: toHex(primary), accent: toHex(accent) });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
