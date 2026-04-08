import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class UpdatePendingPaymentDto {
  @ApiProperty({ enum: [PendingPaymentCandidateStatus.REVIEWED, PendingPaymentCandidateStatus.REJECTED] })
  @IsIn([PendingPaymentCandidateStatus.REVIEWED, PendingPaymentCandidateStatus.REJECTED])
  status!: PendingPaymentCandidateStatus;
}
