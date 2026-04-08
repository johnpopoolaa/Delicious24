import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class PendingPaymentFilterDto {
  @ApiPropertyOptional({ enum: PendingPaymentCandidateStatus })
  @IsOptional()
  @IsEnum(PendingPaymentCandidateStatus)
  status?: PendingPaymentCandidateStatus;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  from_phone?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
