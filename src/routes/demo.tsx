import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/demo-auth.functions";
import { Globe2 } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo access — Orbis CRM" },
      { name: "description", content: "Try Orbis CRM with a shared demo account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoLoginPage,
});

function DemoLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { email, password } = await ensureDemoUser();
        if (cancelled) return;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not sign in to the demo account.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-sm">
          <Globe2 className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          {error ? "Demo sign-in failed" : "Signing you into the demo…"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "One moment while we prepare a read-only demo workspace."}
        </p>
      </div>
    </div>
  );
}
