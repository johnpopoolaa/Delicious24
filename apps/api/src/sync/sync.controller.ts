import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { UpdateReconciliationTaskDto } from './dto/update-reconciliation-task.dto';
import { Public } from '../common/public.decorator';

@ApiTags('sync')
@Controller()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiOperation({ summary: 'Apply a batch of offline changes from a client device' })
  @Post('sync')
  postSync(@Body() dto: SyncBatchDto) {
    return this.syncService.applyBatch(dto);
  }

  @Public()
  @ApiOperation({ summary: 'List reconciliation tasks (financial conflicts)' })
  @Get('reconciliation-tasks')
  reconciliation(@Query('status') status?: ReconciliationTaskStatus) {
    return this.syncService.listReconciliation(status).then((items) => ({ success: true, data: { items } }));
  }

  @ApiOperation({ summary: 'Resolve or dismiss a reconciliation task' })
  @Patch('reconciliation-tasks/:id')
  resolveTask(@Param('id') id: string, @Body() dto: UpdateReconciliationTaskDto) {
    return this.syncService.resolveTask(id, dto.status);
  }
}
