import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export type AppRole = "admin" | "manager" | "member";

export function useRole(): { role: AppRole | null; isAdmin: boolean; isManager: boolean } {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r) => r.role as AppRole);
        if (roles.includes("admin")) setRole("admin");
        else if (roles.includes("manager")) setRole("manager");
        else setRole("member");
      });
  }, [user]);
  return { role, isAdmin: role === "admin", isManager: role === "manager" };
}

export function useIsAdmin() {
  return useRole().isAdmin;
}

export function useIsManager() {
  return useRole().isManager;
}

export type Capability =
  | "can_manage_agents"
  | "can_manage_schools"
  | "can_view_all_trips"
  | "can_manage_templates"
  | "can_manage_users";

export const ALL_CAPABILITIES: Capability[] = [
  "can_manage_agents",
  "can_manage_schools",
  "can_view_all_trips",
  "can_manage_templates",
  "can_manage_users",
];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  can_manage_agents: "Manage agents (add / edit / delete)",
  can_manage_schools: "Manage schools (add / edit / delete)",
  can_view_all_trips: "View all users' trips",
  can_manage_templates: "Manage master forms (form templates)",
  can_manage_users: "Manage users (invite / edit)",
};

export type CapabilityMap = Record<Capability, boolean>;

export function useCapabilities(): { caps: CapabilityMap; loading: boolean } {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [caps, setCaps] = useState<CapabilityMap>({
    can_manage_agents: false,
    can_manage_schools: false,
    can_view_all_trips: false,
    can_manage_templates: false,
    can_manage_users: false,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select(
        "can_manage_agents, can_manage_schools, can_view_all_trips, can_manage_templates, can_manage_users",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCaps({
          can_manage_agents: !!data?.can_manage_agents,
          can_manage_schools: !!data?.can_manage_schools,
          can_view_all_trips: !!data?.can_view_all_trips,
          can_manage_templates: !!data?.can_manage_templates,
          can_manage_users: !!data?.can_manage_users,
        });
        setLoading(false);
      });
  }, [user]);
  if (isAdmin) {
    return {
      caps: {
        can_manage_agents: true,
        can_manage_schools: true,
        can_view_all_trips: true,
        can_manage_templates: true,
        can_manage_users: true,
      },
      loading: false,
    };
  }
  return { caps, loading };
}

export function useCan(cap: Capability): boolean {
  return useCapabilities().caps[cap];
}
