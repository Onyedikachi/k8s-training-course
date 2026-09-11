import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  liveness() {
    return { status: 'alive', uptimeSeconds: this.health.uptimeSeconds() };
  }

  @Get('ready')
  readiness() {
    if (!this.health.isReady()) {
      // 503 is what kubelet treats as a failed probe (any non 2xx/3xx)
      throw new ServiceUnavailableException({ status: 'not-ready' });
    }
    return { status: 'ready' };
  }

  @Get('started')
  startup() {
    if (!this.health.isStarted()) {
      throw new ServiceUnavailableException({ status: 'starting' });
    }
    return { status: 'started' };
  }
}
