import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ city: "", country: "", contact_name: "", email: "", phone: "", notes: "" });

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
      const { error } = await supabase.from("agent_branches").insert({ ...branchForm, agent_id: agentId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch added");
      setOpen(false);
      setBranchForm({ city: "", country: "", contact_name: "", email: "", phone: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["branches", agentId] });
    },
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
        title={agent.name}
        description={agent.headquarters_country ?? undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => confirm("Delete this agent?") && deleteAgent.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      {agent.website && (
        <Card className="p-4 mb-6">
          <a href={agent.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
            {agent.website}
          </a>
          {agent.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{agent.notes}</p>}
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Branches</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City *</Label><Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
                <div><Label>Country *</Label><Input value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })} /></div>
              </div>
              <div><Label>Contact name</Label><Input value={branchForm.contact_name} onChange={(e) => setBranchForm({ ...branchForm, contact_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={branchForm.notes} onChange={(e) => setBranchForm({ ...branchForm, notes: e.target.value })} /></div>
              <Button onClick={() => addBranch.mutate()} disabled={!branchForm.city || !branchForm.country} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {branches && branches.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {branches.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{b.city}, {b.country}</div>
                  {b.contact_name && <div className="text-sm text-muted-foreground mt-1">{b.contact_name}</div>}
                  {b.email && <div className="text-xs text-muted-foreground">{b.email}</div>}
                  {b.phone && <div className="text-xs text-muted-foreground">{b.phone}</div>}
                </div>
                <button onClick={() => deleteBranch.mutate(b.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">No branches yet.</Card>
      )}
    </PageContainer>
  );
}
