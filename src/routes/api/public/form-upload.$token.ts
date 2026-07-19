import { createFileRoute } from "@tanstack/react-router";

// Uploads a public form's file into agent-documents bucket, validated by token.
// Path layout: form-uploads/<instanceId>/<random>-<safeName>
export const Route = createFileRoute("/api/public/form-upload/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!token || !/^[A-Za-z0-9_-]{8,128}$/.test(token)) {
          return new Response(JSON.stringify({ error: "invalid token" }), { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: fi } = await supabaseAdmin
          .from("form_instances")
          .select("id, form_type")
          .eq("token", token)
          .maybeSingle();
        if (!fi) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

        const form = await request.formData();
        const file = form.get("file");
        const fieldId = String(form.get("field_id") ?? "unknown");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "file missing" }), { status: 400 });
        }
        const maxBytes = 20 * 1024 * 1024;
        if (file.size > maxBytes) {
          return new Response(JSON.stringify({ error: "file too large (max 20MB)" }), { status: 413 });
        }
        const safe = (file.name || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 120);
        const path = `form-uploads/${fi.id}/${crypto.randomUUID()}-${safe}`;
        const buf = new Uint8Array(await file.arrayBuffer());
        const { error } = await supabaseAdmin.storage
          .from("agent-documents")
          .upload(path, buf, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        return new Response(
          JSON.stringify({
            path,
            name: file.name,
            size: file.size,
            content_type: file.type || null,
            field_id: fieldId,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
