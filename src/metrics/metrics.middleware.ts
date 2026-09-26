import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const endTimer = this.metrics.httpRequestDuration.startTimer();
    this.metrics.httpRequestsInFlight.inc();

    res.on('finish', () => {
      // Use the matched route template (/api/items/:id), never the raw URL (/api/items/42),
      // otherwise every id becomes a new time series - the classic cardinality explosion.
      const matched: string | undefined = (req as any).route?.path;
      const route =
        matched && !matched.includes('*')
          ? `${(req as any).baseUrl ?? ''}${matched}`
          : 'unmatched'; // 404s and wildcards collapse into one series
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      this.metrics.httpRequestsTotal.inc(labels);
      endTimer(labels);
      this.metrics.httpRequestsInFlight.dec();
    });

    next();
  }
}
