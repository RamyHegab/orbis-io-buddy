import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/form-by-token/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 8 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
          return new Response(JSON.stringify({ error: "invalid token" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const client = createClient<Database>(process.env.SUPABASE_URL!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await client.rpc("get_form_instance_by_token", { p_token: token });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          return new Response(JSON.stringify({ error: "not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            id: row.id,
            name: row.name,
            event_date: row.event_date,
            country_code: row.country_code,
            template_id: row.template_id,
            activity_id: row.activity_id,
            form_type: row.form_type,
            template: row.template_id
              ? {
                  name: row.template_name,
                  description: row.template_description,
                  fields: row.template_fields,
                  parts: row.template_parts,
                  is_active: row.template_active,
                }
              : null,
          }),
          { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
      },
    },
  },
});
