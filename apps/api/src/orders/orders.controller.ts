import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { actorFromHeaders } from '../common/actor.util';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @ApiOperation({ summary: 'Create a new order (PAID, CREDIT, or CASH_WITHDRAWAL)' })
  @Post()
  create(@Body() dto: CreateOrderDto, @Headers() headers: Record<string, unknown>) {
    return this.orders.create(dto, actorFromHeaders(headers));
  }
}
