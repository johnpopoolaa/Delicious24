import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class PendingPaymentFilterDto {
  @IsOptional()
  @IsEnum(PendingPaymentCandidateStatus)
  status?: PendingPaymentCandidateStatus;

  @IsOptional()
  @IsString()
  from_phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
