import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, MapPin, Database, Pencil } from "lucide-react";
import { EditAgentDialog } from "@/components/edit-agent-dialog";
import { toast } from "sonner";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { seedAirtableData } from "@/lib/seed-airtable.functions";
import { fmtDate } from "@/lib/format";
import { AddToItineraryButton } from "@/components/add-to-itinerary-button";
import { ImportListDialog } from "@/components/import-list-dialog";
import { ShareIntakeLink } from "@/components/share-intake-link";

export const Route = createFileRoute("/_authenticated/agents/")({
  head: () => ({ meta: [{ title: "Agents — Orbis CRM" }] }),
  component: AgentsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  inactive: "outline",
  prospect: "secondary",
};

function AgentsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const seed = useServerFn(seedAirtableData);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  
  const [form, setForm] = useState({
    trading_name: "",
    legal_name: "",
    account_manager: "",
    status: "active",
    website: "",
    hq_country: "",
    hq_address: "",
    agent_code: "",
    main_contact_name: "",
    main_contact_email: "",
    main_contact_phone: "",
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("*, agent_branches(count)")
        .order("trading_name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = filter.toLowerCase();
    return (agents ?? []).filter((a: any) =>
      !t ||
      a.trading_name?.toLowerCase().includes(t) ||
      a.legal_name?.toLowerCase().includes(t) ||
      a.hq_country?.toLowerCase().includes(t) ||
      (a.countries_of_operation ?? []).join(",").toLowerCase().includes(t),
    );
  }, [agents, filter]);


  const createAgent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("agents").insert({
        ...form,
        status: form.status as any,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runSeed = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r: any) => {
      toast.success(`Imported ${r.agents} agents, ${r.branches} branches`);
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        description="Your worldwide recruitment partner network."
        actions={
          <div className="flex gap-2 flex-wrap">
            <ImportListDialog type="agent" />
            <ShareIntakeLink type="agent" />
            {isAdmin && (!agents || agents.length === 0) && (
              <Button variant="outline" onClick={() => runSeed.mutate()} disabled={runSeed.isPending}>
                <Database className="h-4 w-4 mr-1" /> Import Airtable data
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> New agent</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New agent</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Trading name *</Label><Input value={form.trading_name} onChange={(e) => setForm({ ...form, trading_name: e.target.value })} /></div>
                    <div><Label>Agent code</Label><Input value={form.agent_code} onChange={(e) => setForm({ ...form, agent_code: e.target.value })} /></div>
                  </div>
                  <div><Label>Legal name</Label><Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Account manager</Label><Input value={form.account_manager} onChange={(e) => setForm({ ...form, account_manager: e.target.value })} /></div>
                    <div>
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>HQ country</Label><Input value={form.hq_country} onChange={(e) => setForm({ ...form, hq_country: e.target.value })} /></div>
                    <div><Label>HQ address</Label><Input value={form.hq_address} onChange={(e) => setForm({ ...form, hq_address: e.target.value })} /></div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Main contact</div>
                    <div className="space-y-3">
                      <Input placeholder="Name" value={form.main_contact_name} onChange={(e) => setForm({ ...form, main_contact_name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Email" type="email" value={form.main_contact_email} onChange={(e) => setForm({ ...form, main_contact_email: e.target.value })} />
                        <Input placeholder="Phone" value={form.main_contact_phone} onChange={(e) => setForm({ ...form, main_contact_phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => createAgent.mutate()} disabled={!form.trading_name || createAgent.isPending} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Input placeholder="Search by name, country, or operation…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm mb-6" />

      {filtered.length > 0 ? (
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a: any) => (
              <div key={a.id} className="relative">
                <Link to="/agents/$agentId" params={{ agentId: a.id }}>
                  <Card className="p-5 hover:shadow-md transition-shadow h-full">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{a.trading_name}</div>
                          <Badge variant={STATUS_VARIANT[a.status] ?? "outline"} className="text-[10px] uppercase">{a.status}</Badge>
                        </div>
                        {a.legal_name && a.legal_name !== a.trading_name && (
                          <div className="text-xs text-muted-foreground truncate">{a.legal_name}</div>
                        )}
                        {a.hq_country && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {a.hq_country}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{a.agent_branches?.[0]?.count ?? 0} branches</span>
                          {a.agreement_end_date && <span>Until {fmtDate(a.agreement_end_date, "MMM yyyy")}</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(a); }}
                    title="Edit agent"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AddToItineraryButton
                    source="agent"
                    id={a.id}
                    name={a.trading_name}
                    address={a.hq_address}
                    size="icon"
                    variant="ghost"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">
          No agents yet. {isAdmin && "Click \"Import Airtable data\" to load your Agents/Offices CSV seed."}
        </Card>
        </Card>
      )}
      <EditAgentDialog agent={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
    </PageContainer>
  );
}
