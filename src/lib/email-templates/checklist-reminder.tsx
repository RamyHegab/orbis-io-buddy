import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  ownerName?: string
  tripTitle?: string
  tripDates?: string
  outstanding?: string[]
  tripUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#fff7ed', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #d4a017' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ ownerName, tripTitle, tripDates, outstanding, tripUrl }: Props) {
  const items = outstanding ?? []
  return (
    <Html lang="en">
      <Head />
      <Preview>Pre-trip checklist items still open for {tripTitle ?? 'your trip'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Pre-trip checklist reminder</Heading>
          <Text>Hi {ownerName ?? 'there'},</Text>
          <Text>Your itinerary is approved. A few pre-trip checklist items are still open:</Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{tripTitle ?? 'Your trip'}</Text>
            <Text style={{ margin: '0 0 8px', ...muted }}>{tripDates ?? ''}</Text>
            {items.length > 0 && (
              <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                {items.map((it) => (
                  <li key={it} style={{ marginBottom: 4 }}>{it}</li>
                ))}
              </ul>
            )}
          </Section>
          {tripUrl ? <Section style={{ margin: '20px 0' }}><Button href={tripUrl} style={button}>Open trip</Button></Section> : null}
          <Text style={muted}>We'll remind you every 3 days until everything is ticked off.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Pre-trip checklist reminder: ${d.tripTitle ?? 'your trip'}`,
  displayName: 'Trip — checklist reminder',
  previewData: {
    ownerName: 'Jamie',
    tripTitle: 'Vietnam agent tour',
    tripDates: '3 Sep 2026 → 14 Sep 2026',
    outstanding: ['Parcel sent', 'Appointments booked'],
    tripUrl: 'https://orbishub.co.uk/trips/123',
  },
} satisfies TemplateEntry
