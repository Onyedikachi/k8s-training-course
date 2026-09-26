import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { AppConfigService } from '../config/app-config.service';
import { HealthService } from '../health/health.service';
import { ItemsService } from '../items/items.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: AppConfigService,
    private readonly health: HealthService,
    private readonly items: ItemsService,
  ) {}

  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    if (!this.config.metricsEnabled) {
      throw new NotFoundException();
    }
    // Refresh gauges at scrape time - cheap, always accurate
    this.metrics.itemsTotal.set(this.items.findAll().length);
    this.metrics.appReady.set(this.health.isReady() ? 1 : 0);

    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.scrape());
  }
}
