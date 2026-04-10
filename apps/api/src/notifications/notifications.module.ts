import { Module } from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationSenderService } from './notification-sender.service';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationSenderService,
    {
      provide: 'TWILIO_CLIENT',
      useFactory: (): Twilio =>
        twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!),
    },
  ],
  exports: [NotificationSenderService],
})
export class NotificationsModule {}
