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
