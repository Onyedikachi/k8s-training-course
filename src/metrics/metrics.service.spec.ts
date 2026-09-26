import { MetricsService } from './metrics.service';
import { AppConfigService } from '../config/app-config.service';

const fakeConfig = {
  appName: 'nestjs-backend',
  appEnv: 'test',
  appVersion: '9.9.9',
  podName: 'pod-abc',
  nodeName: 'node-1',
} as unknown as AppConfigService;

describe('MetricsService', () => {
  it('exposes default runtime metrics and custom metrics', async () => {
    const svc = new MetricsService(fakeConfig);
    svc.onModuleInit();
    svc.httpRequestsTotal.inc({ method: 'GET', route: '/', status_code: '200' });
    // a histogram only emits buckets once it has at least one observation
    svc.httpRequestDuration.observe({ method: 'GET', route: '/', status_code: '200' }, 0.012);
    const output = await svc.scrape();

    expect(output).toContain('process_cpu_seconds_total');
    expect(output).toContain('nodejs_heap_size_used_bytes');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds_bucket');
    expect(output).toContain('app_info{');
    expect(output).toContain('version="9.9.9"');
    expect(output).toContain('environment="test"');
  });

  it('keeps registries isolated between instances', async () => {
    const a = new MetricsService(fakeConfig);
    const b = new MetricsService(fakeConfig);
    a.httpRequestsTotal.inc({ method: 'GET', route: '/', status_code: '200' });
    expect(await b.scrape()).not.toContain('http_requests_total{method="GET"');
  });
});
