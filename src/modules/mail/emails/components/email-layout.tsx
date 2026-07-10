import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

// The "S" mark is attached inline per-send as a CID (see MailService), because
// email clients (Gmail especially) strip SVG and remote data URIs. The wordmark
// "liik" stays live text tucked against the mark, matching the app splash.
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="cid:sliik-mark"
              alt="Sliik"
              width={26}
              height={34}
              style={mark}
            />
            <span style={wordmark}>liik</span>
          </Section>
          <Section style={card}>{children}</Section>
          <Text style={footer}>© Sliik</Text>
        </Container>
      </Body>
    </Html>
  );
}

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

const header = {
  textAlign: 'center' as const,
  margin: '8px 0 20px',
};

const mark = {
  display: 'inline-block',
  verticalAlign: 'middle',
};

const wordmark = {
  display: 'inline-block',
  verticalAlign: 'middle',
  color: '#4B2E46',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '30px',
  fontWeight: 700,
  letterSpacing: '-1px',
  marginLeft: '-2px',
};

const card = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #ECE7E0',
  borderRadius: '20px',
  padding: '28px 24px',
};

const footer = {
  color: '#817F80',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '20px 0 0',
};

// Shared content styles used across templates.
export const title = {
  color: '#26242A',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 10px',
};

export const paragraph = {
  color: '#26242A',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 20px',
};

export const muted = {
  color: '#817F80',
  fontSize: '13px',
  lineHeight: '19px',
  margin: '20px 0 0',
};

export const details = {
  backgroundColor: '#FBF8F3',
  border: '1px solid #ECE7E0',
  borderRadius: '14px',
  padding: '4px 16px',
};

export const detailRow = {
  margin: '12px 0',
};

export const detailLabel = {
  color: '#817F80',
  fontSize: '12px',
  margin: '0 0 2px',
};

export const detailValue = {
  color: '#26242A',
  fontSize: '15px',
  fontWeight: 600,
  margin: '0',
};
