import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderType } from '@delicious24/db';

export class OrderLineItemDto {
  @IsNumber()
  @Min(1)
  menu_item_id!: number;

  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @IsUUID()
  customer_id!: string;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  items?: OrderLineItemDto[];

  @IsString()
  @IsNotEmpty()
  total!: string;

  @ValidateIf((o) => o.type === OrderType.CREDIT || (o.type === OrderType.CASH_WITHDRAWAL && o.as_credit))
  @IsString()
  @IsNotEmpty()
  due_date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** When type is CASH_WITHDRAWAL, record as credit sale (principal + reminders). */
  @IsOptional()
  @IsBoolean()
  as_credit?: boolean;
}
