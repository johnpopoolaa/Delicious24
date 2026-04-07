import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class InboundWebhookDto {
  @IsString()
  @IsNotEmpty()
  from_phone!: string;

  @IsString()
  @IsNotEmpty()
  message_text!: string;

  @IsOptional()
  @IsObject()
  raw_payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
