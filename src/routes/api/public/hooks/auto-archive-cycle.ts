import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Daily job: if today > cycle_end_date, archive all trips/planned_activities/events_catalog
// whose start_date falls within [cycle_start_date, cycle_end_date] and are not yet archived.
export const Route = createFileRoute("/api/public/hooks/auto-archive-cycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice("Bearer ".length).trim()
          : (request.headers.get("apikey") ?? "").trim();
        if (!token || !serviceKey || token !== serviceKey) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }


        const url = process.env.SUPABASE_URL!;

        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: settings, error: sErr } = await admin
          .from("app_settings")
          .select("cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year")
          .eq("id", 1)
          .maybeSingle();

        if (sErr || !settings) {
          return new Response(
            JSON.stringify({ success: false, error: sErr?.message ?? "No app_settings" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const { cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year } = settings;
        const pad = (n: number) => String(n).padStart(2, "0");
        const startDate = `${cycle_start_year}-${pad(cycle_start_month)}-01`;
        // end-of-month for cycle_end_month/year
        const endOfMonthDay = new Date(Date.UTC(cycle_end_year, cycle_end_month, 0)).getUTCDate();
        const endDate = `${cycle_end_year}-${pad(cycle_end_month)}-${pad(endOfMonthDay)}`;

        const today = new Date().toISOString().slice(0, 10);
        if (today <= endDate) {
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "Cycle not ended", endDate, today }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        const cycleLabel = `${cycle_start_year}-${cycle_end_year}`;
        const stamp = {
          archived: true,
          archived_cycle: cycleLabel,
          archived_at: new Date().toISOString(),
        };

        const results: Record<string, number> = {};
        for (const table of ["trips", "planned_activities", "events_catalog"] as const) {
          const { data, error } = await admin
            .from(table)
            .update(stamp)
            .gte("start_date", startDate)
            .lte("start_date", endDate)
            .eq("archived", false)
            .select("id");
          if (error) {
            return new Response(
              JSON.stringify({ success: false, table, error: error.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
          results[table] = data?.length ?? 0;
        }

        return new Response(
          JSON.stringify({ success: true, cycle: cycleLabel, archived: results }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
