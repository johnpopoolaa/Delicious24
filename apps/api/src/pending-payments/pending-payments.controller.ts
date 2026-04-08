import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PendingPaymentsService } from './pending-payments.service';
import { PendingPaymentFilterDto } from './dto/pending-payment-filter.dto';
import { UpdatePendingPaymentDto } from './dto/update-pending-payment.dto';

@Controller('pending-payments')
export class PendingPaymentsController {
  constructor(private readonly pending: PendingPaymentsService) {}

  @Get()
  list(@Query() q: PendingPaymentFilterDto) {
    return this.pending.list({
      status: q.status,
      from_phone: q.from_phone,
      page: q.page,
      limit: q.limit,
    });
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePendingPaymentDto) {
    return this.pending.updateStatus(id, dto.status);
  }
}
