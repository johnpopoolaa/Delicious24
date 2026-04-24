import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
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

  @ApiProperty({ type: [OrderLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  items!: OrderLineItemDto[];

  @ApiProperty({ example: '2500.00' })
  @IsString()
  @IsNotEmpty()
  total!: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @ValidateIf((o) => o.type === OrderType.CREDIT)
  @IsString()
  @IsNotEmpty()
  due_date?: string;

  @ApiPropertyOptional({ example: '24.99', description: 'Extra charges (e.g. cash withdrawal fee) added on top of line items' })
  @IsOptional()
  @IsString()
  charges?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
