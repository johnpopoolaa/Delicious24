import { Module } from '@nestjs/common';
import { WatService } from './wat.service';

@Module({
  providers: [WatService],
  exports: [WatService],
})
export class WatModule {}
