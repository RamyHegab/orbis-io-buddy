// Tiny offline submission queue backed by localStorage.
// One queue per form instance so we can show pending counts per page.
import { supabase } from "@/integrations/supabase/client";

const KEY_PREFIX = "orbis.form.queue.";

export interface QueuedSubmission {
  id: string;
  instance_id: string;
  template_id: string;
  activity_id: string;
  data: Record<string, unknown>;
  submitter_name?: string | null;
  submitter_phone?: string | null;
  queued_at: number;
}

function readQueue(instanceId: string): QueuedSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + instanceId);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(instanceId: string, items: QueuedSubmission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + instanceId, JSON.stringify(items));
}

export function getPendingCount(instanceId: string): number {
  return readQueue(instanceId).length;
}

export function enqueueSubmission(item: Omit<QueuedSubmission, "id" | "queued_at">): QueuedSubmission {
  const queued: QueuedSubmission = {
    ...item,
    id: crypto.randomUUID(),
    queued_at: Date.now(),
  };
  const all = readQueue(item.instance_id);
  all.push(queued);
  writeQueue(item.instance_id, all);
  return queued;
}

export async function flushQueue(instanceId: string): Promise<{ uploaded: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine) return { uploaded: 0, failed: 0 };
  const items = readQueue(instanceId);
  if (items.length === 0) return { uploaded: 0, failed: 0 };
  const remaining: QueuedSubmission[] = [];
  let uploaded = 0;
  let failed = 0;
  for (const item of items) {
    const { error } = await supabase.from("form_submissions").insert({
      instance_id: item.instance_id,
      template_id: item.template_id,
      activity_id: item.activity_id,
      data: item.data as any,
      submitter_name: item.submitter_name ?? null,
      submitter_phone: item.submitter_phone ?? null,
    });
    if (error) {
      failed += 1;
      remaining.push(item);
    } else {
      uploaded += 1;
    }
  }
  writeQueue(instanceId, remaining);
  return { uploaded, failed };
}
