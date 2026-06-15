import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Agent = {
  id: string;
  trading_name?: string | null;
  legal_name?: string | null;
  account_manager?: string | null;
  status?: string | null;
  website?: string | null;
  hq_country?: string | null;
  hq_address?: string | null;
  agent_code?: string | null;
  main_contact_name?: string | null;
  main_contact_email?: string | null;
  main_contact_phone?: string | null;
};

export function EditAgentDialog({ agent, open, onOpenChange }: { agent: Agent | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Agent>({ id: "" });

  useEffect(() => {
    if (agent) setForm({ ...agent });
  }, [agent]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error("Missing agent");
      const { id, ...patch } = form;
      const { error } = await supabase.from("agents").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent updated");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const v = (k: keyof Agent) => (form[k] as string) ?? "";
  const set = (k: keyof Agent, val: string) => setForm((f) => ({ ...f, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit agent</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Trading name *</Label><Input value={v("trading_name")} onChange={(e) => set("trading_name", e.target.value)} /></div>
            <div><Label>Agent code</Label><Input value={v("agent_code")} onChange={(e) => set("agent_code", e.target.value)} /></div>
          </div>
          <div><Label>Legal name</Label><Input value={v("legal_name")} onChange={(e) => set("legal_name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Account manager</Label><Input value={v("account_manager")} onChange={(e) => set("account_manager", e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={v("status") || "active"} onValueChange={(val) => set("status", val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Website</Label><Input value={v("website")} onChange={(e) => set("website", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>HQ country</Label><Input value={v("hq_country")} onChange={(e) => set("hq_country", e.target.value)} /></div>
            <div><Label>HQ address</Label><Input value={v("hq_address")} onChange={(e) => set("hq_address", e.target.value)} /></div>
          </div>
          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">Main contact</div>
            <div className="space-y-3">
              <Input placeholder="Name" value={v("main_contact_name")} onChange={(e) => set("main_contact_name", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Email" type="email" value={v("main_contact_email")} onChange={(e) => set("main_contact_email", e.target.value)} />
                <Input placeholder="Phone" value={v("main_contact_phone")} onChange={(e) => set("main_contact_phone", e.target.value)} />
              </div>
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={!form.trading_name || save.isPending} className="w-full">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
