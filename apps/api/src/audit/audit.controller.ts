import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('audit-log')
@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @ApiOperation({ summary: 'List audit log entries' })
  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.audit
      .list({ skip: skip ? parseInt(skip, 10) : 0, take: take ? parseInt(take, 10) : 50 })
      .then((items) => ({ success: true, data: { items } }));
  }
}
