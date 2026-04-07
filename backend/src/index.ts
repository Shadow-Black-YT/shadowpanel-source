/**
 * shadowPanel v1.0 — Backend Entry Point
 * Developed by Nystic.Shadow | Powered by shadowblack
 * Support: https://discord.gg/eezz8RAQ9c
 */
import 'dotenv/config';
import http from 'http';
import { app } from './app';
import { initDatabase } from './database';
import { seedDatabase } from './database/seed';
import { initRedis } from './config/redis';
import { initWebSocket } from './websocket';
import { NodeMonitor } from './workers/nodeMonitor';
import { initBackupScheduler } from './services/backupScheduler';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.API_PORT || '5000');

async function bootstrap() {
  logger.info('═══════════════════════════════════════════════');
  logger.info('  🌑 shadowPanel v1.0 — Starting');
  logger.info('  Developed by Nystic.Shadow');
  logger.info('  Powered by shadowblack');
  logger.info('  Support: discord.gg/eezz8RAQ9c');
  logger.info('═══════════════════════════════════════════════');

  try {
    logger.info('[1/5] Connecting database...');
    await initDatabase();
    await seedDatabase();

    logger.info('[2/5] Connecting Redis...');
    await initRedis();

    logger.info('[3/5] Starting HTTP server...');
    const server = http.createServer(app);

    logger.info('[4/5] Initialising WebSocket...');
    initWebSocket(server);

    logger.info('[5/5] Starting workers...');
    NodeMonitor.start();
    await initBackupScheduler();

    server.listen(PORT, '0.0.0.0', () => {
      logger.info('═══════════════════════════════════════════════');
      logger.info('  ✓ shadowPanel ready on :' + PORT);
      logger.info('  Panel: ' + (process.env.PANEL_URL || 'http://localhost'));
      logger.info('═══════════════════════════════════════════════');
    });

    const shutdown = async (sig: string) => {
      logger.info('Shutting down (' + sig + ')...');
      NodeMonitor.stop();
      server.close(async () => {
        const { getPool } = await import('./database');
        await getPool().end().catch(() => {});
        logger.info('Goodbye!');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 15000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('unhandledRejection', (r) => logger.error('Unhandled rejection:', r));
    process.on('uncaughtException',  (e) => logger.error('Uncaught exception:', e));

  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
