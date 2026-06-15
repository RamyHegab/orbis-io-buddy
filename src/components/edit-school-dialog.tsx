import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { toast } from "sonner";

const LEVELS = [
  { value: "high_school", label: "High School" },
  { value: "university", label: "University" },
  { value: "language_school", label: "Language School" },
  { value: "other", label: "Other" },
];

type School = {
  id: string;
  name?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  level?: string | null;
  general_email?: string | null;
  general_phone?: string | null;
  primary_contact_name?: string | null;
  primary_contact_position?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  secondary_contact_name?: string | null;
  secondary_contact_email?: string | null;
  secondary_contact_phone?: string | null;
  notes?: string | null;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  formatted_address?: string | null;
};

export function EditSchoolDialog({ school, open, onOpenChange }: { school: School | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<School>({ id: "" });

  useEffect(() => {
    if (school) setForm({ ...school });
  }, [school]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error("Missing school");
      const { id, ...patch } = form;
      const { error } = await supabase.from("schools").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School updated");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const v = (k: keyof School) => (form[k] as string) ?? "";
  const set = (k: keyof School, val: any) => setForm((f) => ({ ...f, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit school</DialogTitle></DialogHeader>
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">School</h3>
            <div><Label>School name *</Label><Input value={v("name")} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City *</Label><Input value={v("city")} onChange={(e) => set("city", e.target.value)} /></div>
              <div><Label>Country</Label><Input value={v("country")} onChange={(e) => set("country", e.target.value)} /></div>
            </div>
            <AddressAutocomplete
              label="Address"
              placeholder="School address"
              value={{
                address: v("address"),
                place_id: form.place_id || null,
                lat: form.lat ?? null,
                lng: form.lng ?? null,
                formatted_address: form.formatted_address || null,
              }}
              onChange={(val) => setForm((f) => ({
                ...f,
                address: val.address,
                place_id: val.place_id ?? "",
                lat: val.lat,
                lng: val.lng,
                formatted_address: val.formatted_address ?? "",
              }))}
            />
            <div>
              <Label>Level</Label>
              <Select value={v("level") || "high_school"} onValueChange={(val) => set("level", val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">General contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>General email</Label><Input type="email" value={v("general_email")} onChange={(e) => set("general_email", e.target.value)} /></div>
              <div><Label>General phone</Label><Input value={v("general_phone")} onChange={(e) => set("general_phone", e.target.value)} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Primary contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={v("primary_contact_name")} onChange={(e) => set("primary_contact_name", e.target.value)} /></div>
              <div><Label>Position</Label><Input value={v("primary_contact_position")} onChange={(e) => set("primary_contact_position", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={v("primary_contact_email")} onChange={(e) => set("primary_contact_email", e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={v("primary_contact_phone")} onChange={(e) => set("primary_contact_phone", e.target.value)} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Secondary contact</h3>
            <div><Label>Name</Label><Input value={v("secondary_contact_name")} onChange={(e) => set("secondary_contact_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={v("secondary_contact_email")} onChange={(e) => set("secondary_contact_email", e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={v("secondary_contact_phone")} onChange={(e) => set("secondary_contact_phone", e.target.value)} /></div>
            </div>
          </section>

          <div><Label>Notes</Label><Textarea value={v("notes")} onChange={(e) => set("notes", e.target.value)} /></div>

          <Button onClick={() => save.mutate()} disabled={!form.name || !form.city || save.isPending} className="w-full">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
