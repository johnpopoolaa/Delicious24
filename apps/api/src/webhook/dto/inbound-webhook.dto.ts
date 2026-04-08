import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class InboundWebhookDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  from_phone!: string;

  @ApiProperty({ example: 'i sent 5k' })
  @IsString()
  @IsNotEmpty()
  message_text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  raw_payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
