// Runs before test files are imported: ConfigModule validates env at import time.
process.env.APP_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.STARTUP_DELAY_MS = '0';
process.env.DEMO_ENDPOINTS_ENABLED = 'true';
process.env.API_KEY = 'secret123';
process.env.LOG_LEVEL = 'error';
