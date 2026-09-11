import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HealthService } from '../src/health/health.service';

describe('nestjs-backend (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // env is prepared in test/setup-env.ts
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('GET / returns env-driven info', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body.environment).toBe('test');
    expect(res.body.message).toBeDefined();
  });

  it('readiness is 503 until startup completes, then 200', async () => {
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).get('/health/started').expect(503);
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await app.get(HealthService).markStarted();
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    await request(app.getHttpServer()).get('/health/started').expect(200);
  });

  it('demo endpoints toggle readiness', async () => {
    await request(app.getHttpServer()).post('/demo/unready').expect(201);
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).post('/demo/ready').expect(201);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('api is protected by API_KEY when configured', async () => {
    await request(app.getHttpServer()).get('/api/items').expect(401);
    const res = await request(app.getHttpServer())
      .get('/api/items')
      .set('x-api-key', 'secret123')
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    await request(app.getHttpServer())
      .post('/api/items')
      .set('x-api-key', 'secret123')
      .send({ name: 'helm' })
      .expect(201);
  });

  it('GET /config never leaks the API key', async () => {
    const res = await request(app.getHttpServer()).get('/config').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('secret123');
    expect(res.body.apiKeyConfigured).toBe(true);
  });
});
