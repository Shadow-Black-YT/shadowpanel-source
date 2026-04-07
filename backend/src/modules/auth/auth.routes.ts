import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { query, queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';

export const authRouter = Router();
const BCRYPT = 12;

const signAccess  = (id: string, role: string) =>
  jwt.sign({ sub: id, role, type: 'access' }, process.env.JWT_SECRET!, { expiresIn: '15m' } as any);
const signRefresh = (id: string) =>
  jwt.sign({ sub: id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' } as any);

async function saveSession(userId: string, token: string, ip: string, ua: string) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query(
    `INSERT INTO sessions(user_id,refresh_hash,ip_address,user_agent,expires_at) VALUES($1,$2,$3,$4,NOW()+'30 days')`,
    [userId, hash, ip, ua]
  );
}

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) throw new AppError('All fields required', 400);
  if (password.length < 8) throw new AppError('Password must be 8+ characters', 400);
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) throw new AppError('Username must be 3-32 alphanumeric chars', 400);

  const regOn = await queryOne<any>(`SELECT value FROM settings WHERE key='panel.registration'`);
  if (regOn?.value === 'false') throw new AppError('Registration is disabled', 403);

  const exists = await queryOne(`SELECT id FROM users WHERE email=$1 OR username=$2`, [email.toLowerCase(), username.toLowerCase()]);
  if (exists) throw new AppError('Email or username already taken', 409);

  const hash = await bcrypt.hash(password, BCRYPT);
  const user = await queryOne<any>(
    `INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username,email,role`,
    [username.toLowerCase(), email.toLowerCase(), hash]
  );

  const access  = signAccess(user.id, user.role);
  const refresh = signRefresh(user.id);
  await saveSession(user.id, refresh, req.ip || '', req.headers['user-agent'] || '');

  res.status(201).json({ user, accessToken: access, refreshToken: refresh });
});

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password, totpCode } = req.body;
  if (!email || !password) throw new AppError('Email and password required', 400);

  const user = await queryOne<any>(
    `SELECT id,username,email,password_hash,role,is_suspended,suspension_reason,
            totp_enabled,totp_secret,failed_logins,locked_until FROM users WHERE email=$1`,
    [email.toLowerCase()]
  );
  if (!user) throw new AppError('Invalid credentials', 401);

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new AppError('Account locked for ' + mins + ' more minutes', 423);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const fails = (user.failed_logins || 0) + 1;
    const maxFails = 5;
    if (fails >= maxFails) {
      await query(`UPDATE users SET failed_logins=$1,locked_until=NOW()+INTERVAL '15 minutes' WHERE id=$2`, [fails, user.id]);
      throw new AppError('Too many failed attempts. Account locked 15 minutes.', 423);
    }
    await query(`UPDATE users SET failed_logins=$1 WHERE id=$2`, [fails, user.id]);
    throw new AppError('Invalid credentials', 401);
  }

  if (user.is_suspended) throw new AppError('Account suspended: ' + (user.suspension_reason || 'Contact support'), 403);

  if (user.totp_enabled) {
    if (!totpCode) return res.json({ requires2FA: true });
    if (!authenticator.verify({ token: totpCode, secret: user.totp_secret }))
      throw new AppError('Invalid 2FA code', 401);
  }

  await query(`UPDATE users SET failed_logins=0,last_login_at=NOW(),last_login_ip=$1 WHERE id=$2`, [req.ip, user.id]);

  const access  = signAccess(user.id, user.role);
  const refresh = signRefresh(user.id);
  await saveSession(user.id, refresh, req.ip || '', req.headers['user-agent'] || '');

  const profile = await queryOne<any>(
    `SELECT id,username,email,role,ram_limit,cpu_limit,disk_limit,server_limit,totp_enabled,github_username,created_at FROM users WHERE id=$1`,
    [user.id]
  );
  res.json({ user: profile, accessToken: access, refreshToken: refresh });
});

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);
  let payload: any;
  try { payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!); }
  catch { throw new AppError('Invalid refresh token', 401); }
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const sess = await queryOne<any>(`SELECT user_id FROM sessions WHERE refresh_hash=$1 AND is_revoked=FALSE AND expires_at>NOW()`, [hash]);
  if (!sess) throw new AppError('Session expired', 401);
  const user = await queryOne<any>(`SELECT id,role,is_suspended FROM users WHERE id=$1`, [sess.user_id]);
  if (!user || user.is_suspended) throw new AppError('Account unavailable', 403);
  const newAccess  = signAccess(user.id, user.role);
  const newRefresh = signRefresh(user.id);
  const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
  await query(`UPDATE sessions SET refresh_hash=$1,last_used=NOW() WHERE refresh_hash=$2`, [newHash, hash]);
  res.json({ accessToken: newAccess, refreshToken: newRefresh });
});

// POST /auth/logout
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(`UPDATE sessions SET is_revoked=TRUE WHERE refresh_hash=$1`, [hash]);
  }
  res.json({ message: 'Logged out' });
});

// GET /auth/me
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await queryOne<any>(
    `SELECT id,username,email,role,ram_limit,cpu_limit,disk_limit,server_limit,
            totp_enabled,email_verified,github_username,last_login_at,created_at FROM users WHERE id=$1`,
    [req.user!.userId]
  );
  if (!user) throw new AppError('User not found', 404);
  res.json(user);
});

