import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  menu_item_id!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-of-customer' })
  @IsUUID()
  customer_id!: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional({ type: [OrderLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  items?: OrderLineItemDto[];

  @ApiProperty({ example: '2500.00' })
  @IsString()
  @IsNotEmpty()
  total!: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @ValidateIf((o) => o.type === OrderType.CREDIT || (o.type === OrderType.CASH_WITHDRAWAL && o.as_credit))
  @IsString()
  @IsNotEmpty()
  due_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  /** When type is CASH_WITHDRAWAL, record as credit sale (principal + reminders). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  as_credit?: boolean;
}
