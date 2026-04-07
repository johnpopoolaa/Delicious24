import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SyncChangeDto {
  @IsString()
  @IsNotEmpty()
  temp_id!: string;

  @IsString()
  @IsNotEmpty()
  entity_type!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncBatchDto {
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes!: SyncChangeDto[];

  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
