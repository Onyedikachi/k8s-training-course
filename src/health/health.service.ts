import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

/**
 * Tracks the three states Kubernetes probes care about:
 *   started -> the process finished initialising          (startupProbe)
 *   ready   -> it is willing to receive traffic            (readinessProbe)
 *   alive   -> the process is not dead-locked              (livenessProbe)
 */
@Injectable()
export class HealthService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(HealthService.name);
  private started = false;
  private ready = false;
  private readonly bootedAt = Date.now();

  constructor(private readonly config: AppConfigService) {}

  /** Simulates warm-up (cache priming, connection pools...). Length comes from STARTUP_DELAY_MS. */
  async markStarted(): Promise<void> {
    const delay = this.config.startupDelayMs;
    if (delay > 0) {
      this.logger.log(`Warming up for ${delay} ms before reporting started/ready`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.started = true;
    this.ready = true;
    this.logger.log('Startup complete - now READY');
  }

  isStarted(): boolean {
    return this.started;
  }
  isReady(): boolean {
    return this.ready;
  }
  setReady(ready: boolean): void {
    this.ready = ready;
    this.logger.warn(`Readiness manually set to ${ready}`);
  }
  uptimeSeconds(): number {
    return Math.round((Date.now() - this.bootedAt) / 1000);
  }

  /** On SIGTERM stop advertising readiness so the Service drains us before the process exits. */
  beforeApplicationShutdown(signal?: string): void {
    this.ready = false;
    this.logger.warn(`Received ${signal ?? 'shutdown'} - marked NOT READY`);
  }
}
