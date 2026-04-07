import { Module } from '@nestjs/common';
import { WatModule } from '../wat/wat.module';
import { TrustEngineService } from './trust-engine.service';

@Module({
  imports: [WatModule],
  providers: [TrustEngineService],
  exports: [TrustEngineService],
})
export class TrustModule {}
