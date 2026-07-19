import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { format, parseISO } from "date-fns";

function siteOrigin(): string {
  try {
    const req = getRequest();
    if (req?.url) return new URL(req.url).origin;
  } catch {}
  return process.env.SITE_URL ?? "https://orbishub.co.uk";
}

async function sendApprovalEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, any>;
  senderUserId?: string | null;
}) {
  try {
    const req = getRequest();
    const origin = req?.url ? new URL(req.url).origin : siteOrigin();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    // Resolve a per-user "from" identity when possible so recipients see the
    // relevant team member's system address instead of a generic noreply.
    let from: string | undefined;
    let replyTo: string | undefined;
    if (opts.senderUserId) {
      try {
        const { getSenderFor } = await import("./system-email.server");
        const s = await getSenderFor(opts.senderUserId);
        from = s.from;
        replyTo = s.replyTo;
      } catch (e) {
        console.error("sender resolution failed", e);
      }
    }
    const res = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ ...opts, from, replyTo }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("approval email send failed", { status: res.status, text });
    }
  } catch (e) {
    console.error("approval email send threw", e);
  }
}


function fmtRange(start: string, end: string): string {
  try {
    return `${format(parseISO(start), "d MMM yyyy")} → ${format(parseISO(end), "d MMM yyyy")}`;
  } catch {
    return `${start} → ${end}`;
  }
}

async function notify(
  supabaseAdmin: any,
  rows: Array<{
    user_id: string;
    type: string;
    trip_id: string;
    title: string;
    body?: string | null;
  }>,
) {
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) console.error("notification insert failed", error);
}

