import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CustomersService } from './customers.service';
import { CustomerSearchDto } from './dto/customer-search.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('search')
  search(@Query() q: CustomerSearchDto) {
    return this.customers.search(q.q, q.page ?? 1, q.limit ?? 20);
  }

  @Get(':customerId/ledger')
  ledger(@Param('customerId') customerId: string) {
    return this.customers.ledger(customerId);
  }

  @Get(':customerId/ledger/export.csv')
  async exportLedger(@Param('customerId') customerId: string, @Res() res: Response) {
    const csv = await this.customers.ledgerCsv(customerId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-${customerId}.csv"`);
    return res.send(csv);
  }
}
