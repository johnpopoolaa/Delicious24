import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ManualReminderBodyDto {
  @ApiProperty({ example: 'uuid-of-credit' })
  @IsUUID()
  credit_id!: string;

  @ApiProperty({ example: '2026-05-01T09:00:00Z' })
  @IsString()
  @IsNotEmpty()
  run_at!: string;
}
