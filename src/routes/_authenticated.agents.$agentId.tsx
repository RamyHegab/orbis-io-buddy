import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, ExternalLink, Mail, Phone, MapPin, Calendar, FileText, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { AddToItineraryButton } from "@/components/add-to-itinerary-button";
import { ImportListDialog } from "@/components/import-list-dialog";
import { ShareIntakeLink } from "@/components/share-intake-link";
import { DiscoverBranchesButton } from "@/components/discover-branches-button";
import { mapsSearchUrl } from "@/lib/google-maps";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({
    branch_name: "",
    city: "",
    country: "",
    address: "",
    place_id: "" as string | null,
    lat: null as number | null,
    lng: null as number | null,
    formatted_address: "" as string | null,
    contact_first_name: "",
    contact_last_name: "",
    contact_email: "",
    contact_position: "",
    contact_phone: "",
    in_country_trading_name: "",
    agency_name: "",
  });

  const { data: agent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*").eq("id", agentId).maybeSingle();
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", agentId],
    queryFn: async () => {
      const { data } = await supabase.from("agent_branches").select("*").eq("agent_id", agentId).order("country");
      return data ?? [];
    },
  });

  const addBranch = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("agent_branches").insert({
        ...branchForm,
        agent_id: agentId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch added");
      setOpen(false);
      setBranchForm({
        branch_name: "", city: "", country: "", address: "",
        place_id: "", lat: null, lng: null, formatted_address: "",
        contact_first_name: "", contact_last_name: "", contact_email: "",
        contact_position: "", contact_phone: "", in_country_trading_name: "", agency_name: "",
      });
      qc.invalidateQueries({ queryKey: ["branches", agentId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", agentId] }),
  });

  const deleteAgent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agents").delete().eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent deleted");
      navigate({ to: "/agents" });
    },
  });

  if (!agent) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agents" })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <PageHeader
        title={agent.trading_name}
        description={agent.legal_name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <AddToItineraryButton
              source="agent"
              id={agent.id}
              name={agent.trading_name}
              address={agent.hq_address}
            />
            <Button variant="outline" size="sm" onClick={() => confirm("Delete this agent?") && deleteAgent.mutate()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Card className="p-5 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{agent.status}</Badge>
          {agent.agent_code && <Badge variant="outline">{agent.agent_code}</Badge>}
          {agent.account_manager && <Badge variant="secondary">AM: {agent.account_manager}</Badge>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {agent.website && (
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <a href={agent.website.startsWith("http") ? agent.website : `https://${agent.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                {agent.website}
              </a>
            </div>
          )}
          {agent.hq_country && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{agent.hq_country}{agent.hq_address ? ` — ${agent.hq_address}` : ""}</span>
            </div>
          )}
          {(agent.agreement_start_date || agent.agreement_end_date) && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{fmtDate(agent.agreement_start_date)} → {fmtDate(agent.agreement_end_date)}</span>
            </div>
          )}
          {agent.main_contact_name && (
            <div className="space-y-1">
              <div className="font-medium">{agent.main_contact_name}</div>
              {agent.main_contact_email && (
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {agent.main_contact_email}</div>
              )}
              {agent.main_contact_phone && (
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> {agent.main_contact_phone}</div>
              )}
            </div>
          )}
        </div>

        {agent.countries_of_operation?.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Countries of operation</div>
            <div className="flex flex-wrap gap-1">
              {agent.countries_of_operation.map((c: string) => (
                <Badge key={c} variant="outline" className="font-normal">{c}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <VisitReports agentId={agentId} />

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Branches</h2>
        <div className="flex gap-2 flex-wrap">
          <DiscoverBranchesButton agentId={agentId} />
          <ImportListDialog type="agent_branch" agentId={agentId} />
          <ShareIntakeLink type="agent_branch" agentId={agentId} label="Share branch form" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add branch</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New branch</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div><Label>Branch name</Label><Input placeholder="e.g. Gullberg, Lahore" value={branchForm.branch_name} onChange={(e) => setBranchForm({ ...branchForm, branch_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })} /></div>
              </div>
              <AddressAutocomplete
                label="Address"
                placeholder="Street, city, country"
                value={{
                  address: branchForm.address,
                  place_id: branchForm.place_id,
                  lat: branchForm.lat,
                  lng: branchForm.lng,
                  formatted_address: branchForm.formatted_address,
                }}
                onChange={(v) => setBranchForm({
                  ...branchForm,
                  address: v.address,
                  place_id: v.place_id,
                  lat: v.lat,
                  lng: v.lng,
                  formatted_address: v.formatted_address,
                })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Agency name</Label><Input value={branchForm.agency_name} onChange={(e) => setBranchForm({ ...branchForm, agency_name: e.target.value })} /></div>
                <div><Label>In-country trading name</Label><Input value={branchForm.in_country_trading_name} onChange={(e) => setBranchForm({ ...branchForm, in_country_trading_name: e.target.value })} /></div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground mb-2">Contact</div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="First name" value={branchForm.contact_first_name} onChange={(e) => setBranchForm({ ...branchForm, contact_first_name: e.target.value })} />
                  <Input placeholder="Last name" value={branchForm.contact_last_name} onChange={(e) => setBranchForm({ ...branchForm, contact_last_name: e.target.value })} />
                </div>
                <Input className="mt-3" placeholder="Position" value={branchForm.contact_position} onChange={(e) => setBranchForm({ ...branchForm, contact_position: e.target.value })} />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Input placeholder="Email" type="email" value={branchForm.contact_email} onChange={(e) => setBranchForm({ ...branchForm, contact_email: e.target.value })} />
                  <Input placeholder="Phone" value={branchForm.contact_phone} onChange={(e) => setBranchForm({ ...branchForm, contact_phone: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => addBranch.mutate()} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {branches && branches.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {branches.map((b) => {
            const contactName = [b.contact_first_name, b.contact_last_name].filter(Boolean).join(" ");
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{b.branch_name || `${b.city ?? ""}${b.city && b.country ? ", " : ""}${b.country ?? ""}`}</div>
                    {(b.city || b.country) && b.branch_name && (
                      <div className="text-xs text-muted-foreground">{[b.city, b.country].filter(Boolean).join(", ")}</div>
                    )}
                    {b.agency_name && <div className="text-xs text-muted-foreground mt-1">{b.agency_name}</div>}
                    {(b.formatted_address || b.address) && (() => {
                      const url = mapsSearchUrl({ query: b.formatted_address || b.address, placeId: b.place_id, lat: b.lat, lng: b.lng });
                      return (
                        <div className="mt-1">
                          <div className="text-xs text-muted-foreground">{b.formatted_address || b.address}</div>
                          {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> View on Google Maps</a>}
                        </div>

                      );
                    })()}
                    {contactName && <div className="text-sm mt-2">{contactName}{b.contact_position ? ` — ${b.contact_position}` : ""}</div>}
                    {b.contact_email && <div className="text-xs text-muted-foreground">{b.contact_email}</div>}
                    {b.contact_phone && <div className="text-xs text-muted-foreground">{b.contact_phone}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => deleteBranch.mutate(b.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <AddToItineraryButton
                      source="agent_branch"
                      id={b.id}
                      agentId={agentId}
                      name={b.branch_name || [b.city, b.country].filter(Boolean).join(", ")}
                      address={b.address}
                      formatted_address={b.formatted_address}
                      place_id={b.place_id}
                      lat={b.lat != null ? Number(b.lat) : null}
                      lng={b.lng != null ? Number(b.lng) : null}
                      size="icon"
                      variant="ghost"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">No branches yet.</Card>
      )}
    </PageContainer>
  );
}
