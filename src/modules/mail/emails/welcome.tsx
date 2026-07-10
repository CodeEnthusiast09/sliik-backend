import { Heading, Text } from '@react-email/components';
import {
  EmailLayout,
  muted,
  paragraph,
  title,
} from './components/email-layout';

interface WelcomeEmailProps {
  fullName: string;
}

export function WelcomeEmail({ fullName }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Sliik">
      <Heading as="h2" style={title}>
        Welcome, {fullName}
      </Heading>
      <Text style={paragraph}>
        Your Sliik account is ready. Book trusted beauty and grooming pros near
        you, or take bookings if you&apos;re here to work. Everything happens in
        the app.
      </Text>
      <Text style={muted}>Glad to have you on board. See you inside.</Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;
