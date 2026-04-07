import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { query, queryOne } from '../../database';
import {
  getAuthUrl, exchangeCode, getAuthedDrive,
  listDriveFiles, downloadDriveFile, uploadBackupToDrive,
  getOrCreateServerFolder,
} from '../../services/gdrive.service';
import { runScheduledBackup } from '../../services/backupScheduler';
import { scheduleJob, cancelJob } from '../../services/backupScheduler';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

export const gdriveRouter = Router();

// GET /gdrive/connect — returns OAuth URL
gdriveRouter.get('/connect', (req, res) => {
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (!configured) throw new AppError('Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env', 501);
  const stateToken = jwt.sign({ sub: req.user!.userId, type: 'oauth_state' }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  res.json({ authUrl: getAuthUrl(stateToken) });
});

// GET /gdrive/callback — OAuth callback
gdriveRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  if (error) { res.redirect('/?gdrive=error&reason=' + error); return; }
  if (!code || !state) throw new AppError('No auth code or state', 400);

  let userId: string;
  try {
    const payload = jwt.verify(state as string, process.env.JWT_SECRET!) as any;
    if (payload.type !== 'oauth_state') throw new Error();
    userId = payload.sub;
  } catch {
    res.redirect('/?gdrive=error&reason=Invalid_State_Token');
    return;
  }

  try {
    const result = await exchangeCode(code as string, userId);
    res.redirect('/?gdrive=connected&email=' + encodeURIComponent(result.email));
  } catch (err: any) {
    res.redirect('/?gdrive=error&reason=' + encodeURIComponent(err.message));
  }
});

// GET /gdrive/status
gdriveRouter.get('/status', async (req, res) => {
  const conn = await queryOne<any>(
    `SELECT id,email,display_name,root_folder_id,is_active,connected_at,last_sync FROM gdrive_connections WHERE user_id=$1`,
    [req.user!.userId]
  );
  res.json({ connected: !!conn?.is_active, connection: conn || null });
});

// DELETE /gdrive/disconnect
gdriveRouter.delete('/disconnect', async (req, res) => {
  await query(`UPDATE gdrive_connections SET is_active=FALSE WHERE user_id=$1`, [req.user!.userId]);
  res.json({ message: 'Google Drive disconnected' });
});

// GET /gdrive/files — list files in Drive root / folder
gdriveRouter.get('/files', async (req, res) => {
  const { folderId } = req.query;
  const files = await listDriveFiles(req.user!.userId, folderId as string | undefined);
  res.json(files);
});

// GET /gdrive/files/:serverId — list backups for a server folder
gdriveRouter.get('/files/:serverId', async (req, res) => {
  const srv = await queryOne<any>(`SELECT name FROM servers WHERE id=$1 AND user_id=$2`, [req.params.serverId, req.user!.userId]);
  if (!srv) throw new AppError('Server not found', 404);
  const conn = await queryOne<any>(`SELECT root_folder_id FROM gdrive_connections WHERE user_id=$1 AND is_active=TRUE`, [req.user!.userId]);
  if (!conn) throw new AppError('Google Drive not connected', 400);
  const folderId = await getOrCreateServerFolder(req.user!.userId, srv.name, conn.root_folder_id);
  const files = await listDriveFiles(req.user!.userId, folderId);
  res.json({ server: srv.name, folderId, files });
});

// POST /gdrive/import/:serverId — import backup from GDrive into server
gdriveRouter.post('/import/:serverId', async (req, res) => {
  const { fileId, fileName } = req.body;
  if (!fileId) throw new AppError('fileId required', 400);

  const srv = await queryOne<any>(
    `SELECT s.*,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1 AND s.user_id=$2`,
    [req.params.serverId, req.user!.userId]
  );
  if (!srv) throw new AppError('Server not found', 404);

  const tmpPath = '/tmp/gdrive-import-' + Date.now() + '.tar.gz';

  // Async import
  res.json({ message: 'Import started. Server will restart when complete.' });

  setImmediate(async () => {
    try {
      await downloadDriveFile(req.user!.userId, fileId, tmpPath);

      // Push to container via agent
      const { AgentClient } = await import('../../utils/agentClient');
      const agent = new AgentClient(srv.agent_url, srv.agent_secret);

      // Base64 encode and send via exec
      const buf = fs.readFileSync(tmpPath);
      const b64 = buf.toString('base64');
      await agent.execCommand(srv.container_id,
        `echo '${b64}' | base64 -d > /tmp/restore.tar.gz && tar -xzf /tmp/restore.tar.gz -C / && rm /tmp/restore.tar.gz && echo DONE`
      );

      if (srv.status === 'running') await agent.powerAction(srv.container_id, 'restart');
      fs.unlinkSync(tmpPath);

      const { query: dbQuery } = await import('../../database');
      await dbQuery(`INSERT INTO audit_log(user_id,action,resource,resource_id,metadata) VALUES($1,'gdrive_import','server',$2,$3)`,
        [req.user!.userId, req.params.serverId, JSON.stringify({ fileId, fileName })]);
    } catch (err: any) {
      const { logger: log } = await import('../../utils/logger');
      log.error('[GDrive Import] Failed: ' + err.message);
    }
  });
});

