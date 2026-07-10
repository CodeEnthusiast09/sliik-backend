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

interface BookingConfirmedEmailProps {
  providerName: string;
  serviceName: string;
  scheduledAt: string;
  amount: string;
}

export function BookingConfirmedEmail({
  providerName,
  serviceName,
  scheduledAt,
  amount,
}: BookingConfirmedEmailProps) {
  return (
    <EmailLayout preview="Your booking is confirmed">
      <Heading as="h2" style={title}>
        Booking confirmed
      </Heading>
      <Text style={paragraph}>
        {providerName} confirmed your booking. Here are the details.
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
        <Section style={detailRow}>
          <Text style={detailLabel}>When</Text>
          <Text style={detailValue}>{scheduledAt}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Amount</Text>
          <Text style={detailValue}>{amount}</Text>
        </Section>
      </Section>
      <Text style={muted}>
        Need to change something? Manage this booking in the app.
      </Text>
    </EmailLayout>
  );
}

export default BookingConfirmedEmail;
