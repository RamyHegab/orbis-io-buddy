// Server-only helper: resolves a user's system-sender identity.
// Import only from server routes / server functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSystemAddress,
  formatFromHeader,
} from "@/lib/system-email";

export type ResolvedSender = {
  from?: string;
  replyTo?: string;
};

/**
 * Returns From/Reply-To headers to use when a system email is sent on behalf
 * of a specific user. Falls back to `{}` when the account has no verified
 * subdomain or the user has no local part configured — the send route will
 * then use the default `noreply@` sender.
 */
export async function getSenderFor(userId: string | null | undefined): Promise<ResolvedSender> {
  if (!userId) return {};
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email_local_part")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_settings")
      .select("sender_subdomain")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const address = buildSystemAddress(
    (profile as any)?.email_local_part ?? null,
    (settings as any)?.sender_subdomain ?? null,
  );
  if (!address) return {};

  return {
    from: formatFromHeader((profile as any)?.full_name ?? null, address),
    replyTo: address,
  };
}
