import { Controller, Get } from '@nestjs/common';
import { PendingPaymentsService } from './pending-payments.service';

@Controller('pending-payments')
export class PendingPaymentsController {
  constructor(private readonly pending: PendingPaymentsService) {}

  @Get()
  list() {
    return this.pending.list().then((items) => ({ success: true, data: { items } }));
  }
}
