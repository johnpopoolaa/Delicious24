import { Body, Controller, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @Post('inbound')
  inbound(@Body() dto: InboundWebhookDto) {
    return this.webhook.handleInbound(dto);
  }
}
