import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StartOnboardingDialog } from "@/components/start-onboarding-dialog";
import { toast } from "sonner";
import { ChevronDown, Copy, ExternalLink, Mail, Paperclip, Plus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listOnboarding,
  getOnboardingDetail,
  toggleChecklistItem,
  sendSignupInvite,
  sendReferenceRequest,
} from "@/lib/onboarding.functions";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";

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

function OnboardingPage() {
  const listFn = useServerFn(listOnboarding);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["onboarding-list"],
    queryFn: () => listFn({}),
  });
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

      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No agents in onboarding. Click "Start onboarding" to add one.
            </CardContent>
          </Card>
        ) : (
          rows.map((r) => <OnboardingCard key={r.id} row={r} />)
        )}
      </div>

      <StartOnboardingDialog open={startOpen} onClose={() => setStartOpen(false)} />
    </PageContainer>
  );
}

function OnboardingCard({ row }: { row: any }) {
  const allDone = row.total > 0 && row.done === row.total;
  return (
    <Card>
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="w-full text-left group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{row.trading_name}</CardTitle>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                <a
                  href={`mailto:${row.contact_email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="underline hover:text-primary"
                >
                  {row.contact_email}
                </a>
                {row.hq_country && <span>· {row.hq_country}</span>}
                <span>· Started {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={allDone ? "default" : "secondary"}>
                {allDone ? "All checks done" : `${row.done}/${row.total}`}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <OnboardingDetail onboardingId={row.id} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function OnboardingDetail({ onboardingId }: { onboardingId: string }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getOnboardingDetail);
  const toggleFn = useServerFn(toggleChecklistItem);
  const sendInviteFn = useServerFn(sendSignupInvite);
  const sendRefFn = useServerFn(sendReferenceRequest);

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

  const sendInvite = useMutation({
    mutationFn: () => sendInviteFn({ data: { onboardingId } }),
    onSuccess: () => {
      toast.success("Signup form emailed to the agent");
      qc.invalidateQueries({ queryKey: ["onboarding-detail", onboardingId] });
      qc.invalidateQueries({ queryKey: ["onboarding-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendRef = useMutation({
    mutationFn: (referenceId: string) => sendRefFn({ data: { referenceId } }),
    onSuccess: () => {
      toast.success("Reference request emailed");
      qc.invalidateQueries({ queryKey: ["onboarding-detail", onboardingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground py-4">Loading…</p>;
  }

  const agent = (data.onboarding as any).agent;
  const agentId: string = agent?.id;
  const shareUrl = data.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/t/${data.shareToken}`
    : null;
  const contactEmail = agent?.main_contact_email || (data.onboarding as any).contact_email;
  const contactName = agent?.main_contact_name || null;

  const references = data.references ?? [];

  const renderItemAction = (item: any) => {
    switch (item.item_key) {
      case "signup_form_sent": {
        const subject = encodeURIComponent(`Agent application — ${agent?.trading_name ?? ""}`);
        const body = encodeURIComponent(
          `Hello${contactName ? ` ${contactName}` : ""},\n\n` +
            `Please complete our agent application form:\n${shareUrl ?? "(form link pending)"}\n\nThank you.`,
        );
        const mailto = shareUrl
          ? `mailto:${contactEmail}?subject=${subject}&body=${body}`
          : `mailto:${contactEmail}?subject=${subject}`;
        return (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {contactName && <span className="text-muted-foreground">{contactName}</span>}
            <a href={mailto} className="underline text-primary">{contactEmail}</a>
            {shareUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy link
              </Button>
            )}
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                sendInvite.mutate();
              }}
              disabled={sendInvite.isPending || !shareUrl}
            >
              <Send className="h-3 w-3 mr-1" /> Send form
            </Button>
          </div>
        );
      }
      case "reference_requests_sent":
      case "references_reviewed": {
        if (references.length === 0) {
          return (
            <p className="mt-2 text-xs text-muted-foreground">
              No referees captured yet. They appear here after the agent submits the application.
            </p>
          );
        }
        return (
          <div className="mt-2 space-y-1">
            {references.map((r: any) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 text-xs rounded border p-2"
              >
                <div className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{r.name || "—"}</span>
                  {r.institution && <span className="text-muted-foreground"> · {r.institution}</span>}
                  {" · "}
                  <a href={`mailto:${r.email}`} className="underline">{r.email}</a>
                </div>
                <Badge variant={r.done ? "default" : "outline"} className="text-[10px]">
                  {r.done ? "Complete" : r.request_sent_at ? "Sent" : "Not sent"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    sendRef.mutate(r.id);
                  }}
                  disabled={sendRef.isPending}
                >
                  <Send className="h-3 w-3 mr-1" /> Send form
                </Button>
              </div>
            ))}
          </div>
        );
      }
      case "british_council_received":
      case "company_reg_received":
      case "supporting_docs_received":
        return (
          <div className="mt-2">
            <Link to="/agents/$agentId" params={{ agentId }} hash="attachments">
              <Button variant="outline" size="sm">
                <Paperclip className="h-3 w-3 mr-1" /> Check attachments
              </Button>
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {shareUrl ? (
        <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Agent Application link</div>
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
          No active Agent Application form template. Configure and activate one in Forms so we can
          share a link.
        </div>
      )}

      <div className="space-y-2">
        {data.checklist.map((item: any) => (
          <div key={item.id} className="rounded-md border p-3">
            <label className="flex items-start gap-3 cursor-pointer">
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
            {renderItemAction(item)}
          </div>
        ))}
      </div>

      {agentId && (
        <div className="text-xs text-muted-foreground pt-2">
          <Link to="/agents/$agentId" params={{ agentId }} className="underline inline-flex items-center gap-1">
            <Mail className="h-3 w-3" /> Open agent record
          </Link>
        </div>
      )}
    </div>
  );
}
