import { Module } from '@nestjs/common';
import { NotificationSenderService } from './notification-sender.service';

@Module({
  providers: [NotificationSenderService],
  exports: [NotificationSenderService],
})
export class NotificationsModule {}
