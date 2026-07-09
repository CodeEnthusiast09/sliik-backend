import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PasswordResetEmailProps {
  code: string;
  expiryMinutes: number;
}

export function PasswordResetEmail({
  code,
  expiryMinutes,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Sliik password reset code</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>Sliik</Heading>
          <Section style={card}>
            <Heading as="h2" style={title}>
              Reset your password
            </Heading>
            <Text style={paragraph}>
              Use the code below to reset your password. It expires in{' '}
              {expiryMinutes} minutes.
            </Text>
            <Section style={codeBox}>
              <Text style={codeText}>{code}</Text>
            </Section>
            <Text style={muted}>
              If you didn&apos;t request this, you can safely ignore this email.
              Your password won&apos;t change.
            </Text>
          </Section>
          <Text style={footer}>© Sliik</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;

const main = {
  backgroundColor: '#FBF8F3',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: '24px 0',
};

const container = {
  maxWidth: '440px',
  margin: '0 auto',
  padding: '0 16px',
};

const brand = {
  color: '#4B2E46',
  fontSize: '28px',
  fontWeight: 700,
  textAlign: 'center' as const,
  margin: '8px 0 20px',
};

const card = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #ECE7E0',
  borderRadius: '20px',
  padding: '28px 24px',
};

const title = {
  color: '#26242A',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 10px',
};

const paragraph = {
  color: '#26242A',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 20px',
};

const codeBox = {
  backgroundColor: '#F0E6EC',
  borderRadius: '14px',
  padding: '16px',
  textAlign: 'center' as const,
};

const codeText = {
  color: '#4B2E46',
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  margin: '0',
};

const muted = {
  color: '#817F80',
  fontSize: '13px',
  lineHeight: '19px',
  margin: '20px 0 0',
};

const footer = {
  color: '#817F80',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '20px 0 0',
};
