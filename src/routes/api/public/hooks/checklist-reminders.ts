import { createFileRoute } from '@tanstack/react-router'

const APP_URL = 'https://orbis-io-buddy.lovable.app'
const ITEM_LABELS: Record<string, string> = {
  parcel_sent: 'Parcel sent',
  book_appointment: 'Appointments booked',
  book_flights_hotels: 'Hotels and flights booked',
  risk_assessment: 'Review risk assessment',
}

function outstandingItems(checklist: any): string[] {
  const c = (checklist ?? {}) as Record<string, any>
  const out: string[] = []
  // itinerary_approved is auto — only remind on user items if the trip is approved
  for (const k of Object.keys(ITEM_LABELS)) {
    if (!c[k]) out.push(ITEM_LABELS[k])
  }
  const freight = c.freight_required
  if (freight !== 'yes' && freight !== 'no') out.push('Freight required? (Yes/No)')
  return out
}

export const Route = createFileRoute('/api/public/hooks/checklist-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const authHeader = request.headers.get('authorization') ?? ''
        const token = authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : (request.headers.get('apikey') ?? '').trim()
        if (!serviceKey || !token || token !== serviceKey) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const today = new Date().toISOString().slice(0, 10)

        const nowIso = new Date().toISOString()
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

        // Approved trips that haven't ended yet
        const { data: trips = [] } = await supabaseAdmin
          .from('trips')
          .select('id, user_id, title, start_date, end_date, checklist, status')
          .in('status', ['approved', 'confirmed'])
          .gte('end_date', today)

        let sent = 0
        for (const t of trips ?? []) {
          const outstanding = outstandingItems(t.checklist)
          if (outstanding.length === 0) continue
          const last = (t.checklist as any)?._reminder_last_sent_at as string | undefined
          if (last && last > threeDaysAgo) continue

          const { data: prof } = await supabaseAdmin
            .from('profiles').select('email, full_name').eq('id', t.user_id).maybeSingle()
          if (!prof?.email) continue

          await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              template_name: 'checklist-reminder',
              recipient_email: prof.email,
              idempotency_key: `checklist-${t.id}-${today}`,
              template_data: {
                ownerName: prof.full_name ?? '',
                tripTitle: t.title,
                tripDates: `${t.start_date} → ${t.end_date}`,
                outstanding,
                tripUrl: `${APP_URL}/trips/${t.id}`,
              },
            },
          })
          await supabaseAdmin
            .from('trips')
            .update({ checklist: { ...((t.checklist as Record<string, any>) ?? {}), _reminder_last_sent_at: nowIso } })
            .eq('id', t.id)
          await supabaseAdmin.from('notifications').insert({
            user_id: t.user_id,
            type: 'checklist_reminder',
            trip_id: t.id,
            title: `Pre-trip checklist reminder: ${t.title}`,
            body: outstanding.join(', '),
          })
          sent++
        }

        return new Response(JSON.stringify({ ok: true, sent }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
