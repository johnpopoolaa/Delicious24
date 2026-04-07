import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ScheduledJobStatus } from '@delicious24/db';

export class ScheduledJobFilterDto {
  @IsOptional()
  @IsUUID()
  credit_id?: string;

  @IsOptional()
  @IsEnum(ScheduledJobStatus)
  status?: ScheduledJobStatus;

  @IsOptional()
  @IsString()
  run_at_from?: string;

  @IsOptional()
  @IsString()
  run_at_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}
