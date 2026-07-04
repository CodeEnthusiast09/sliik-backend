import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class ExpoPushService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(ExpoPushService.name);

  // Returns the subset of `tokens` that Expo reported as no longer
  // registered, so the caller can prune them from device_push_tokens.
  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<string[]> {
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    if (!validTokens.length) return [];

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }));

    // Zip each chunk's tickets with that same chunk's messages (rather than
    // a running index into `validTokens`) - a chunk that throws is skipped
    // entirely, which would otherwise desync a flat index across chunks.
    const staleTokens: string[] = [];
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error('Expo push send failed', error);
        continue;
      }
      tickets.forEach((ticket, index) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
        ) {
          staleTokens.push(chunk[index].to as string);
        }
      });
    }
    return staleTokens;
  }
}
