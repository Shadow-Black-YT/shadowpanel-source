import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './modules/auth/auth.routes';
import { serversRouter } from './modules/servers/servers.routes';
import { nodesRouter } from './modules/nodes/nodes.routes';
import { filesRouter } from './modules/files/files.routes';
import { backupsRouter } from './modules/backups/backups.routes';
import { domainsRouter } from './modules/domains/domains.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { activityRouter } from './modules/activity/activity.routes';
import { terminalRouter } from './modules/terminal/terminal.routes';
import { tunnelRouter } from './modules/tunnel/tunnel.routes';
import { gdriveRouter } from './modules/gdrive/gdrive.routes';
import { gitRouter } from './modules/git/git.routes';

import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { requestIdMiddleware, requestLoggerMiddleware } from './middleware/requestId';
import { logger } from './utils/logger';

export const app = express();
const API = '/api/v1';

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
}));

const globalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts' } });

app.use(globalLimit);
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request ID middleware (must come before morgan to include ID in logs)
app.use(requestIdMiddleware);

// Request logger middleware for detailed request/response logging
if (process.env.NODE_ENV !== 'production') {
  app.use(requestLoggerMiddleware);
}

// Morgan logging with request ID
if (process.env.NODE_ENV !== 'test') {
  morgan.token('request-id', (req: Request) => (req as any).id || 'unknown');
  app.use(morgan(':method :url :status :response-time ms - :request-id', {
    stream: { write: (msg) => logger.debug(msg.trim()) }
  }));
}

// Branding header
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Powered-By', 'shadowblack');
  next();
});

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', powered_by: 'shadowblack', timestamp: new Date().toISOString() });
});

// Public routes
app.use(API + '/auth', authLimit, authRouter);
app.use(API + '/tunnel', tunnelRouter);

// Protected
app.use(authenticate);
app.use(API + '/servers', serversRouter);
app.use(API + '/nodes', nodesRouter);
app.use(API + '/files', filesRouter);
app.use(API + '/backups', backupsRouter);
app.use(API + '/domains', domainsRouter);
app.use(API + '/settings', settingsRouter);
app.use(API + '/activity', activityRouter);
app.use(API + '/terminal', terminalRouter);
app.use(API + '/gdrive', gdriveRouter);
app.use(API + '/git', gitRouter);

// 404
app.use((_req, res) => { res.status(404).json({ error: 'Not found', powered_by: 'shadowblack' }); });

// Error handler
app.use(errorHandler);
