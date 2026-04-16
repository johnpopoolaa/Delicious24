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
      useFactory: (): Twilio => {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        if (!sid) throw new Error('Missing required environment variable: TWILIO_ACCOUNT_SID');
        if (!token) throw new Error('Missing required environment variable: TWILIO_AUTH_TOKEN');
        return twilio(sid, token);
      },
    },
  ],
  exports: [NotificationSenderService],
})
export class NotificationsModule {}