// PATCH /auth/me — update profile
authRouter.patch('/me', authenticate, async (req: Request, res: Response) => {
  const { password, currentPassword } = req.body;
  if (password) {
    if (!currentPassword) throw new AppError('Current password required', 400);
    const u = await queryOne<any>(`SELECT password_hash FROM users WHERE id=$1`, [req.user!.userId]);
    if (!await bcrypt.compare(currentPassword, u!.password_hash)) throw new AppError('Wrong current password', 401);
    if (password.length < 8) throw new AppError('New password must be 8+ chars', 400);
    const hash = await bcrypt.hash(password, BCRYPT);
    await query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [hash, req.user!.userId]);
  }
  res.json({ message: 'Profile updated' });
});

// 2FA
authRouter.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  const user = await queryOne<any>(`SELECT email,totp_enabled FROM users WHERE id=$1`, [req.user!.userId]);
  if (user?.totp_enabled) throw new AppError('2FA already enabled', 400);
  const secret = authenticator.generateSecret(32);
  const otpauth = authenticator.keyuri(user!.email, 'shadowPanel', secret);
  const qrCode = await QRCode.toDataURL(otpauth);
  await query(`UPDATE users SET totp_secret=$1 WHERE id=$2`, [secret, req.user!.userId]);
  const backupCodes = Array.from({length:8}, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  res.json({ secret, qrCode, backupCodes });
});

authRouter.post('/2fa/confirm', authenticate, async (req: Request, res: Response) => {
  const { code } = req.body;
  const user = await queryOne<any>(`SELECT totp_secret FROM users WHERE id=$1`, [req.user!.userId]);
  if (!user?.totp_secret) throw new AppError('2FA not set up', 400);
  if (!authenticator.verify({ token: code, secret: user.totp_secret })) throw new AppError('Invalid code', 400);
  await query(`UPDATE users SET totp_enabled=TRUE WHERE id=$1`, [req.user!.userId]);
  res.json({ message: '2FA enabled' });
});

authRouter.post('/2fa/disable', authenticate, async (req: Request, res: Response) => {
  const { code, password } = req.body;
  const user = await queryOne<any>(`SELECT password_hash,totp_secret FROM users WHERE id=$1`, [req.user!.userId]);
  if (!await bcrypt.compare(password, user!.password_hash)) throw new AppError('Wrong password', 401);
  if (!authenticator.verify({ token: code, secret: user!.totp_secret })) throw new AppError('Invalid 2FA code', 401);
  await query(`UPDATE users SET totp_enabled=FALSE,totp_secret=NULL WHERE id=$1`, [req.user!.userId]);
  res.json({ message: '2FA disabled' });
});

// Sessions
authRouter.get('/sessions', authenticate, async (req, res) => {
  const rows = await query(`SELECT id,ip_address,user_agent,last_used,created_at FROM sessions WHERE user_id=$1 AND is_revoked=FALSE AND expires_at>NOW() ORDER BY last_used DESC`, [req.user!.userId]);
  res.json(rows);
});
authRouter.delete('/sessions/:id', authenticate, async (req, res) => {
  await query(`UPDATE sessions SET is_revoked=TRUE WHERE id=$1 AND user_id=$2`, [req.params.id, req.user!.userId]);
  res.json({ message: 'Session revoked' });
});

// API tokens
authRouter.get('/tokens', authenticate, async (req, res) => {
  const rows = await query(`SELECT id,name,token_prefix,last_used,expires_at,created_at FROM api_tokens WHERE user_id=$1 ORDER BY created_at DESC`, [req.user!.userId]);
  res.json(rows);
});
authRouter.post('/tokens', authenticate, async (req, res) => {
  const { name, expiresIn } = req.body;
  if (!name) throw new AppError('Token name required', 400);
  const raw = 'sp_' + crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);
  const expires = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  await query(`INSERT INTO api_tokens(user_id,name,token_hash,token_prefix,expires_at) VALUES($1,$2,$3,$4,$5)`,
    [req.user!.userId, name, hash, prefix, expires]);
  res.status(201).json({ message: 'Save this token — it will not be shown again.', token: raw });
});
authRouter.delete('/tokens/:id', authenticate, async (req, res) => {
  await query(`DELETE FROM api_tokens WHERE id=$1 AND user_id=$2`, [req.params.id, req.user!.userId]);
  res.json({ message: 'Token deleted' });
});

// GitHub OAuth link
authRouter.post('/github/callback', authenticate, async (req, res) => {
  const { code } = req.body;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId) throw new AppError('GitHub OAuth not configured', 501);
  const axios = await import('axios');
  const tokenRes = await axios.default.post('https://github.com/login/oauth/access_token',
    { client_id: clientId, client_secret: clientSecret, code },
    { headers: { Accept: 'application/json' } }
  );
  const ghToken = tokenRes.data.access_token;
  const ghUser  = await axios.default.get('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + ghToken } });
  const enc = Buffer.from(ghToken).toString('base64');
  await query(`UPDATE users SET github_id=$1,github_username=$2,github_token_enc=$3 WHERE id=$4`,
    [String(ghUser.data.id), ghUser.data.login, enc, req.user!.userId]);
  res.json({ message: 'GitHub connected', username: ghUser.data.login });
});
authRouter.delete('/github', authenticate, async (req, res) => {
  await query(`UPDATE users SET github_id=NULL,github_username=NULL,github_token_enc=NULL WHERE id=$1`, [req.user!.userId]);
  res.json({ message: 'GitHub disconnected' });
});
