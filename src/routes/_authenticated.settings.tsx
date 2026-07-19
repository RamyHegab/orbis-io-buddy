import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency";
import { toast } from "sonner";
import { BrandingCard } from "@/components/branding-card";
import { StartOnboardingDialog } from "@/components/start-onboarding-dialog";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, ExternalLink, Plus, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function SettingsSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="w-full group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/40 transition-colors">
            <CardTitle className="flex items-center gap-2 text-left">
              {icon}
              {title}
            </CardTitle>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Orbis CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const isAdmin = useIsAdmin();



  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Workspace, team, and integration preferences."
      />

      {isAdmin && (
        <SettingsSection title="Account — Recruitment cycle & currency">
          <AccountSettingsBody />
        </SettingsSection>
      )}
      {isAdmin && (
        <SettingsSection title="Branding — Logo & theme">
          <BrandingCard bare />
        </SettingsSection>
      )}
      <SettingsSection
        title="Agent onboarding"
        icon={<ClipboardCheck className="h-4 w-4" />}
      >
        <AgentOnboardingBody isAdmin={isAdmin} />
      </SettingsSection>



      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage team members, roles, and branding from this page.
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function AgentOnboardingBody({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {isAdmin ? (
        <>
          <p className="text-sm text-muted-foreground">
            Set up the Agent Signup form, configure the onboarding checklist, review references
            and documents, and approve new agents.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/onboarding">
                <ExternalLink className="h-4 w-4 mr-1" /> Open onboarding management
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Start a new agent onboarding
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Kick off onboarding for a new agent. We'll create a draft record and email you a
            share link for the Agent Signup form.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Start a new agent onboarding
          </Button>
        </>
      )}
      <StartOnboardingDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function AccountSettingsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year, currency, sender_subdomain")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const [sm, setSm] = useState(9);
  const [sy, setSy] = useState(new Date().getFullYear());
  const [em, setEm] = useState(8);
  const [ey, setEy] = useState(new Date().getFullYear() + 1);
  const [currency, setCurrency] = useState("GBP");
  const [subdomain, setSubdomain] = useState("");

  useEffect(() => {
    if (!data) return;
    setSm(data.cycle_start_month);
    setSy(data.cycle_start_year);
    setEm(data.cycle_end_month);
    setEy(data.cycle_end_year);
    setCurrency(data.currency || "GBP");
    setSubdomain((data as any).sender_subdomain || "");
  }, [data]);

  const subdomainValid = !subdomain || /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(subdomain);

  const save = useMutation({
    mutationFn: async () => {
      if (!subdomainValid) throw new Error("Invalid subdomain. Use lowercase letters, numbers, and hyphens only.");
      const payload = {
        id: 1,
        cycle_start_month: sm,
        cycle_start_year: sy,
        cycle_end_month: em,
        cycle_end_year: ey,
        currency,
        sender_subdomain: subdomain ? subdomain.toLowerCase() : null,
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account settings saved");
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Account — Recruitment cycle & currency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1 block">Recruitment cycle</Label>
          <p className="text-xs text-muted-foreground mb-2">
            The cycle year used across Planning, Trips and Archive. A cycle spans from its start month/year to its end month/year (not the calendar year).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Start month</Label>
              <Select value={String(sm)} onValueChange={(v) => setSm(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Start year</Label>
              <Input type="number" value={sy} onChange={(e) => setSy(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">End month</Label>
              <Select value={String(em)} onValueChange={(v) => setEm(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">End year</Label>
              <Input type="number" value={ey} onChange={(e) => setEy(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Current cycle label: <span className="font-medium text-foreground">{sy}–{ey}</span>
          </p>
        </div>

        <div>
          <Label className="mb-1 block">Account currency</Label>
          <p className="text-xs text-muted-foreground mb-2">Used to display cost totals across the app.</p>
          <div className="flex items-center gap-3">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{currencySymbol(c)} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">Preview: {currencySymbol(currency)}1,234.00</span>
          </div>
        </div>

        <div>
          <Label className="mb-1 block">System email sender subdomain</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Shared across your team. Each user's system emails will be sent from{" "}
            <span className="font-mono">firstname@&lt;subdomain&gt;.orbishub.co.uk</span>. DNS delegation is required before the custom subdomain can send email.
          </p>
          <div className="flex items-center gap-1 max-w-md">
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="university"
              className="max-w-[220px]"
            />
            <span className="text-sm text-muted-foreground">.orbishub.co.uk</span>
          </div>
          {!subdomainValid && (
            <p className="text-xs text-destructive mt-1">
              Use lowercase letters, numbers and hyphens (no leading/trailing hyphen).
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
