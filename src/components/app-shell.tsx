import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole, useCapabilities, type Capability } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Plane,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Globe2,
  Bell,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  requiresCap?: Capability;
  showCount?: "pending_submissions";
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/schools", label: "Schools", icon: GraduationCap },
  { to: "/trips", label: "Trips", icon: Plane },
  { to: "/inbox", label: "Notifications", icon: Bell, showCount: "pending_submissions" },
  { to: "/forms", label: "Forms", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/users", label: "Users", icon: UserCog, requiresCap: "can_manage_users" },
  { to: "/templates", label: "Form Templates", icon: FileText, requiresCap: "can_manage_templates" },
];


export function AppShell() {
  const { user, loading } = useAuth();
  const { role } = useRole();
  const { caps } = useCapabilities();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: pendingCount = 0 } = useQuery({
    enabled: !!user,
    queryKey: ["pending_submissions_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("pending_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

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


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold text-gold-foreground shadow-sm">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-gold">Orbis CRM</div>
            <div className="text-xs text-sidebar-foreground/60">The IO Buddy</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems
            .filter((i) => !i.requiresCap || caps[i.requiresCap])
            .map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              const count = item.showCount === "pending_submissions" ? pendingCount : 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors border-l-2",
                    active
                      ? "border-gold bg-sidebar-accent text-gold"
                      : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-gold",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              );
            })}

        </nav>
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div className="px-2 text-xs">
            <div className="font-medium truncate">{user.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{role ?? "Member"}</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
