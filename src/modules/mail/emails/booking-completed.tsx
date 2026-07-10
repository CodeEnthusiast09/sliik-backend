import { Heading, Section, Text } from '@react-email/components';
import {
  detailLabel,
  detailRow,
  details,
  detailValue,
  EmailLayout,
  muted,
  paragraph,
  title,
} from './components/email-layout';

interface BookingCompletedEmailProps {
  providerName: string;
  serviceName: string;
}

export function BookingCompletedEmail({
  providerName,
  serviceName,
}: BookingCompletedEmailProps) {
  return (
    <EmailLayout preview="Your appointment is complete">
      <Heading as="h2" style={title}>
        Appointment complete
      </Heading>
      <Text style={paragraph}>
        Your appointment with {providerName} is done. We hope it went well.
      </Text>
      <Section style={details}>
        <Section style={detailRow}>
          <Text style={detailLabel}>Provider</Text>
          <Text style={detailValue}>{providerName}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Service</Text>
          <Text style={detailValue}>{serviceName}</Text>
        </Section>
      </Section>
      <Text style={muted}>
        Enjoyed it? Leave {providerName} a review in the app. It helps other
        clients and supports the pro.
      </Text>
    </EmailLayout>
  );
}

export default BookingCompletedEmail;