export const submitTripForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tripId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: trip, error: tErr } = await supabase
      .from("trips")
      .select("id, user_id, title, start_date, end_date, objectives, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!trip) throw new Error("Trip not found");
    if (trip.user_id !== userId) throw new Error("Only the trip owner can submit");
    if (trip.status === "submitted") throw new Error("Trip is already submitted");
    if (trip.status === "approved") throw new Error("Trip is already approved");

    const { data: owner, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    // Approvals now go to all admins (line-manager role removed).
    const { data: adminRoleRows, error: arErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (arErr) throw new Error(arErr.message);
    const adminIds = (adminRoleRows ?? []).map((r: any) => r.user_id as string);
    if (adminIds.length === 0) {
      throw new Error("No admin available to approve this trip. Ask an admin to be assigned first.");
    }

    const { data: admins, error: mErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", adminIds);
    if (mErr) throw new Error(mErr.message);
    const adminList = (admins ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>;

    // Cancel any prior pending approval for this trip
    await supabaseAdmin
      .from("trip_approvals")
      .delete()
      .eq("trip_id", trip.id)
      .eq("decision", "pending");

    const { data: approval, error: aErr } = await supabaseAdmin
      .from("trip_approvals")
      .insert({
        trip_id: trip.id,
        requested_by: userId,
        manager_id: null,
        decision: "pending",
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    const { error: sErr } = await supabaseAdmin
      .from("trips")
      .update({ status: "submitted" })
      .eq("id", trip.id);
    if (sErr) throw new Error(sErr.message);

    const tripUrl = `${siteOrigin()}/trips/${trip.id}`;
    const tripDates = fmtRange(trip.start_date, trip.end_date);

    await notify(
      supabaseAdmin,
      adminList.map((a) => ({
        user_id: a.id,
        type: "trip_submitted",
        trip_id: trip.id,
        title: `${owner?.full_name ?? "A team member"} needs approval for "${trip.title}"`,
        body: tripDates,
      })),
    );

    for (const admin of adminList) {
      if (!admin.email) continue;
      await sendApprovalEmail({
        templateName: "trip-submitted-for-approval",
        recipientEmail: admin.email,
        idempotencyKey: `${trip.id}-submitted-${approval.id}-${admin.id}`,
        templateData: {
          managerName: admin.full_name ?? undefined,
          ownerName: owner?.full_name ?? undefined,
          tripTitle: trip.title,
          tripDates,
          objectives: trip.objectives ?? undefined,
          tripUrl,
        },
        senderUserId: userId,
      });
    }

    return { ok: true, approvalId: approval.id };
  });


export const withdrawTripSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tripId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, user_id, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trip) throw new Error("Trip not found");
    if (trip.user_id !== userId) throw new Error("Not your trip");
    if (trip.status !== "submitted") throw new Error("Trip is not awaiting approval");

    await supabaseAdmin
      .from("trip_approvals")
      .delete()
      .eq("trip_id", trip.id)
      .eq("decision", "pending");

    const { error: sErr } = await supabaseAdmin
      .from("trips")
      .update({ status: "active" })
      .eq("id", trip.id);
    if (sErr) throw new Error(sErr.message);

    return { ok: true };
  });

export const decideTripApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { approvalId: string; decision: "approved" | "changes_requested"; note?: string }) => i,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.decision === "changes_requested" && !data.note?.trim()) {
      throw new Error("A note is required when requesting changes");
    }

    const { data: approval, error } = await supabase
      .from("trip_approvals")
      .select("id, trip_id, requested_by, manager_id, decision")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!approval) throw new Error("Approval request not found");
    if (approval.manager_id !== userId) throw new Error("Only the assigned manager can decide");
    if (approval.decision !== "pending") throw new Error("This request has already been decided");

    const { data: trip, error: tErr } = await supabaseAdmin
      .from("trips")
      .select("id, title, start_date, end_date")
      .eq("id", approval.trip_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!trip) throw new Error("Trip not found");

    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", approval.requested_by)
      .maybeSingle();
    const { data: manager } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const newTripStatus = data.decision === "approved" ? "approved" : "active";

    const { error: aErr } = await supabaseAdmin
      .from("trip_approvals")
      .update({
        decision: data.decision,
        note: data.note ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approval.id);
    if (aErr) throw new Error(aErr.message);

    const { error: sErr } = await supabaseAdmin
      .from("trips")
      .update({ status: newTripStatus })
      .eq("id", trip.id);
    if (sErr) throw new Error(sErr.message);

    const tripUrl = `${siteOrigin()}/trips/${trip.id}`;
    const tripDates = fmtRange(trip.start_date, trip.end_date);

    await notify(supabaseAdmin, [
      {
        user_id: approval.requested_by,
        type: data.decision === "approved" ? "trip_approved" : "trip_changes_requested",
        trip_id: trip.id,
        title:
          data.decision === "approved"
            ? `"${trip.title}" was approved`
            : `Changes requested on "${trip.title}"`,
        body: data.note ?? tripDates,
      },
    ]);

    // On approval, generate a PDF snapshot of the itinerary and include a
    // signed download link in both the owner and manager emails.
    let itineraryUrl: string | undefined;
    if (data.decision === "approved") {
      try {
        const { generateAndUploadTripItineraryPdf } = await import(
          "@/lib/trip-itinerary-pdf.server"
        );
        const out = await generateAndUploadTripItineraryPdf(trip.id, {
          origin: siteOrigin(),
          pathSuffix: approval.id,
        });
        itineraryUrl = out.url ?? undefined;
      } catch (e) {
        console.error("itinerary pdf generation failed", e);
      }
    }

    const baseTemplateData = {
      ownerName: owner?.full_name ?? undefined,
      managerName: manager?.full_name ?? undefined,
      tripTitle: trip.title,
      tripDates,
      note: data.note ?? undefined,
      tripUrl,
      itineraryUrl,
    };

    if (owner?.email) {
      await sendApprovalEmail({
        templateName:
          data.decision === "approved" ? "trip-approved" : "trip-changes-requested",
        recipientEmail: owner.email,
        idempotencyKey: `${trip.id}-${data.decision}-${approval.id}`,
        templateData: { ...baseTemplateData, audience: "owner" },
        senderUserId: userId,
      });
    }

    // Send the approved itinerary copy to the manager as well.
    if (data.decision === "approved" && manager?.email) {
      await sendApprovalEmail({
        templateName: "trip-approved",
        recipientEmail: manager.email,
        idempotencyKey: `${trip.id}-approved-manager-${approval.id}`,
        templateData: { ...baseTemplateData, audience: "manager" },
        senderUserId: userId,
      });
    }

    return { ok: true };
  });
