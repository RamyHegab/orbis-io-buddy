import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Globe2 } from "lucide-react";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — Orbis Recruitment CRM" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const mode = "signin" as const;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-sm">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-gold">Orbis CRM</div>
            <div className="text-xs text-muted-foreground">University Recruitment</div>
          </div>
        </div>
        <Card className="p-6 shadow-xl">
          <h1 className="text-xl font-semibold mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Sign in to plan your next trip." : "Get started with Orbis CRM."}
          </p>



          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Access is invite-only. Contact your administrator to request an account.
          </p>

        </Card>
      </div>
    </div>
  );
}
