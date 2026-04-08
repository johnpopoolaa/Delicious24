import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

@ApiTags('sync')
@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiOperation({ summary: 'Apply a batch of offline changes from a client device' })
  @Post('sync')
  postSync(@Body() dto: SyncBatchDto) {
    return this.syncService.applyBatch(dto);
  }

  @ApiOperation({ summary: 'List reconciliation tasks (financial conflicts)' })
  @Get('reconciliation-tasks')
  reconciliation(@Query('status') status?: ReconciliationTaskStatus) {
    return this.syncService.listReconciliation(status).then((items) => ({ success: true, data: { items } }));
  }
}
