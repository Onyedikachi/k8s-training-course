import { HealthService } from './health.service';
import { AppConfigService } from '../config/app-config.service';

describe('HealthService', () => {
  const makeService = (startupDelayMs: number) =>
    new HealthService({ startupDelayMs } as unknown as AppConfigService);

  it('is neither started nor ready before markStarted()', () => {
    const svc = makeService(0);
    expect(svc.isStarted()).toBe(false);
    expect(svc.isReady()).toBe(false);
  });

  it('becomes started and ready after markStarted()', async () => {
    const svc = makeService(0);
    await svc.markStarted();
    expect(svc.isStarted()).toBe(true);
    expect(svc.isReady()).toBe(true);
  });

  it('stops being ready on shutdown but stays started', async () => {
    const svc = makeService(0);
    await svc.markStarted();
    svc.beforeApplicationShutdown('SIGTERM');
    expect(svc.isReady()).toBe(false);
    expect(svc.isStarted()).toBe(true);
  });
});
