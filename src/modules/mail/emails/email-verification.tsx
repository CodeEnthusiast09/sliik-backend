import { Heading, Section, Text } from '@react-email/components';
import {
  EmailLayout,
  muted,
  paragraph,
  title,
} from './components/email-layout';

interface EmailVerificationEmailProps {
  code: string;
  expiryMinutes: number;
}

export function EmailVerificationEmail({
  code,
  expiryMinutes,
}: EmailVerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your Sliik email">
      <Heading as="h2" style={title}>
        Verify your email
      </Heading>
      <Text style={paragraph}>
        Use the code below to verify your email and finish setting up your
        account. It expires in {expiryMinutes} minutes.
      </Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={muted}>
        If you didn&apos;t create a Sliik account, you can safely ignore this
        email.
      </Text>
    </EmailLayout>
  );
}

export default EmailVerificationEmail;

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
