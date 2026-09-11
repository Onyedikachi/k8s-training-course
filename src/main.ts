import { Logger, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { HealthService } from './health/health.service';

const LEVELS: Record<string, LogLevel[]> = {
  error: ['error'],
  warn: ['error', 'warn'],
  log: ['error', 'warn', 'log'],
  debug: ['error', 'warn', 'log', 'debug'],
  verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  app.useLogger(LEVELS[config.logLevel] ?? LEVELS.log);

  // Lets Kubernetes SIGTERM trigger beforeApplicationShutdown() (readiness -> false) and a clean close
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  Logger.log(
    `${config.appName} v${config.appVersion} listening on :${config.port} [APP_ENV=${config.appEnv}, pod=${config.podName}]`,
    'Bootstrap',
  );

  // HTTP is up (liveness passes) but started/ready stay false until warm-up completes
  await app.get(HealthService).markStarted();
}

bootstrap().catch((err) => {
  // Config validation errors land here -> non-zero exit -> CrashLoopBackOff with a readable message
  Logger.error(`Fatal startup error: ${err?.message ?? err}`, 'Bootstrap');
  process.exit(1);
});
