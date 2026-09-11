import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

/**
 * Demonstrates a Kubernetes Secret flowing into the app.
 * If API_KEY is not set (e.g. no Secret created yet), the guard is a no-op.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.apiKey;
    if (!expected) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-api-key');
    if (provided !== expected) {
      throw new UnauthorizedException('Missing or invalid x-api-key header');
    }
    return true;
  }
}
