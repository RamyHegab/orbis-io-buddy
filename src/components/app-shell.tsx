import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, useCapabilities, type Capability } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Plane,
  FileText,
  Globe2,
  CalendarRange,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderMenu } from "@/components/header-menu";
import { BrandingProvider, useBranding } from "@/components/branding-provider";
import { supabase } from "@/integrations/supabase/client";


type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  requiresCap?: Capability;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/planning", label: "Planning", icon: CalendarRange },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/schools", label: "Schools", icon: GraduationCap },
  { to: "/trips", label: "Trips", icon: Plane },
  { to: "/forms", label: "Forms", icon: FileText },
];

export function AppShell() {
  const { user, loading } = useAuth();
  const { caps } = useCapabilities();
  const branding = useBranding();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }


  return (
   <BrandingProvider>
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gold text-gold-foreground shadow-sm">
            <Globe2 className="h-7 w-7" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-gold">Orbis CRM</div>
            <div className="text-xs text-sidebar-foreground/60">The IO Buddy</div>
          </div>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {navItems
            .filter((i) => !i.requiresCap || caps[i.requiresCap])
            .map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors border-l-2",
                    active
                      ? "border-sidebar-accent-foreground bg-sidebar-accent text-sidebar-accent-foreground"
                      : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
        </nav>
        <div className="flex flex-col items-center px-6 py-4 mt-6">
          {branding?.logo_url ? (
            <div className="w-full flex items-center justify-center">
              <div className="bg-white/95 rounded-md p-3 w-full flex items-center justify-center">
                <img
                  src={branding.logo_url}
                  alt="University logo"
                  className="max-h-16 max-w-full object-contain"
                />
              </div>
            </div>
          ) : null}
          <div className={cn("w-full", branding?.logo_url ? "mt-4" : "")}>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-gold transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">

        <header className="sticky top-0 z-30 flex items-center justify-end gap-2 border-b border-border bg-background/80 backdrop-blur px-4 h-14">
          <HeaderMenu />
        </header>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
   </BrandingProvider>
  );
}

