import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { requestIdMiddleware } from './middleware/requestContext.js';
import {
  apiHelmet,
  corsMiddleware,
  csrfGuard,
  enforceContentType,
  permissionsPolicy,
} from './middleware/security.js';
import { apiRouter } from './routes/index.js';
import { metricsMiddleware } from './monitoring/metrics.js';
import { initCache } from './services/cache.service.js';
import registerJobs from './jobs/index.js';
import { embedPending, syncLessons } from './ai/knowledge.service.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Only trust as many proxy hops as are actually deployed; trusting all of them
  // lets a client forge X-Forwarded-For and evade the IP-keyed rate limiters.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(requestIdMiddleware);
  app.use(apiHelmet);
  app.use(permissionsPolicy);
  app.use(corsMiddleware);
  app.use(compression());

  app.use(metricsMiddleware);

  // Content type is checked before the body parsers so an unsupported type fails
  // with 415 rather than an empty body reaching a handler as a validation error.
  app.use(enforceContentType);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // CSRF runs after cookie parsing and before any route can mutate state.
  app.use(csrfGuard);

  app.use('/api', globalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startBackgroundJobs(): void {
  initCache();
  try {
    registerJobs();
  } catch (err) {
    console.error('Failed to start background jobs:', err);
  }
  // Mirror lessons into the knowledge base (unchanged ones are skipped by hash), then give
  // chunks indexed before an embedding model was configured their vectors.
  void syncLessons()
    .then(() => embedPending())
    .catch((err: Error) => console.error('Knowledge base sync failed:', err.message));
}
