import { createFileRoute } from '@tanstack/react-router'

const APP_URL = 'https://orbis-io-buddy.lovable.app'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Which checklist item_keys we send weekly reminders for. Each maps to a
// natural-language description shown in the email.
const REMINDER_ITEMS: Record<string, string> = {
  signup_form_sent: 'Send the agent application form to the main contact.',
  reference_requests_sent: 'Send reference request emails to each referee provided by the agent.',
  british_council_received: 'Collect and check the British Council certificate.',
  company_reg_received: 'Collect and check the company registration and related documents.',
  supporting_docs_received: 'Collect and check supporting documents.',
}

export const Route = createFileRoute('/api/public/hooks/onboarding-reminders')({
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
        const now = Date.now()
        const nowIso = new Date(now).toISOString()
        const cutoffIso = new Date(now - WEEK_MS).toISOString()

        // Active onboardings only (not approved yet, not rejected)
        const { data: onboardings = [] } = await supabaseAdmin
          .from('agent_onboarding')
          .select(
            `id, status, started_by, contact_email, created_at,
             agent:agents!agent_onboarding_agent_id_fkey(id, trading_name)`,
          )
          .in('status', ['in_progress', 'submitted'])

        let sent = 0

        for (const onb of onboardings ?? []) {
          const agent = (onb as any).agent
          if (!agent) continue

          const { data: recipient } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', onb.started_by)
            .maybeSingle()
          if (!recipient?.email) continue

          const actionUrl = `${APP_URL}/onboarding`

          // ---- 1) Per-item checklist reminders ----
          const { data: items = [] } = await supabaseAdmin
            .from('agent_onboarding_checklist')
            .select('id, item_key, label, done, last_reminder_at, created_at')
            .eq('onboarding_id', onb.id)
            .eq('done', false)
            .in('item_key', Object.keys(REMINDER_ITEMS))

          for (const item of items ?? []) {
            const anchor = item.last_reminder_at ?? item.created_at ?? onb.created_at
            if (anchor && anchor > cutoffIso) continue

            const waitingDays = Math.max(
              1,
              Math.floor((now - new Date(anchor ?? nowIso).getTime()) / (24 * 60 * 60 * 1000)),
            )

            let detail = REMINDER_ITEMS[item.item_key]
            // Extra detail for references: count outstanding referees
            if (item.item_key === 'reference_requests_sent') {
              const { count } = await supabaseAdmin
                .from('agent_references')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .is('request_sent_at', null)
              if (typeof count === 'number' && count > 0) {
                detail = `${count} referee${count === 1 ? '' : 's'} still need${count === 1 ? 's' : ''} a reference request.`
              }
            }

            await supabaseAdmin.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                template_name: 'onboarding-step-reminder',
                recipient_email: recipient.email,
                idempotency_key: `onb-item-${item.id}-${nowIso.slice(0, 10)}`,
                template_data: {
                  ownerName: recipient.full_name ?? '',
                  agentName: agent.trading_name,
                  stepLabel: item.label,
                  detail,
                  waitingDays,
                  actionUrl,
                },
              },
            })

            await supabaseAdmin
              .from('agent_onboarding_checklist')
              .update({ last_reminder_at: nowIso })
              .eq('id', item.id)

            await supabaseAdmin.from('notifications').insert({
              user_id: onb.started_by,
              type: 'onboarding_reminder',
              title: `Onboarding reminder: ${item.label}`,
              body: `${agent.trading_name} — ${detail}`,
            })

            sent++
          }

          // ---- 2) Per-referee reminders (unsent requests) ----
          const { data: refs = [] } = await supabaseAdmin
            .from('agent_references')
            .select('id, name, email, last_reminder_at, created_at')
            .eq('agent_id', agent.id)
            .is('request_sent_at', null)

          for (const ref of refs ?? []) {
            const anchor = ref.last_reminder_at ?? ref.created_at
            if (anchor && anchor > cutoffIso) continue

            await supabaseAdmin.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                template_name: 'onboarding-step-reminder',
                recipient_email: recipient.email,
                idempotency_key: `onb-ref-${ref.id}-${nowIso.slice(0, 10)}`,
                template_data: {
                  ownerName: recipient.full_name ?? '',
                  agentName: agent.trading_name,
                  stepLabel: 'Reference request pending',
                  detail: `No request sent yet to ${ref.name ?? ref.email}.`,
                  actionUrl,
                },
              },
            })

            await supabaseAdmin
              .from('agent_references')
              .update({ last_reminder_at: nowIso })
              .eq('id', ref.id)

            sent++
          }
        }

        return new Response(JSON.stringify({ ok: true, sent }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
