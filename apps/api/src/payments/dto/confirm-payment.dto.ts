import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ example: '2500' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for safe retries' })
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
