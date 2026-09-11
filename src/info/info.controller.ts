import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { HealthService } from '../health/health.service';

@Controller()
export class InfoController {
  constructor(
    private readonly config: AppConfigService,
    private readonly health: HealthService,
  ) {}

  @Get()
  root() {
    return {
      message: this.config.greeting,
      app: this.config.appName,
      version: this.config.appVersion,
      environment: this.config.appEnv,
      pod: this.config.podName,
      node: this.config.nodeName ?? null,
      namespace: this.config.namespace ?? null,
      uptimeSeconds: this.health.uptimeSeconds(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  publicConfig() {
    return this.config.public();
  }
}
