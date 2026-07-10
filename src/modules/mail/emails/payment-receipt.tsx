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

interface PaymentReceiptEmailProps {
  providerName: string;
  serviceName: string;
  amount: string;
  reference: string;
}

export function PaymentReceiptEmail({
  providerName,
  serviceName,
  amount,
  reference,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout preview="Payment receipt">
      <Heading as="h2" style={title}>
        Payment received
      </Heading>
      <Text style={paragraph}>
        Your payment went through. Here&apos;s your receipt.
      </Text>
      <Section style={details}>
        <Section style={detailRow}>
          <Text style={detailLabel}>Amount</Text>
          <Text style={detailValue}>{amount}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Service</Text>
          <Text style={detailValue}>{serviceName}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Provider</Text>
          <Text style={detailValue}>{providerName}</Text>
        </Section>
        <Section style={detailRow}>
          <Text style={detailLabel}>Reference</Text>
          <Text style={detailValue}>{reference}</Text>
        </Section>
      </Section>
      <Text style={muted}>Keep this email for your records.</Text>
    </EmailLayout>
  );
}

export default PaymentReceiptEmail;
