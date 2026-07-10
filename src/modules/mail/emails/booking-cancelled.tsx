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

interface BookingCancelledEmailProps {
  cancellerName: string;
  serviceName: string;
  scheduledAt: string;
}

export function BookingCancelledEmail({
  cancellerName,
  serviceName,
  scheduledAt,
}: BookingCancelledEmailProps) {
  return (
    <EmailLayout preview="Your booking was cancelled">
      <Heading as="h2" style={title}>
        Booking cancelled
      </Heading>
      <Text style={paragraph}>
        {cancellerName} cancelled the booking below.
      </Text>
      <Section style={details}>
        <Section style={detailRow}>
          <Text style={detailLabel}>Service</Text>
          <Text style={detailValue}>{serviceName}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>When</Text>
          <Text style={detailValue}>{scheduledAt}</Text>
        </Section>
      </Section>
      <Text style={muted}>
        The slot is free again. You can rebook anytime in the app.
      </Text>
    </EmailLayout>
  );
}

export default BookingCancelledEmail;
