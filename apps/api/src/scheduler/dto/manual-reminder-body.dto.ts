import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ManualReminderBodyDto {
  @IsUUID()
  credit_id!: string;

  @IsString()
  @IsNotEmpty()
  run_at!: string;
}
