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
const card = { backgroundColor: '#fef3c7', borderRadius: '8px', padding: '16px', margin: '12px 0', borderLeft: '4px solid #f59e0b' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ travellerName, activityTitle, activityDates, planningUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Submit actual costs for {activityTitle ?? 'your recent trip'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Submit actual costs</Heading>
          <Text>Hi {travellerName ?? 'there'},</Text>
          <Text>Your trip has finished. Please log the actual costs for reporting.</Text>
          <Section style={card}>
            <Text style={{ margin: '0 0 6px', fontWeight: 600 }}>{activityTitle ?? 'Activity'}</Text>
            <Text style={{ margin: 0, ...muted }}>{activityDates ?? ''}</Text>
          </Section>
          {planningUrl ? <Section style={{ margin: '20px 0' }}><Button href={planningUrl} style={button}>Submit actual costs</Button></Section> : null}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Actual costs needed: ${d.activityTitle ?? 'trip'}`,
  displayName: 'Planning — actual costs reminder',
  previewData: {
    travellerName: 'Jamie',
    activityTitle: 'Vietnam agent tour',
    activityDates: '3 Sep 2026 → 14 Sep 2026',
    planningUrl: 'https://orbishub.co.uk/planning',
  },
} satisfies TemplateEntry
