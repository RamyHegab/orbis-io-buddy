import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  managerName?: string
  ownerName?: string
  tripTitle?: string
  tripDates?: string
  objectives?: string
  tripUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', margin: '12px 0' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px',
  borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600,
}
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ managerName, ownerName, tripTitle, tripDates, objectives, tripUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{ownerName ?? 'A team member'} submitted an itinerary for your approval</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Itinerary awaiting approval</Heading>
          <Text>Hi {managerName ?? 'there'},</Text>
          <Text>
            <strong>{ownerName ?? 'A team member'}</strong> has submitted a trip itinerary for your approval.
          </Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{tripTitle ?? 'Trip'}</Text>
            <Text style={{ margin: 0, ...muted }}>{tripDates ?? ''}</Text>
            {objectives ? <Text style={{ marginTop: '10px', fontSize: '14px' }}>{objectives}</Text> : null}
          </Section>
          {tripUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={tripUrl} style={button}>Review itinerary</Button>
            </Section>
          ) : null}
          <Text style={muted}>You can approve it or send it back with comments from the trip page or your Inbox.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Approval needed: ${d.tripTitle ?? 'trip itinerary'}`,
  displayName: 'Trip submitted for approval',
  previewData: {
    managerName: 'Alex',
    ownerName: 'Jamie',
    tripTitle: 'Vietnam • Thailand — 3 Sep → 14 Sep 2026',
    tripDates: '3 Sep 2026 → 14 Sep 2026',
    objectives: 'Attend IDP fairs and visit agents in HCMC and Bangkok.',
    tripUrl: 'https://orbishub.co.uk/trips/example',
  },
} satisfies TemplateEntry
