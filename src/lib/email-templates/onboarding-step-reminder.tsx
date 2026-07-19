import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  ownerName?: string
  agentName?: string
  stepLabel?: string
  detail?: string
  waitingDays?: number
  actionUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #0f172a' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ ownerName, agentName, stepLabel, detail, waitingDays, actionUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Onboarding step pending for {agentName ?? 'an agent'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Agent onboarding reminder</Heading>
          <Text>Hi {ownerName ?? 'there'},</Text>
          <Text>
            The following onboarding step is still open for <strong>{agentName ?? 'the agent'}</strong>
            {typeof waitingDays === 'number' ? ` (${waitingDays} days since the last update)` : ''}.
          </Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{stepLabel ?? 'Outstanding step'}</Text>
            {detail ? <Text style={{ margin: 0, ...muted }}>{detail}</Text> : null}
          </Section>
          {actionUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={actionUrl} style={button}>Open onboarding</Button>
            </Section>
          ) : null}
          <Text style={muted}>We'll remind you every week until this step is complete.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Onboarding reminder: ${d.stepLabel ?? 'pending step'}${d.agentName ? ` — ${d.agentName}` : ''}`,
  displayName: 'Agent onboarding — step reminder',
  previewData: {
    ownerName: 'Ramy',
    agentName: 'Bright Futures Consultancy',
    stepLabel: 'Reference requests sent',
    detail: '2 referees have not been contacted yet.',
    waitingDays: 7,
    actionUrl: 'https://orbishub.co.uk/onboarding',
  },
} satisfies TemplateEntry
