import * as Joi from 'joi';

/**
 * Every environment variable the application uses is declared here.
 * The app refuses to start if validation fails, so a bad ConfigMap surfaces
 * immediately as a CrashLoopBackOff with a clear log line instead of a silent misbehaviour.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  APP_ENV: Joi.string().valid('local', 'minikube', 'dev', 'prod', 'openshift', 'test').required(),
  APP_NAME: Joi.string().default('nestjs-backend'),
  APP_VERSION: Joi.string().default('1.0.0'),
  GREETING_MESSAGE: Joi.string().default('Hello from NestJS'),
  FEATURE_FLAGS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),
  STARTUP_DELAY_MS: Joi.number().integer().min(0).max(120000).default(0),
  DEMO_ENDPOINTS_ENABLED: Joi.boolean().default(false),
  API_KEY: Joi.string().allow('').optional(),
  // Injected by Kubernetes via the Downward API (see k8s/base/deployment.yaml)
  POD_NAME: Joi.string().optional(),
  NODE_NAME: Joi.string().optional(),
  POD_NAMESPACE: Joi.string().optional(),
});
