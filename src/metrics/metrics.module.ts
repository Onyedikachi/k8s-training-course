import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { HealthModule } from '../health/health.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [HealthModule, ItemsModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 (Nest 11) path syntax: '*splat' alone does NOT match the root path, and
    // listing '/' as well double-counts every other route. The optional wildcard '/{*splat}'
    // matches '/' and everything below it exactly once.
    consumer.apply(MetricsMiddleware).forRoutes({ path: '/{*splat}', method: RequestMethod.ALL });
  }
}
