import { foregroundFor } from "@/components/branding-provider";
import { LayoutDashboard, Users, MapPin, Bell, Search, Globe2, LogOut } from "lucide-react";

type Mode = "default" | "from_logo" | "custom";

export function BrandingPreview({
  logoUrl,
  mode,
  primary,
  accent,
  sidebar,
}: {
  logoUrl: string | null;
  mode: Mode;
  primary: string;
  accent: string;
  sidebar: string;
}) {
  // Fall back to Orbis defaults when in default mode
  const p = mode === "default" ? "#26314f" : primary;
  const a = mode === "default" ? "#c9a34a" : accent;
  const s = mode === "default" ? "#1e2545" : mode === "custom" ? sidebar : p;

  const oklchToCss = (v: string) => v; // foregroundFor returns oklch(...) which works as CSS color
  const pf = oklchToCss(foregroundFor(p));
  const af = oklchToCss(foregroundFor(a));
  const sf = oklchToCss(foregroundFor(s));

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Live preview (unsaved)</div>
        <div className="flex items-center gap-1.5">
          <Swatch label="Primary" color={p} />
          <Swatch label="Accent" color={a} />
          <Swatch label="Sidebar" color={s} />
        </div>
      </div>

      {/* App shell mock */}
      <div className="grid grid-cols-[160px_1fr] rounded-md overflow-hidden border bg-background shadow-sm min-h-[340px]">
        {/* Sidebar */}
        <div style={{ background: s, color: sf }} className="flex flex-col">
          {/* Top: Orbis lockup (fixed) */}
          <div className="flex items-center gap-2 px-3 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ background: a, color: af }}>
              <Globe2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold truncate" style={{ color: a }}>Orbis CRM</div>
              <div className="text-[9px] opacity-70 truncate">The IO Buddy</div>
            </div>
          </div>
          {/* Nav */}
          <div className="flex-1 p-2 flex flex-col gap-1">
            <NavItem icon={<LayoutDashboard className="h-3 w-3" />} label="Dashboard" active accent={a} accentFg={af} />
            <NavItem icon={<Users className="h-3 w-3" />} label="Agents" />
            <NavItem icon={<MapPin className="h-3 w-3" />} label="Trips" />
          </div>
          {/* Bottom: uploaded logo above logout */}
          {logoUrl && (
            <div className="px-3 pt-3 pb-2 flex justify-center">
              <div className="bg-white/95 rounded p-1.5 w-full flex items-center justify-center">
                <img src={logoUrl} alt="" className="max-h-10 max-w-full object-contain" />
              </div>
            </div>
          )}
          <div className="border-t px-3 py-2 flex items-center gap-1.5 text-[10px] opacity-80" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <LogOut className="h-3 w-3" />
            <span>Log out</span>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-background">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="h-5 flex-1 max-w-[140px] rounded bg-muted" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Bell className="h-3.5 w-3.5" style={{ color: p }} />
                <span
                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
                  style={{ background: a }}
                />
              </div>
              <div
                className="h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: p, color: pf }}
              >
                RA
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-3 space-y-2.5 flex-1">
            <div className="text-xs font-semibold">Good afternoon, Ramy</div>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Agents" value="42" tint={p} tintFg={pf} />
              <StatCard label="Schools" value="18" tint={a} tintFg={af} />
            </div>

            <div className="rounded border p-2">
              <div className="text-[10px] font-medium mb-1.5">Next trip · Riyadh</div>
              <div className="flex gap-1.5">
                <button
                  className="h-6 px-2 rounded text-[10px] font-medium"
                  style={{ background: p, color: pf }}
                >
                  View itinerary
                </button>
                <button
                  className="h-6 px-2 rounded text-[10px] font-medium border"
                  style={{ borderColor: a, color: a }}
                >
                  Add activity
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon, label, active, accent, accentFg,
}: {
  icon: React.ReactNode; label: string; active?: boolean; accent?: string; accentFg?: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px]"
      style={active ? { background: accent, color: accentFg } : undefined}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({ label, value, tint, tintFg }: { label: string; value: string; tint: string; tintFg: string }) {
  return (
    <div className="rounded border overflow-hidden">
      <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide" style={{ background: tint, color: tintFg }}>
        {label}
      </div>
      <div className="px-2 py-1.5 text-sm font-bold">{value}</div>
    </div>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-3.5 w-3.5 rounded border" style={{ background: color }} title={label} />
      <span className="text-[9px] font-mono text-muted-foreground">{color.toUpperCase()}</span>
    </div>
  );
}
