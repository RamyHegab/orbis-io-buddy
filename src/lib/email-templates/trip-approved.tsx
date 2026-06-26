import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  ownerName?: string
  managerName?: string
  tripTitle?: string
  tripDates?: string
  note?: string
  tripUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#ecfdf5', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #10b981' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px',
  borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600,
}
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ ownerName, managerName, tripTitle, tripDates, note, tripUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your itinerary has been approved</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Itinerary approved</Heading>
          <Text>Hi {ownerName ?? 'there'},</Text>
          <Text>
            <strong>{managerName ?? 'Your line manager'}</strong> has approved your trip itinerary.
            You can now work through the pre-trip checklist.
          </Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{tripTitle ?? 'Trip'}</Text>
            <Text style={{ margin: 0, ...muted }}>{tripDates ?? ''}</Text>
            {note ? <Text style={{ marginTop: '10px', fontSize: '14px' }}>"{note}"</Text> : null}
          </Section>
          {tripUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={tripUrl} style={button}>Open trip</Button>
            </Section>
          ) : null}
          <Text style={muted}>Safe travels.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Approved: ${d.tripTitle ?? 'your itinerary'}`,
  displayName: 'Trip approved',
  previewData: {
    ownerName: 'Jamie',
    managerName: 'Alex',
    tripTitle: 'Vietnam • Thailand — 3 Sep → 14 Sep 2026',
    tripDates: '3 Sep 2026 → 14 Sep 2026',
    note: 'Looks great — good luck!',
    tripUrl: 'https://orbishub.co.uk/trips/example',
  },
} satisfies TemplateEntry
