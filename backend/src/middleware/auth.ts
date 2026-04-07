import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { queryOne } from '../database';
import { AppError } from './errorHandler';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const apiToken = req.headers['x-api-token'] as string;

    // API Token auth
    if (apiToken) {
      const hash = crypto.createHash('sha256').update(apiToken).digest('hex');
      const token = await queryOne<any>(
        `SELECT at.user_id, u.username, u.email, u.role, u.is_suspended
         FROM api_tokens at JOIN users u ON u.id = at.user_id
         WHERE at.token_hash = $1 AND (at.expires_at IS NULL OR at.expires_at > NOW())`,
        [hash]
      );
      if (!token) throw new AppError('Invalid API token', 401);
      if (token.is_suspended) throw new AppError('Account suspended', 403);
      await queryOne(`UPDATE api_tokens SET last_used=NOW() WHERE token_hash=$1`, [hash]);
      req.user = { userId: token.user_id, email: token.email, username: token.username, role: token.role };
      return next();
    }

    // JWT auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);
    const jwtToken = authHeader.split(' ')[1];

    let payload: any;
    try {
      payload = jwt.verify(jwtToken, process.env.JWT_SECRET!);
    } catch (e: any) {
      throw new AppError(e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', 401);
    }

    const user = await queryOne<any>(
      `SELECT id, username, email, role, is_suspended FROM users WHERE id=$1`, [payload.sub]
    );
    if (!user) throw new AppError('User not found', 401);
    if (user.is_suspended) throw new AppError('Account suspended', 403);

    req.user = { userId: user.id, email: user.email, username: user.username, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(roles: string[]) {
  const RANK: Record<string, number> = { superadmin: 100, admin: 80, client: 10 };
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    const minRank = Math.min(...roles.map(r => RANK[r] || 999));
    if ((RANK[req.user.role] || 0) < minRank) return next(new AppError('Insufficient permissions', 403));
    next();
  };
}

export const requireAdmin = requireRole(['admin', 'superadmin']);
