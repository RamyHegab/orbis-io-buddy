import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/form-instance/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response(JSON.stringify({ error: "invalid id" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: fi, error } = await supabaseAdmin
          .from("form_instances")
          .select("id, name, event_date, country_code, template_id, activity_id")
          .eq("id", id)
          .maybeSingle();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        if (!fi) {
          return new Response(JSON.stringify({ error: "not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        let template: { name: string; description: string | null; fields: unknown } | null = null;
        if (fi.template_id) {
          const { data: t } = await supabaseAdmin
            .from("form_templates")
            .select("name, description, fields")
            .eq("id", fi.template_id)
            .maybeSingle();
          if (t) template = { name: t.name, description: t.description ?? null, fields: t.fields };
        }
        return new Response(
          JSON.stringify({
            id: fi.id,
            name: fi.name,
            event_date: fi.event_date,
            country_code: fi.country_code,
            template_id: fi.template_id,
            activity_id: fi.activity_id,
            template,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
