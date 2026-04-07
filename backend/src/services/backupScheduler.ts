import schedule from 'node-schedule';
import { query, queryOne } from '../database';
import { AgentClient } from '../utils/agentClient';
import { uploadBackupToDrive } from './gdrive.service';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const BACKUP_PATH = process.env.BACKUP_PATH || '/data/backups';
const activeJobs = new Map<string, schedule.Job>();

export async function initBackupScheduler(): Promise<void> {
  const schedules = await query<any[]>(`SELECT * FROM backup_schedules WHERE is_enabled=TRUE`);
  for (const s of schedules) {
    scheduleJob(s);
  }
  logger.info('[BackupScheduler] Loaded ' + schedules.length + ' schedules');
}

export function scheduleJob(s: any): void {
  if (activeJobs.has(s.id)) {
    activeJobs.get(s.id)!.cancel();
    activeJobs.delete(s.id);
  }
  if (!s.is_enabled) return;

  try {
    const job = schedule.scheduleJob(s.id, s.cron_expr, () => runScheduledBackup(s.server_id, s.user_id, s.id));
    activeJobs.set(s.id, job);
    const next = job.nextInvocation();
    logger.info('[BackupScheduler] Scheduled ' + s.server_id.slice(0, 8) + ' → ' + s.cron_expr + ' next: ' + next);
  } catch (err: any) {
    logger.error('[BackupScheduler] Invalid cron: ' + s.cron_expr + ' — ' + err.message);
  }
}

export function cancelJob(scheduleId: string): void {
  if (activeJobs.has(scheduleId)) {
    activeJobs.get(scheduleId)!.cancel();
    activeJobs.delete(scheduleId);
  }
}

export async function runScheduledBackup(serverId: string, userId: string, scheduleId?: string, customName?: string): Promise<string> {
  const srv = await queryOne<any>(
    `SELECT s.*,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`,
    [serverId]
  );
  if (!srv || !srv.container_id) throw new Error('Server not running or no container');

  const sched = scheduleId ? await queryOne<any>(`SELECT * FROM backup_schedules WHERE id=$1`, [scheduleId]) : null;
  const destMode = sched?.destination || 'local';

  // Create backup record
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = customName || `auto-${ts}`;
  const backup = await queryOne<any>(
    `INSERT INTO backups(server_id,user_id,name,status,started_at) VALUES($1,$2,$3,'running',NOW()) RETURNING *`,
    [serverId, userId, backupName]
  );

  const localPath = path.join(BACKUP_PATH, `backup-${backup.id}.tar.gz`);
  fs.mkdirSync(BACKUP_PATH, { recursive: true });

  try {
    const agent = new AgentClient(srv.agent_url, srv.agent_secret);
    // Create tar.gz inside container, then copy out
    await agent.execCommand(srv.container_id, `tar -czf /tmp/sp-backup.tar.gz /data 2>/dev/null && echo DONE`);

    // Copy from container via exec (read from stdout)
    const output = await agent.execCommand(srv.container_id, `cat /tmp/sp-backup.tar.gz | base64 -w 0`);
    const buf = Buffer.from(output.trim(), 'base64');
    fs.writeFileSync(localPath, buf);

    const size = fs.statSync(localPath).size;
    await query(`UPDATE backups SET status='completed',size_bytes=$1,file_path=$2,completed_at=NOW() WHERE id=$3`,
      [size, localPath, backup.id]);

    // Upload to GDrive
    if ((destMode === 'gdrive' || destMode === 'both')) {
      const gdConn = await queryOne<any>(`SELECT root_folder_id FROM gdrive_connections WHERE user_id=$1 AND is_active=TRUE`, [userId]);
      if (gdConn?.root_folder_id) {
        try {
          await uploadBackupToDrive(userId, backup.id, localPath, srv.name, gdConn.root_folder_id);
          logger.info('[BackupScheduler] GDrive upload done for ' + backup.id);
          if (destMode === 'gdrive') {
            // Remove local if gdrive-only
            fs.unlinkSync(localPath);
            await query(`UPDATE backups SET file_path=NULL WHERE id=$1`, [backup.id]);
          }
        } catch (gErr: any) {
          logger.error('[BackupScheduler] GDrive upload failed: ' + gErr.message);
        }
      } else {
        logger.warn('[BackupScheduler] GDrive not connected for user ' + userId);
      }
    }

    // Retain policy: delete old local backups
    if (sched?.retain_count) {
      const old = await query<{id: string, file_path: string}>(
        `SELECT id,file_path FROM backups WHERE server_id=$1 AND status='completed' ORDER BY created_at DESC OFFSET $2`,
        [serverId, sched.retain_count]
      );
      for (const b of old) {
        if (b.file_path && fs.existsSync(b.file_path)) fs.unlinkSync(b.file_path);
        await query(`DELETE FROM backups WHERE id=$1`, [b.id]);
      }
    }

    if (scheduleId) await query(`UPDATE backup_schedules SET last_run=NOW() WHERE id=$1`, [scheduleId]);
    logger.info('[BackupScheduler] Backup complete: ' + backup.id + ' (' + Math.round(size / 1024) + 'KB)');
    return backup.id;
  } catch (err: any) {
    await query(`UPDATE backups SET status='failed',error_msg=$1 WHERE id=$2`, [err.message, backup.id]);
    throw err;
  }
}
