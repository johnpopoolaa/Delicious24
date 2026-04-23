import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScheduledJobStatus } from '@delicious24/db';
import { SchedulerService } from './scheduler.service';
import { ScheduledJobFilterDto } from './dto/scheduled-job-filter.dto';
import { ManualReminderBodyDto } from './dto/manual-reminder-body.dto';
import { Public } from '../common/public.decorator';

@ApiTags('scheduled-jobs')
@Controller('scheduled-jobs')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Public()
  @ApiOperation({ summary: 'List scheduled reminder jobs with optional filters' })
  @Get()
  list(@Query() q: ScheduledJobFilterDto) {
    return this.scheduler.listJobs({
      creditId: q.credit_id,
      status: q.status,
      runAtFrom: q.run_at_from ? new Date(q.run_at_from) : undefined,
      runAtTo: q.run_at_to ? new Date(q.run_at_to) : undefined,
      skip: q.skip,
      take: q.take,
    }).then((items) => ({ success: true, data: { items } }));
  }

  @ApiOperation({ summary: 'Cancel a scheduled job by ID' })
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.scheduler.cancelJobById(id).then((row) => {
      if (!row) return { success: false, error: 'NOT_FOUND', message: 'Job not found' };
      return { success: true, data: row };
    });
  }

  @ApiOperation({ summary: 'Immediately enqueue a pending job' })
  @Post(':id/send-now')
  sendNow(@Param('id') id: string) {
    return this.scheduler.sendNow(id).then((row) => {
      if (!row) return { success: false, error: 'NOT_FOUND', message: 'Job not found' };
      return { success: true, data: row };
    });
  }

  @ApiOperation({ summary: 'Schedule a manual reminder for a credit' })
  @Post('manual')
  manual(@Body() body: ManualReminderBodyDto) {
    return this.scheduler
      .enqueueManualReminder(body.credit_id, new Date(body.run_at))
      .then((row) => ({ success: true, data: row }))
      .catch((e: Error) => ({
        success: false,
        error: 'SCHEDULER_ERROR',
        message: e.message,
      }));
  }
}
