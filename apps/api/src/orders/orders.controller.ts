import { Body, Controller, Headers, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { actorFromHeaders } from '../common/actor.util';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Headers() headers: Record<string, unknown>) {
    return this.orders.create(dto, actorFromHeaders(headers));
  }
}
