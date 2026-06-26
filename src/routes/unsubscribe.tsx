import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Unsubscribe — Orbis CRM" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<"loading" | "ready" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("ready");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  async function confirm() {
    setState("loading");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (d.success) setState("success");
      else if (d.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold">Unsubscribe from Orbis emails</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Checking…</p>}
        {state === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">Click below to stop receiving emails from us.</p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === "already" && <p className="text-sm">You're already unsubscribed.</p>}
        {state === "success" && <p className="text-sm">You've been unsubscribed. You can close this page.</p>}
        {state === "invalid" && <p className="text-sm text-destructive">This unsubscribe link is invalid or expired.</p>}
        {state === "error" && <p className="text-sm text-destructive">Something went wrong. Please try again.</p>}
      </Card>
    </div>
  );
}
