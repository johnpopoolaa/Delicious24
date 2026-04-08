import { IsIn } from 'class-validator';
import { PendingPaymentCandidateStatus } from '@delicious24/db';

export class UpdatePendingPaymentDto {
  @IsIn([PendingPaymentCandidateStatus.REVIEWED, PendingPaymentCandidateStatus.REJECTED])
  status!: PendingPaymentCandidateStatus;
}
