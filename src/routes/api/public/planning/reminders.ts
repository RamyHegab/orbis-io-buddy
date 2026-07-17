import { createFileRoute } from '@tanstack/react-router'

const APP_URL = 'https://orbis-io-buddy.lovable.app'

export const Route = createFileRoute('/api/public/planning/reminders')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const today = new Date()
        const iso = (d: Date) => d.toISOString().slice(0, 10)
        // 55–65 days ahead window for the 2-month reminder
        const from = new Date(today); from.setDate(from.getDate() + 55)
        const to = new Date(today); to.setDate(to.getDate() + 65)

        // 1) Itinerary reminder
        const { data: upcoming = [] } = await supabaseAdmin
          .from('planned_activities')
          .select('id, title, start_date, end_date, traveller_id, user_id, reminder_sent_at, trip_id, status')
          .is('trip_id', null)
          .is('reminder_sent_at', null)
          .in('status', ['planning', 'confirmed'])
          .gte('start_date', iso(from))
          .lte('start_date', iso(to))

        for (const a of upcoming ?? []) {
          const recipientId = a.traveller_id ?? a.user_id
          const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', recipientId).maybeSingle()
          if (!prof?.email) continue
          await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              template_name: 'planning-itinerary-reminder',
              recipient_email: prof.email,
              idempotency_key: `plan-reminder-${a.id}`,
              template_data: {
                travellerName: prof.full_name ?? '',
                activityTitle: a.title,
                activityDates: `${a.start_date} → ${a.end_date}`,
                planningUrl: `${APP_URL}/planning`,
              },
            },
          })
          await supabaseAdmin.from('planned_activities').update({ reminder_sent_at: new Date().toISOString() }).eq('id', a.id)
          await supabaseAdmin.from('notifications').insert({
            user_id: recipientId,
            title: 'Trip planning reminder',
            body: `${a.title} starts in ~2 months. Open the itinerary planner.`,
            kind: 'planning_reminder',
          }).select()
        }

        // 2) Actual costs reminder — after end_date, no actuals, status confirmed/done
        const { data: needsActuals = [] } = await supabaseAdmin
          .from('planned_activities')
          .select('id, title, start_date, end_date, traveller_id, user_id, actual_cost_reminder_sent_at, actual_events_cost, actual_travel_cost, actual_hotel_cost, actual_subsistence_cost, status')
          .is('actual_cost_reminder_sent_at', null)
          .in('status', ['confirmed', 'done'])
          .lt('end_date', iso(today))

        for (const a of needsActuals ?? []) {
          const hasAny = a.actual_events_cost != null || a.actual_travel_cost != null || a.actual_hotel_cost != null || a.actual_subsistence_cost != null
          if (hasAny) continue
          const recipientId = a.traveller_id ?? a.user_id
          const { data: prof } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', recipientId).maybeSingle()
          if (!prof?.email) continue
          await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              template_name: 'planning-actual-costs-reminder',
              recipient_email: prof.email,
              idempotency_key: `plan-actuals-${a.id}`,
              template_data: {
                travellerName: prof.full_name ?? '',
                activityTitle: a.title,
                activityDates: `${a.start_date} → ${a.end_date}`,
                planningUrl: `${APP_URL}/planning`,
              },
            },
          })
          await supabaseAdmin.from('planned_activities').update({ actual_cost_reminder_sent_at: new Date().toISOString() }).eq('id', a.id)
          await supabaseAdmin.from('notifications').insert({
            user_id: recipientId,
            title: 'Submit actual trip costs',
            body: `Log the actual costs for ${a.title}.`,
            kind: 'actual_costs_reminder',
          }).select()
        }

        return new Response(JSON.stringify({ ok: true, itinerary_reminders: upcoming?.length ?? 0, actual_cost_reminders: needsActuals?.length ?? 0 }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
