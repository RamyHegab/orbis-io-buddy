import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Check, X } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — Orbis CRM" }] }),
  component: InboxPage,
});

function InboxPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["pending_submissions"],
    queryFn: async () => {
      const { data } = await supabase.from("pending_submissions").select("*").eq("status", "pending").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (item: any) => {
      if (!user) throw new Error("Not signed in");
      const table = item.type === "school" ? "schools" : item.type === "agent" ? "agents" : "agent_branches";
      const payload = { ...item.payload, user_id: user.id, ...(item.type === "agent_branch" && item.agent_id ? { agent_id: item.agent_id } : {}) };
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) throw error;
      const { error: e2 } = await supabase.from("pending_submissions").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", item.id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["pending_submissions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pending_submissions").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["pending_submissions"] }); },
  });

  return (
    <PageContainer>
      <PageHeader title="Inbox" description="Pending intake-form submissions awaiting review." />
      {!items || items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No pending submissions.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((s: any) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">{s.type.replace("_", " ")}</Badge>
                    {s.source === "auto_discovery" && <Badge variant="secondary">Auto-discovered</Badge>}
                    <span className="text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                    {s.submitter_name && <span className="text-xs">from <strong>{s.submitter_name}</strong>{s.submitter_email ? ` (${s.submitter_email})` : ""}</span>}
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[260px]">
                        source ↗
                      </a>
                    )}
                  </div>
                  <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(s.payload, null, 2)}</pre>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => approve.mutate(s)} disabled={approve.isPending}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => reject.mutate(s.id)}><X className="h-4 w-4 mr-1" /> Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
