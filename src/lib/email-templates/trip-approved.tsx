import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  ownerName?: string
  managerName?: string
  tripTitle?: string
  tripDates?: string
  note?: string
  tripUrl?: string
  itineraryUrl?: string
  audience?: 'owner' | 'manager'
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#ecfdf5', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #10b981' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px',
  borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600,
}
const buttonSecondary = {
  backgroundColor: '#ffffff', color: '#0f172a', padding: '12px 20px',
  borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600,
  border: '1px solid #cbd5e1', marginLeft: '8px',
}
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ ownerName, managerName, tripTitle, tripDates, note, tripUrl, itineraryUrl, audience = 'owner' }: Props) {
  const isManager = audience === 'manager'
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {isManager
          ? `Approved itinerary: ${tripTitle ?? 'trip'}`
          : 'Your itinerary has been approved'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>
            {isManager ? 'Approved itinerary — your copy' : 'Itinerary approved'}
          </Heading>
          <Text>Hi {isManager ? (managerName ?? 'there') : (ownerName ?? 'there')},</Text>
          {isManager ? (
            <Text>
              You approved <strong>{ownerName ?? 'the traveller'}</strong>'s trip itinerary.
              A PDF copy is attached below for your records.
            </Text>
          ) : (
            <Text>
              <strong>{managerName ?? 'Your line manager'}</strong> has approved your trip itinerary.
              You can now work through the pre-trip checklist. A PDF copy of the approved itinerary
              is linked below.
            </Text>
          )}
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{tripTitle ?? 'Trip'}</Text>
            <Text style={{ margin: 0, ...muted }}>{tripDates ?? ''}</Text>
            {note ? <Text style={{ marginTop: '10px', fontSize: '14px' }}>"{note}"</Text> : null}
          </Section>
          <Section style={{ margin: '20px 0' }}>
            {itineraryUrl ? (
              <Button href={itineraryUrl} style={button}>Download itinerary (PDF)</Button>
            ) : null}
            {tripUrl ? (
              <Button href={tripUrl} style={itineraryUrl ? buttonSecondary : button}>Open trip</Button>
            ) : null}
          </Section>
          {itineraryUrl ? (
            <Text style={muted}>Download link expires in 30 days. Open the trip to grab a fresh copy any time.</Text>
          ) : null}
          <Text style={muted}>{isManager ? 'Thanks for reviewing.' : 'Safe travels.'}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d.audience === 'manager'
      ? `Approved itinerary copy: ${d.tripTitle ?? 'trip'}`
      : `Approved: ${d.tripTitle ?? 'your itinerary'}`,
  displayName: 'Trip approved',
  previewData: {
    ownerName: 'Jamie',
    managerName: 'Alex',
    tripTitle: 'Vietnam • Thailand — 3 Sep → 14 Sep 2026',
    tripDates: '3 Sep 2026 → 14 Sep 2026',
    note: 'Looks great — good luck!',
    tripUrl: 'https://orbishub.co.uk/trips/example',
    itineraryUrl: 'https://orbishub.co.uk/example.pdf',
    audience: 'owner',
  },
} satisfies TemplateEntry
