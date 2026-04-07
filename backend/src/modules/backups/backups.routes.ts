import { Router } from 'express';
import { query, queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { runScheduledBackup } from '../../services/backupScheduler';

export const backupsRouter = Router();

async function checkAccess(serverId: string, userId: string, role: string) {
  const srv = await queryOne<any>(`SELECT user_id FROM servers WHERE id=$1`, [serverId]);
  if (!srv) throw new AppError('Server not found', 404);
  if (srv.user_id !== userId && !['admin', 'superadmin'].includes(role)) {
    throw new AppError('Permission denied', 403);
  }
}

backupsRouter.get('/:serverId', async (req, res) => {
  await checkAccess(req.params.serverId, req.user!.userId, req.user!.role);
  const rows = await query(`SELECT * FROM backups WHERE server_id=$1 ORDER BY created_at DESC`, [req.params.serverId]);
  res.json(rows);
});

backupsRouter.post('/:serverId', async (req, res) => {
  await checkAccess(req.params.serverId, req.user!.userId, req.user!.role);
  const { name } = req.body;
  const backupLimit = 10;
  const cnt = await queryOne<any>(`SELECT COUNT(*) as n FROM backups WHERE server_id=$1 AND status='completed'`, [req.params.serverId]);
  if (parseInt(cnt.n) >= backupLimit) throw new AppError('Backup limit (' + backupLimit + ') reached', 422);

  res.status(202).json({ message: 'Backup started' });
  setImmediate(() => {
    runScheduledBackup(req.params.serverId, req.user!.userId, undefined, name).catch(e => logger.error('Backup failed:', e));
  });
});

backupsRouter.delete('/:serverId/:backupId', async (req, res) => {
  await checkAccess(req.params.serverId, req.user!.userId, req.user!.role);
  await query(`DELETE FROM backups WHERE id=$1 AND server_id=$2`, [req.params.backupId, req.params.serverId]);
  res.json({ message: 'Backup deleted' });
});