// POST /gdrive/backup/:serverId — manual backup to GDrive now
gdriveRouter.post('/backup/:serverId', async (req, res) => {
  const { userId } = req.user!;
  const conn = await queryOne<any>(`SELECT root_folder_id FROM gdrive_connections WHERE user_id=$1 AND is_active=TRUE`, [userId]);
  if (!conn) throw new AppError('Connect Google Drive first', 400);

  res.json({ message: 'Backup to Google Drive started' });
  setImmediate(() => runScheduledBackup(req.params.serverId, userId).catch(err => console.error(err)));
});

// ── Backup Schedules ──────────────────────────────────────────

// GET /gdrive/schedule/:serverId
gdriveRouter.get('/schedule/:serverId', async (req, res) => {
  const sched = await queryOne(`SELECT * FROM backup_schedules WHERE server_id=$1 AND user_id=$2`,
    [req.params.serverId, req.user!.userId]);
  res.json(sched || null);
});

// PUT /gdrive/schedule/:serverId — create or update schedule
gdriveRouter.put('/schedule/:serverId', async (req, res) => {
  const { isEnabled = true, cronExpr = '0 3 * * *', destination = 'both', retainCount = 7 } = req.body;

  const srv = await queryOne<any>(`SELECT name FROM servers WHERE id=$1 AND user_id=$2`, [req.params.serverId, req.user!.userId]);
  if (!srv) throw new AppError('Server not found', 404);

  // Validate cron
  try { scheduleJob({ id: 'test', cron_expr: cronExpr, is_enabled: false, server_id: '', user_id: '' }); }
  catch { throw new AppError('Invalid cron expression', 400); }

  // Get/create GDrive folder
  let gdriveFolderId: string | null = null;
  if (destination !== 'local') {
    const conn = await queryOne<any>(`SELECT root_folder_id FROM gdrive_connections WHERE user_id=$1 AND is_active=TRUE`, [req.user!.userId]);
    if (conn) {
      gdriveFolderId = await getOrCreateServerFolder(req.user!.userId, srv.name, conn.root_folder_id);
    }
  }

  const existing = await queryOne<any>(`SELECT id FROM backup_schedules WHERE server_id=$1`, [req.params.serverId]);
  let sched: any;
  if (existing) {
    sched = await queryOne<any>(
      `UPDATE backup_schedules SET is_enabled=$1,cron_expr=$2,destination=$3,retain_count=$4,gdrive_folder_id=$5 WHERE id=$6 RETURNING *`,
      [isEnabled, cronExpr, destination, retainCount, gdriveFolderId, existing.id]
    );
    if (isEnabled) scheduleJob(sched!); else cancelJob(existing.id);
  } else {
    sched = await queryOne<any>(
      `INSERT INTO backup_schedules(server_id,user_id,is_enabled,cron_expr,destination,retain_count,gdrive_folder_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.serverId, req.user!.userId, isEnabled, cronExpr, destination, retainCount, gdriveFolderId]
    );
    if (isEnabled) scheduleJob(sched!);
  }

  res.json(sched);
});

// DELETE /gdrive/schedule/:serverId
gdriveRouter.delete('/schedule/:serverId', async (req, res) => {
  const s = await queryOne<any>(`SELECT id FROM backup_schedules WHERE server_id=$1 AND user_id=$2`, [req.params.serverId, req.user!.userId]);
  if (s) { cancelJob(s.id); await query(`DELETE FROM backup_schedules WHERE id=$1`, [s.id]); }
  res.json({ message: 'Schedule deleted' });
});
