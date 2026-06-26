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
const card = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #ef4444' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px',
  borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600,
}
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ ownerName, managerName, tripTitle, tripDates, note, tripUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Changes requested on your itinerary</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Changes requested</Heading>
          <Text>Hi {ownerName ?? 'there'},</Text>
          <Text>
            <strong>{managerName ?? 'Your line manager'}</strong> has reviewed your itinerary and asked for some changes
            before approving it.
          </Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{tripTitle ?? 'Trip'}</Text>
            <Text style={{ margin: 0, ...muted }}>{tripDates ?? ''}</Text>
            {note ? <Text style={{ marginTop: '10px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>"{note}"</Text> : null}
          </Section>
          {tripUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={tripUrl} style={button}>Update itinerary</Button>
            </Section>
          ) : null}
          <Text style={muted}>The trip is back in your "In progress" list. Submit again once you've made the changes.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Changes requested: ${d.tripTitle ?? 'your itinerary'}`,
  displayName: 'Trip changes requested',
  previewData: {
    ownerName: 'Jamie',
    managerName: 'Alex',
    tripTitle: 'Vietnam • Thailand — 3 Sep → 14 Sep 2026',
    tripDates: '3 Sep 2026 → 14 Sep 2026',
    note: 'Please add costs for the Bangkok hotel and confirm the agent visit on Day 4.',
    tripUrl: 'https://orbishub.co.uk/trips/example',
  },
} satisfies TemplateEntry
