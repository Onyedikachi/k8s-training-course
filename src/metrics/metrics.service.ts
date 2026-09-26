import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { AppConfigService } from '../config/app-config.service';

/**
 * Owns a private prom-client Registry (not the global one) so that tests and
 * multiple Nest instances never collide with "metric already registered".
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly httpRequestsInFlight: Gauge<string>;
  readonly itemsTotal: Gauge<string>;
  readonly appInfo: Gauge<string>;
  readonly appReady: Gauge<string>;

  constructor(private readonly config: AppConfigService) {
    // Labels attached to every metric from this pod - lets you slice by namespace/env in Grafana
    this.registry.setDefaultLabels({
      app: this.config.appName,
      environment: this.config.appEnv,
    });

    // Node.js runtime metrics: process_cpu_seconds_total, nodejs_heap_size_used_bytes, nodejs_eventloop_lag_seconds, ...
    collectDefaultMetrics({ register: this.registry, prefix: '' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests handled',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      // buckets tuned for a fast JSON API; these define what p95/p99 you can compute
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'HTTP requests currently being processed',
      registers: [this.registry],
    });

    this.itemsTotal = new Gauge({
      name: 'items_total',
      help: 'Items held in this replica (in-memory, per pod)',
      registers: [this.registry],
    });

    this.appReady = new Gauge({
      name: 'app_ready',
      help: 'Whether this replica reports itself ready (1) or not (0)',
      registers: [this.registry],
    });

    this.appInfo = new Gauge({
      name: 'app_info',
      help: 'Build information; value is always 1',
      labelNames: ['version', 'environment', 'pod', 'node'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    this.appInfo
      .labels(
        this.config.appVersion,
        this.config.appEnv,
        this.config.podName,
        this.config.nodeName ?? 'unknown',
      )
      .set(1);
  }

  async scrape(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
