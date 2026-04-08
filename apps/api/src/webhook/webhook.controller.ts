import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @ApiOperation({ summary: 'Receive an inbound SMS/WhatsApp payment notification' })
  @Post('inbound')
  inbound(@Body() dto: InboundWebhookDto) {
    return this.webhook.handleInbound(dto);
  }
}
