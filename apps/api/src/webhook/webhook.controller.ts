import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WebhookService } from './webhook.service';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';
import { Public } from '../common/public.decorator';

@Public()
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Receive an inbound SMS/WhatsApp payment notification' })
  @Post('inbound')
  inbound(@Body() dto: InboundWebhookDto) {
    return this.webhook.handleInbound(dto);
  }
}
