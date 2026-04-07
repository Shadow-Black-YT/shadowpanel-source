import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { queryOne, query } from '../database';
import { encrypt, decrypt, getSystemKey } from './encryption';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

const ROOT_FOLDER_NAME = 'shadowPanel Backups';

function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || process.env.PANEL_URL + '/api/v1/gdrive/callback'
  );
}

export function getAuthUrl(state?: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state,
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
}

export async function exchangeCode(code: string, userId: string): Promise<any> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: gUser } = await oauth2.userinfo.get();

  // Get/create root folder
  const drive = google.drive({ version: 'v3', auth: client });
  const rootFolder = await ensureRootFolder(drive);

  const sysKey = getSystemKey();
  const encAccess = encrypt(tokens.access_token!, sysKey);
  const encRefresh = encrypt(tokens.refresh_token || '', sysKey);

  await query(
    `INSERT INTO gdrive_connections(user_id,access_token_enc,refresh_token_enc,token_expires_at,email,display_name,root_folder_id)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token_enc=$2,refresh_token_enc=$3,token_expires_at=$4,
       email=$5,display_name=$6,root_folder_id=$7,is_active=TRUE,last_sync=NOW()`,
    [userId, encAccess, encRefresh, tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      gUser.email, gUser.name, rootFolder.id]
  );

  return { email: gUser.email, name: gUser.name, rootFolderId: rootFolder.id };
}

async function ensureRootFolder(drive: drive_v3.Drive): Promise<drive_v3.Schema$File> {
  const res = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
  });
  if (res.data.files?.length) return res.data.files[0];
  const folder = await drive.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id,name',
  });
  return folder.data;
}

export async function getAuthedDrive(userId: string): Promise<drive_v3.Drive | null> {
  const conn = await queryOne<any>(`SELECT * FROM gdrive_connections WHERE user_id=$1 AND is_active=TRUE`, [userId]);
  if (!conn) return null;

  const sysKey = getSystemKey();
  const client = getOAuth2Client();
  let accessToken = decrypt(conn.access_token_enc, sysKey);
  const refreshToken = conn.refresh_token_enc ? decrypt(conn.refresh_token_enc, sysKey) : '';

  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  // Refresh if expired
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date(Date.now() + 60000)) {
    const { credentials } = await client.refreshAccessToken();
    const newEncAccess = encrypt(credentials.access_token!, sysKey);
    await query(`UPDATE gdrive_connections SET access_token_enc=$1,token_expires_at=$2,last_sync=NOW() WHERE user_id=$3`,
      [newEncAccess, credentials.expiry_date ? new Date(credentials.expiry_date) : null, userId]);
    client.setCredentials(credentials);
  }

  return google.drive({ version: 'v3', auth: client });
}

export async function getOrCreateServerFolder(userId: string, serverName: string, rootFolderId: string): Promise<string> {
  const drive = await getAuthedDrive(userId);
  if (!drive) throw new Error('Google Drive not connected');

  const safeName = serverName.replace(/[<>:"/\|?*]/g, '-');
  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
    fields: 'files(id,name)',
  });
  if (res.data.files?.length) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  });
  return folder.data.id!;
}

export async function uploadBackupToDrive(
  userId: string,
  backupId: string,
  filePath: string,
  serverName: string,
  rootFolderId: string
): Promise<{ fileId: string; fileName: string }> {
  const drive = await getAuthedDrive(userId);
  if (!drive) throw new Error('Drive not connected');

  const folderId = await getOrCreateServerFolder(userId, serverName, rootFolderId);
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  await query(`INSERT INTO gdrive_backup_logs(backup_id,file_name,folder_id,size_bytes,status) VALUES($1,$2,$3,$4,'uploading')
    ON CONFLICT DO NOTHING`, [backupId, fileName, folderId, fileSize]);

  const fileStream = fs.createReadStream(filePath);
  const mimeType = mime.lookup(filePath) || 'application/gzip';

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: fileStream },
    fields: 'id,name,size',
  });

  const fileId = res.data.id!;
  await query(`UPDATE gdrive_backup_logs SET file_id=$1,status='done',uploaded_at=NOW() WHERE backup_id=$2`, [fileId, backupId]);

  // Clean up old backups in Drive (retain policy)
  const sched = await queryOne<any>(`SELECT retain_count,gdrive_folder_id FROM backup_schedules WHERE user_id=$1 LIMIT 1`, [userId]);
  if (sched?.retain_count) {
    const old = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: 'createdTime asc',
      fields: 'files(id,name,createdTime)',
    });
    const files = old.data.files || [];
    const toDelete = files.slice(0, Math.max(0, files.length - sched.retain_count));
    await Promise.allSettled(toDelete.map(f => drive.files.delete({ fileId: f.id! })));
  }

  logger.info('[GDrive] Uploaded backup: ' + fileName + ' → fileId:' + fileId);
  return { fileId, fileName };
}

export async function listDriveFiles(userId: string, folderId?: string): Promise<any[]> {
  const drive = await getAuthedDrive(userId);
  if (!drive) throw new Error('Drive not connected');

  const conn = await queryOne<any>(`SELECT root_folder_id FROM gdrive_connections WHERE user_id=$1`, [userId]);
  const targetFolder = folderId || conn?.root_folder_id;

  const res = await drive.files.list({
    q: `'${targetFolder}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime)',
    orderBy: 'modifiedTime desc',
  });
  return res.data.files || [];
}

export async function downloadDriveFile(userId: string, fileId: string, destPath: string): Promise<void> {
  const drive = await getAuthedDrive(userId);
  if (!drive) throw new Error('Drive not connected');

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }) as any;
  await new Promise<void>((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    res.data.on('error', reject);
    dest.on('error', reject);
    dest.on('finish', resolve);
    res.data.pipe(dest);
  });
  logger.info('[GDrive] Downloaded file: ' + fileId + ' → ' + destPath);
}
