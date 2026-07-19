import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  refereeName?: string
  agentName?: string
  senderName?: string
  formUrl?: string | null
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 }
const muted = { color: '#64748b', fontSize: '13px' }

function Email({ refereeName, agentName, senderName, formUrl }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reference request for {agentName ?? 'an agent'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: '20px', margin: '0 0 12px' }}>Reference request</Heading>
          <Text>Hello {refereeName ?? 'there'},</Text>
          <Text>
            {senderName ?? 'Our team'} is considering partnering with{' '}
            <strong>{agentName ?? 'an education agent'}</strong>, and they have listed you as a
            professional reference. We would be grateful if you could share a brief reference.
          </Text>
          {formUrl ? (
            <Section style={{ margin: '20px 0' }}>
              <Button href={formUrl} style={button}>Provide reference</Button>
            </Section>
          ) : (
            <Text>Simply reply to this email with your comments.</Text>
          )}
          <Text style={muted}>Thank you for your time.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Reference request${d.agentName ? ` — ${d.agentName}` : ''}`,
  displayName: 'Agent onboarding — reference request',
  previewData: {
    refereeName: 'Dr Smith',
    agentName: 'Acme Education',
    senderName: 'Jamie',
    formUrl: 'https://orbishub.co.uk/f/t/refereetoken',
  },
} satisfies TemplateEntry
