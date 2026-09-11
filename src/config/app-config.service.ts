import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return this.config.get<number>('PORT', 3000);
  }
  get appEnv(): string {
    return this.config.get<string>('APP_ENV', 'local');
  }
  get appName(): string {
    return this.config.get<string>('APP_NAME', 'nestjs-backend');
  }
  get appVersion(): string {
    return this.config.get<string>('APP_VERSION', '1.0.0');
  }
  get greeting(): string {
    return this.config.get<string>('GREETING_MESSAGE', 'Hello from NestJS');
  }
  get featureFlags(): string[] {
    return (this.config.get<string>('FEATURE_FLAGS', '') || '')
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  }
  get logLevel(): string {
    return this.config.get<string>('LOG_LEVEL', 'log');
  }
  get startupDelayMs(): number {
    return Number(this.config.get<number>('STARTUP_DELAY_MS', 0));
  }
  get demoEndpointsEnabled(): boolean {
    return this.config.get<boolean>('DEMO_ENDPOINTS_ENABLED', false) === true;
  }
  get apiKey(): string | undefined {
    const key = this.config.get<string>('API_KEY');
    return key ? key : undefined;
  }
  get podName(): string {
    return this.config.get<string>('POD_NAME') || os.hostname();
  }
  get nodeName(): string | undefined {
    return this.config.get<string>('NODE_NAME');
  }
  get namespace(): string | undefined {
    return this.config.get<string>('POD_NAMESPACE');
  }

  /** Everything that is safe to show on GET /config (never the API key). */
  public(): Record<string, unknown> {
    return {
      appEnv: this.appEnv,
      appName: this.appName,
      appVersion: this.appVersion,
      greeting: this.greeting,
      featureFlags: this.featureFlags,
      logLevel: this.logLevel,
      startupDelayMs: this.startupDelayMs,
      demoEndpointsEnabled: this.demoEndpointsEnabled,
      apiKeyConfigured: Boolean(this.apiKey),
      pod: this.podName,
      node: this.nodeName,
      namespace: this.namespace,
    };
  }
}
