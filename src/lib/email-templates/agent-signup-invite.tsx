import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  agentName?: string
  senderName?: string
  formUrl?: string
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ agentName, senderName, formUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Please complete the agent application form for {agentName ?? 'your agency'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Agent application form</Heading>
          <Text>Hello,</Text>
          <Text>
            {senderName ?? 'Our team'} has invited {agentName ?? 'your agency'} to complete our
            agent application. Please fill out the secure form below — it collects the details
            and documents we need to onboard your agency.
          </Text>
          {formUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={formUrl} style={button}>Open application form</Button>
            </Section>
          ) : null}
          <Text style={muted}>If you have any questions, reply to this email.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Agent application form${d.agentName ? ` — ${d.agentName}` : ''}`,
  displayName: 'Agent onboarding — signup invite',
  previewData: {
    agentName: 'Acme Education',
    senderName: 'Jamie',
    formUrl: 'https://orbishub.co.uk/f/t/abcdef',
  },
} satisfies TemplateEntry
