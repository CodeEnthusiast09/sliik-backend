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

interface BookingRequestEmailProps {
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  amount: string;
}

export function BookingRequestEmail({
  customerName,
  serviceName,
  scheduledAt,
  amount,
}: BookingRequestEmailProps) {
  return (
    <EmailLayout preview="New booking request">
      <Heading as="h2" style={title}>
        New booking request
      </Heading>
      <Text style={paragraph}>
        {customerName} requested a booking. Open Sliik to confirm or decline.
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
        <Section style={detailRow}>
          <Text style={detailLabel}>Amount</Text>
          <Text style={detailValue}>{amount}</Text>
        </Section>
      </Section>
      <Text style={muted}>
        Pending requests hold the slot until you respond.
      </Text>
    </EmailLayout>
  );
}

export default BookingRequestEmail;
