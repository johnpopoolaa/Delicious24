import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotifChannel } from '@delicious24/db';
import { Twilio } from 'twilio';
import { PrismaService } from '../prisma/prisma.service';

function throwMissing(varName: string): never {
  throw new Error(`Missing required environment variable: ${varName}`);
}

export type SendReminderPayload = {
  scheduledJobId: string;
  creditId: string;
  reminderType: string;
  templateId: string;
};

export type SendAppreciationPayload = {
  scheduledJobId: string;
  customerId: string;
  orderId: string;
  templateId: string;
};

@Injectable()
export class NotificationSenderService {
  private readonly log = new Logger(NotificationSenderService.name);
  private readonly smsFrom: string;
  private readonly waFrom: string;
  private static readonly STATUS_SENT = 'SENT';
  private static readonly STATUS_FAILED = 'FAILED';

  constructor(
    private readonly prisma: PrismaService,
    @Inject('TWILIO_CLIENT') private readonly twilio: Twilio,
  ) {
    this.smsFrom = process.env.TWILIO_SMS_FROM ?? throwMissing('TWILIO_SMS_FROM');
    this.waFrom = process.env.TWILIO_WHATSAPP_FROM ?? throwMissing('TWILIO_WHATSAPP_FROM');
  }

  async sendReminder(payload: SendReminderPayload): Promise<void> {
    const credit = await this.prisma.credit.findUnique({
      where: { id: payload.creditId },
      include: { customer: true },
    });
    if (!credit) {
      throw new Error(`Credit ${payload.creditId} not found`);
    }
    const body = this.renderMessage(payload.templateId, {
      name: credit.customer.name,
      balance: credit.balance.toString(),
    });
    const channels = this.resolveChannels(credit.customer.notifChannel);
    await this.dispatchToChannels(payload.scheduledJobId, channels, credit.customer.phone, body);
  }

  async sendAppreciation(payload: SendAppreciationPayload): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) {
      throw new Error(`Customer ${payload.customerId} not found`);
    }
    const order =
      payload.orderId !== 'manual'
        ? await this.prisma.order.findUnique({ where: { id: payload.orderId } })
        : null;
    const amount = order ? order.total.toString() : '0.00';
    const body = this.renderMessage(payload.templateId, {
      name: customer.name,
      amount,
    });
    const channels = this.resolveChannels(customer.notifChannel);
    await this.dispatchToChannels(payload.scheduledJobId, channels, customer.phone, body);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async dispatchToChannels(
    scheduledJobId: string,
    channels: NotifChannel[],
    phone: string,
    body: string,
  ): Promise<void> {
    const errors: string[] = [];
    for (const channel of channels) {
      if (await this.alreadySent(scheduledJobId, channel)) {
        this.log.log(`Skipping ${channel} for job ${scheduledJobId} — already SENT`);
        continue;
      }
      await this.send(scheduledJobId, channel, phone, body, errors);
    }
    if (errors.length > 0) throw new Error(errors.join('; '));
  }

  private resolveChannels(notifChannel: NotifChannel): NotifChannel[] {
    if (notifChannel === NotifChannel.BOTH) return [NotifChannel.WHATSAPP, NotifChannel.SMS];
    return [notifChannel];
  }

  private async alreadySent(scheduledJobId: string, channel: NotifChannel): Promise<boolean> {
    const existing = await this.prisma.notificationLog.findFirst({
      where: { scheduledJobId, channel, status: NotificationSenderService.STATUS_SENT },
    });
    return !!existing;
  }

  private async send(
    scheduledJobId: string,
    channel: NotifChannel,
    phone: string,
    body: string,
    errors: string[],
  ): Promise<void> {
    const to = channel === NotifChannel.WHATSAPP ? `whatsapp:${phone}` : phone;
    const from =
      channel === NotifChannel.WHATSAPP ? `whatsapp:${this.waFrom}` : this.smsFrom;
    try {
      const result = await this.twilio.messages.create({ to, from, body });
      await this.prisma.notificationLog.create({
        data: { scheduledJobId, channel, toPhone: phone, messageSid: result.sid, status: NotificationSenderService.STATUS_SENT },
      });
      this.log.log(`${channel} sent to ${phone}: ${result.sid}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.notificationLog.create({
        data: { scheduledJobId, channel, toPhone: phone, status: NotificationSenderService.STATUS_FAILED, error: msg },
      });
      errors.push(`${channel}: ${msg}`);
    }
  }

  private renderMessage(
    templateId: string,
    vars: { name: string; balance?: string; amount?: string },
  ): string {
    switch (templateId) {
      case 'courtesy_v1':
      case 'manual_courtesy':
        return `Hello ${vars.name}, this is a reminder from Delicious24 that your balance of ₦${vars.balance} is due tomorrow. Kindly make your payment at your earliest convenience. Thank you.`;
      case 'urgent_v1':
      case 'manual_urgent':
        return `Hello ${vars.name}, your balance of ₦${vars.balance} with Delicious24 is due today. Please make your payment to avoid any inconvenience. Thank you.`;
      case 'overdue_v1':
      case 'manual_overdue':
        return `Hello ${vars.name}, your balance of ₦${vars.balance} with Delicious24 was due yesterday and is now overdue. Please settle your account as soon as possible. Contact us if you need assistance.`;
      case 'appreciation_v1':
        return `Thank you ${vars.name}! Your payment of ₦${vars.amount} has been received. We appreciate your business and look forward to serving you again at Delicious24.`;
      case 'manual_notice':
        return `Hello ${vars.name}, this is a reminder from Delicious24 that your balance of ₦${vars.balance} is outstanding. Please make your payment at your earliest convenience. Thank you.`;
      default:
        this.log.warn(`Unknown templateId '${templateId}', using generic message`);
        return `Hello ${vars.name}, this is a reminder from Delicious24. Please make your payment at your earliest convenience. Thank you.`;
    }
  }
}
