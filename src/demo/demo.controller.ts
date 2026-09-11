import { Controller, ForbiddenException, Logger, Post } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { HealthService } from '../health/health.service';

/**
 * Training helpers to make probes visible. Guarded by DEMO_ENDPOINTS_ENABLED
 * (true in dev/minikube overlays, false in prod).
 */
@Controller('demo')
export class DemoController {
  private readonly logger = new Logger(DemoController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly health: HealthService,
  ) {}

  private assertEnabled() {
    if (!this.config.demoEndpointsEnabled) {
      throw new ForbiddenException('Demo endpoints are disabled (DEMO_ENDPOINTS_ENABLED=false)');
    }
  }

  /** Pod gets removed from Service endpoints; no restart. Watch `kubectl get endpoints`. */
  @Post('unready')
  unready() {
    this.assertEnabled();
    this.health.setReady(false);
    return { status: 'not-ready', hint: 'POST /demo/ready to recover' };
  }

  @Post('ready')
  ready() {
    this.assertEnabled();
    this.health.setReady(true);
    return { status: 'ready' };
  }

  /** Process exits -> kubelet restarts the container. Watch RESTARTS in `kubectl get pods`. */
  @Post('crash')
  crash() {
    this.assertEnabled();
    this.logger.error('Crash requested via /demo/crash - exiting with code 1');
    setTimeout(() => process.exit(1), 100);
    return { status: 'crashing' };
  }

  /** Event loop blocked -> liveness probe times out -> container restarted. */
  @Post('hang')
  hang() {
    this.assertEnabled();
    this.logger.error('Hang requested via /demo/hang - blocking event loop for 120s');
    setTimeout(() => {
      const end = Date.now() + 120_000;
      while (Date.now() < end) {
        /* busy loop */
      }
    }, 100);
    return { status: 'hanging', hint: 'liveness probe will fail and kubelet will restart this container' };
  }
}
