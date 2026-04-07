import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { actorFromHeaders } from '../common/actor.util';

@Controller('credits')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':creditId/confirm-payment')
  confirm(
    @Param('creditId') creditId: string,
    @Body() dto: ConfirmPaymentDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    return this.payments.confirmPayment({
      creditId,
      amount: dto.amount,
      note: dto.note,
      actor: actorFromHeaders(headers),
    });
  }
}
