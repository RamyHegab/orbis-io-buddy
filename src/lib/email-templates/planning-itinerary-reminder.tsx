import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  travellerName?: string
  activityTitle?: string
  activityDates?: string
  planningUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#eff6ff', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #3b82f6' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ travellerName, activityTitle, activityDates, planningUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Time to start planning your trip: {activityTitle ?? 'upcoming activity'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Two months until your trip</Heading>
          <Text>Hi {travellerName ?? 'there'},</Text>
          <Text>This is a reminder that a planned activity is coming up in about two months. Time to open the itinerary planner and start booking.</Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{activityTitle ?? 'Planned activity'}</Text>
            <Text style={{ margin: 0, ...muted }}>{activityDates ?? ''}</Text>
          </Section>
          {planningUrl ? <Section style={{ margin: '20px 0' }}><Button href={planningUrl} style={button}>Open planning</Button></Section> : null}
          <Text style={muted}>You can create the trip from the Planning page.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Trip planning reminder: ${d.activityTitle ?? 'upcoming activity'}`,
  displayName: 'Planning — itinerary reminder',
  previewData: {
    travellerName: 'Jamie',
    activityTitle: 'Vietnam agent tour',
    activityDates: '3 Sep 2026 → 14 Sep 2026',
    planningUrl: 'https://orbishub.co.uk/planning',
  },
} satisfies TemplateEntry
