import { Injectable, Logger } from '@nestjs/common';

/**
 * Pluggable outbound channel; replace with SMS/WhatsApp/email adapters.
 */
@Injectable()
export class NotificationSenderService {
  private readonly log = new Logger(NotificationSenderService.name);

  async sendReminder(payload: {
    jobKey: string;
    customerPhone: string;
    reminderType: string;
    templateId: string;
  }): Promise<void> {
    this.log.log(
      `[REMINDER] to=${payload.customerPhone} type=${payload.reminderType} template=${payload.templateId} key=${payload.jobKey}`,
    );
  }

  async sendAppreciation(payload: { customerPhone: string; orderId: string; templateId: string }): Promise<void> {
    this.log.log(`[THANK_YOU] to=${payload.customerPhone} order=${payload.orderId} template=${payload.templateId}`);
  }
}
