// Server-only: generate the trip itinerary PDF, upload to the
// `trip-itineraries` private bucket, and return a signed download URL.
import { buildTripPdfBytes, tripPdfFilename } from "@/lib/trip-export";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "trip-itineraries";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function generateAndUploadTripItineraryPdf(
  tripId: string,
  opts: { origin?: string; pathSuffix?: string } = {},
): Promise<{ url: string | null; path: string | null; filename: string | null }> {
  const { data: trip, error: tErr } = await supabaseAdmin
    .from("trips")
    .select("id, title, start_date, end_date, objectives")
    .eq("id", tripId)
    .maybeSingle();
  if (tErr || !trip) {
    console.error("itinerary pdf: trip fetch failed", tErr);
    return { url: null, path: null, filename: null };
  }

  const { data: activities, error: aErr } = await supabaseAdmin
    .from("activities")
    .select(
      "*, agents(trading_name), schools(name, address, lat, lng, place_id, formatted_address), agent_branches(branch_name, city, address, lat, lng, place_id, formatted_address)",
    )
    .eq("trip_id", tripId)
    .order("day_date")
    .order("start_time");
  if (aErr) {
    console.error("itinerary pdf: activities fetch failed", aErr);
    return { url: null, path: null, filename: null };
  }

  const { data: hotels } = await supabaseAdmin
    .from("trip_hotels")
    .select("check_in_date, check_out_date, cost, cost_currency")
    .eq("trip_id", tripId);

  let bytes: Uint8Array;
  try {
    bytes = buildTripPdfBytes(
      trip as any,
      (activities ?? []) as any,
      (hotels ?? []) as any,
      { origin: opts.origin },
    );
  } catch (e) {
    console.error("itinerary pdf: build failed", e);
    return { url: null, path: null, filename: null };
  }

  const filename = tripPdfFilename(trip as any);
  const suffix = opts.pathSuffix ?? Date.now().toString();
  const path = `${tripId}/${suffix}.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    console.error("itinerary pdf: upload failed", upErr);
    return { url: null, path: null, filename };
  }

  const { data: signed, error: sErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (sErr || !signed?.signedUrl) {
    console.error("itinerary pdf: sign url failed", sErr);
    return { url: null, path, filename };
  }

  return { url: signed.signedUrl, path, filename };
}
