import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SyncChangeDto {
  @ApiProperty({ example: 'tmp-001' })
  @IsString()
  @IsNotEmpty()
  temp_id!: string;

  @ApiProperty({ example: 'CUSTOMER' })
  @IsString()
  @IsNotEmpty()
  entity_type!: string;

  @ApiProperty({ example: { phone: '+2348012345678', name: 'Ada' } })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncBatchDto {
  @ApiProperty({ example: 'client-device-01' })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({ type: [SyncChangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes!: SyncChangeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
