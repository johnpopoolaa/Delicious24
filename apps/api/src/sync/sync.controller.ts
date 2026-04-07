import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('sync')
  postSync(@Body() dto: SyncBatchDto) {
    return this.syncService.applyBatch(dto);
  }

  @Get('reconciliation-tasks')
  reconciliation(@Query('status') status?: ReconciliationTaskStatus) {
    return this.syncService.listReconciliation(status).then((items) => ({ success: true, data: { items } }));
  }
}
