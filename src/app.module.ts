import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { ItemsModule } from './items/items.module';
import { MetricsModule } from './metrics/metrics.module';
import { InfoController } from './info/info.controller';
import { DemoController } from './demo/demo.controller';

@Module({
  imports: [AppConfigModule, HealthModule, ItemsModule, MetricsModule],
  controllers: [InfoController, DemoController],
})
export class AppModule {}
