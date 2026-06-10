import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, QrCode, Send, ExternalLink, Mail, Phone, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/trips/$tripId/activities/$activityId")({
  component: ActivityDetail,
});

function ActivityDetail() {
  const { tripId, activityId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ url: string; png: string } | null>(null);

  const { data: activity } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select(`*,
          agents(id, trading_name),
          schools(id, name, city, country, address, primary_contact_name, primary_contact_position, primary_contact_email, primary_contact_phone, general_email, general_phone),
          agent_branches(id, branch_name, city, country, address, contact_first_name, contact_last_name, contact_position, contact_email, contact_phone)
        `)
        .eq("id", activityId)
        .maybeSingle();
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", activityId],
    queryFn: async () => (await supabase.from("activity_comments").select("*").eq("activity_id", activityId).order("created_at")).data ?? [],
  });

  const { data: templates } = useQuery({
    enabled: !!activity,
    queryKey: ["templates-for-activity", activity?.type],
    queryFn: async () => (await supabase.from("form_templates").select("*").eq("activity_type", activity!.type)).data ?? [],
  });

  const { data: submissions } = useQuery({
    queryKey: ["submissions", activityId],
    queryFn: async () => (await supabase.from("form_submissions").select("*, form_templates(name)").eq("activity_id", activityId).order("created_at", { ascending: false })).data ?? [],
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("activity_comments").insert({ activity_id: activityId, user_id: user.id, body: comment });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["comments", activityId] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("activities").delete().eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity deleted");
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
  });

  const showQr = async (templateId: string) => {
    const url = `${window.location.origin}/forms/${activityId}/${templateId}`;
    const png = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    setQrData({ url, png });
    setQrOpen(true);
  };

  if (!activity) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to trip
      </Button>

      <PageHeader
        title={activity.title}
        description={`${fmtDate(activity.day_date)}${activity.start_time ? ` • ${activity.start_time.slice(0, 5)}` : ""}${activity.end_time ? `–${activity.end_time.slice(0, 5)}` : ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => confirm("Delete activity?") && remove.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className={ACTIVITY_TYPE_COLORS[activity.type]}>{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
          {activity.location && <Badge variant="outline">{activity.location}</Badge>}
          {activity.agents?.trading_name && <Badge variant="secondary">Agent: {activity.agents.trading_name}</Badge>}
          {activity.schools?.name && <Badge variant="secondary">School: {activity.schools.name}</Badge>}
        </div>
        {activity.notes && <p className="text-sm whitespace-pre-wrap">{activity.notes}</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Forms</h3>
          {templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{Array.isArray(t.fields) ? t.fields.length : 0} fields</div>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/forms/$activityId/$templateId" params={{ activityId, templateId: t.id }}>
                      <Button size="sm" variant="outline">Fill</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => showQr(t.id)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No templates for this activity type. {" "}
              <Link to="/templates" className="text-primary hover:underline">Create one</Link>.
            </p>
          )}

          {submissions && submissions.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Submissions</h4>
              <ul className="space-y-2">
                {submissions.map((s: any) => (
                  <li key={s.id} className="rounded-md border p-2 text-xs">
                    <div className="font-medium">{s.form_templates?.name}</div>
                    <div className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Comments & Notes</h3>
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" rows={2} />
            <Button onClick={() => addComment.mutate()} disabled={!comment.trim()} size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan to open form</DialogTitle></DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center gap-3">
              <img src={qrData.png} alt="QR code" className="rounded-lg border" />
              <div className="w-full">
                <Label className="text-xs">Direct link</Label>
                <Input readOnly value={qrData.url} onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Staff members need to be signed in to submit.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
