import { IsEnum } from 'class-validator';
import { ReconciliationTaskStatus } from '@delicious24/db';

const ALLOWED = [ReconciliationTaskStatus.RESOLVED, ReconciliationTaskStatus.DISMISSED] as const;

export class UpdateReconciliationTaskDto {
  @IsEnum(ALLOWED, { message: 'status must be RESOLVED or DISMISSED' })
  status: (typeof ALLOWED)[number];
}
