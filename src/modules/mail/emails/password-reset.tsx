import { Heading, Section, Text } from '@react-email/components';
import {
  EmailLayout,
  muted,
  paragraph,
  title,
} from './components/email-layout';

interface PasswordResetEmailProps {
  code: string;
  expiryMinutes: number;
}

export function PasswordResetEmail({
  code,
  expiryMinutes,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Your Sliik password reset code">
      <Heading as="h2" style={title}>
        Reset your password
      </Heading>
      <Text style={paragraph}>
        Use the code below to reset your password. It expires in {expiryMinutes}{' '}
        minutes.
      </Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={muted}>
        If you didn&apos;t request this, you can safely ignore this email. Your
        password won&apos;t change.
      </Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;

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
