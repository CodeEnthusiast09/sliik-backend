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

interface BookingDeclinedEmailProps {
  providerName: string;
  serviceName: string;
}

export function BookingDeclinedEmail({
  providerName,
  serviceName,
}: BookingDeclinedEmailProps) {
  return (
    <EmailLayout preview="Your booking request was declined">
      <Heading as="h2" style={title}>
        Booking request declined
      </Heading>
      <Text style={paragraph}>
        {providerName} couldn&apos;t take your request this time.
      </Text>
      <Section style={details}>
        <Section style={detailRow}>
          <Text style={detailLabel}>Service</Text>
          <Text style={detailValue}>{serviceName}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Provider</Text>
          <Text style={detailValue}>{providerName}</Text>
        </Section>
      </Section>
      <Text style={muted}>
        Plenty of other pros are available. Find another time or provider in the
        app.
      </Text>
    </EmailLayout>
  );
}

export default BookingDeclinedEmail;
