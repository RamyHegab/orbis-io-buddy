import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOnboarding,
  listOnboarding,
  getOnboardingDetail,
  toggleChecklistItem,
} from "@/lib/onboarding.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — Orbis CRM" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: OnboardingPage,
});

type OnboardingRow = Awaited<ReturnType<typeof listOnboarding>>[number];

function OnboardingPage() {
  const listFn = useServerFn(listOnboarding);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["onboarding-list"],
    queryFn: () => listFn({}),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Agent onboarding"
        description="Start onboarding for a new agent, share the signup form, and track every step to approval."
        actions={
          <Button onClick={() => setStartOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Start onboarding
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card className="max-h-[calc(100vh-200px)] overflow-auto">
          <CardHeader>
            <CardTitle className="text-base">
              In progress {rows.length ? `(${rows.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agents in onboarding. Click "Start onboarding" to add one.
              </p>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left rounded-md border p-3 hover:bg-accent transition ${
                    selected === r.id ? "border-primary bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{r.trading_name}</div>
                    <Badge variant="outline" className="shrink-0">
                      {r.done}/{r.total}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.contact_email}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Started {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div>
          {selected ? (
            <OnboardingDetail onboardingId={selected} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Select an agent from the list to see its onboarding checklist.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <StartOnboardingDialog open={startOpen} onClose={() => setStartOpen(false)} />
    </PageContainer>
  );
}

function StartOnboardingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const startFn = useServerFn(startOnboarding);
  const [tradingName, setTradingName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => startFn({ data: { tradingName, contactEmail } }),
    onSuccess: (res) => {
      toast.success("Agent added to onboarding");
      qc.invalidateQueries({ queryKey: ["onboarding-list"] });
      setTradingName("");
      setContactEmail("");
      onClose();
      if (!res.shareToken) {
        toast.warning(
          "Agent Signup form is inactive. Configure it in Forms so a share link can be generated.",
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start onboarding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Agent / company name</Label>
            <Input value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
          </div>
          <div>
            <Label>Primary contact email</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@agent.com"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We'll create a draft record and generate a share link for the Agent Signup form.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!tradingName || !contactEmail || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Starting…" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingDetail({ onboardingId }: { onboardingId: string }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getOnboardingDetail);
  const toggleFn = useServerFn(toggleChecklistItem);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-detail", onboardingId],
    queryFn: () => detailFn({ data: { onboardingId } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { itemId: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-detail", onboardingId] });
      qc.invalidateQueries({ queryKey: ["onboarding-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const agent = (data.onboarding as any).agent;
  const shareUrl = data.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/t/${data.shareToken}`
    : null;
  const allDone =
    data.checklist.length > 0 && data.checklist.every((c: any) => c.done);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{agent?.trading_name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {agent?.main_contact_email || data.onboarding.contact_email}
              {agent?.hq_country ? ` · ${agent.hq_country}` : ""}
            </p>
          </div>
          <Badge variant={allDone ? "default" : "secondary"}>
            {allDone ? "All checks done" : `${data.checklist.filter((c: any) => c.done).length}/${data.checklist.length}`}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {shareUrl ? (
            <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Agent signup link</div>
                <div className="font-mono text-xs truncate">{shareUrl}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                </Button>
              </a>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              No active Agent Signup form template. Configure and activate one in Forms so we can
              share a link.
            </div>
          )}

          <div className="space-y-2">
            {data.checklist.map((item: any) => (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(v) =>
                    toggle.mutate({ itemId: item.id, done: v === true })
                  }
                />
                <div className="flex-1">
                  <div className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </div>
                  {item.done_at && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Ticked {formatDistanceToNow(new Date(item.done_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {data.references.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">References ({data.references.length})</h4>
              <div className="space-y-1">
                {data.references.map((r: any) => (
                  <div
                    key={r.id}
                    className="text-xs flex items-center justify-between rounded border p-2"
                  >
                    <div>
                      <span className="font-medium">{r.name}</span> ·{" "}
                      <a href={`mailto:${r.email}`} className="underline">
                        {r.email}
                      </a>
                      {r.institution ? ` · ${r.institution}` : ""}
                      {r.role ? ` · ${r.role}` : ""}
                    </div>
                    <Badge variant={r.done ? "default" : "outline"}>
                      {r.done ? "Complete" : r.request_sent_at ? "Sent" : "Not sent"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.documents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Documents ({data.documents.length})</h4>
              <div className="space-y-1">
                {data.documents.map((d: any) => (
                  <div
                    key={d.id}
                    className="text-xs flex items-center justify-between rounded border p-2"
                  >
                    <div>
                      <span className="font-medium">{d.title || d.file_name || "Untitled"}</span>
                      <span className="text-muted-foreground ml-2">[{d.category}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
