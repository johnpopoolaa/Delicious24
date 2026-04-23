import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerSearchDto } from './dto/customer-search.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Public } from '../common/public.decorator';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @ApiOperation({ summary: 'Create a new customer' })
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.createCustomer(dto);
  }

  @ApiOperation({ summary: 'Update customer name, phone, or email' })
  @Patch(':customerId')
  update(@Param('customerId') customerId: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.updateCustomer(customerId, dto);
  }

  @Public()
  @ApiOperation({ summary: 'Search customers by name, phone, or email' })
  @Get('search')
  search(@Query() q: CustomerSearchDto) {
    return this.customers.search(q.q, q.page ?? 1, q.limit ?? 20);
  }

  @Public()
  @ApiOperation({ summary: 'Get a single customer by ID' })
  @Get(':customerId')
  findOne(@Param('customerId') customerId: string) {
    return this.customers.findOne(customerId);
  }

  @Public()
  @ApiOperation({ summary: 'Get customer ledger (credits + transactions)' })
  @Get(':customerId/ledger')
  ledger(@Param('customerId') customerId: string) {
    return this.customers.ledger(customerId);
  }

  @Public()
  @ApiOperation({ summary: 'Export customer ledger as CSV' })
  @Get(':customerId/ledger/export.csv')
  async exportLedger(@Param('customerId') customerId: string, @Res() res: Response) {
    const csv = await this.customers.ledgerCsv(customerId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-${customerId}.csv"`);
    return res.send(csv);
  }
}
