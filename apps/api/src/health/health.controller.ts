import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Health check for container orchestration' })
  @Get()
  check() {
    return { status: 'ok' };
  }
}
