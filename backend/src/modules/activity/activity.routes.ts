import { Router } from 'express';
import { query } from '../../database';

export const activityRouter = Router();

activityRouter.get('/', async (req, res) => {
  const { userId, role } = req.user!;
  const { resource, limit = '50', offset = '0' } = req.query;
  const isAdmin = ['admin', 'superadmin'].includes(role);

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (!isAdmin) {
    conditions.push(`al.user_id=$${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }
  if (resource) {
    conditions.push(`al.resource=$${paramIdx}`);
    params.push(resource);
    paramIdx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = await query(
    `SELECT al.*,u.username FROM audit_log al LEFT JOIN users u ON u.id=al.user_id ${where} ORDER BY al.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit as string), parseInt(offset as string)]
  );
  const [tot] = await query(`SELECT COUNT(*) as n FROM audit_log al ${where}`, params);
  res.json({ rows, total: parseInt((tot as any).n) });
});

export async function logActivity(userId: string | null, action: string, resource: string, resourceId?: string, metadata: any = {}, ip?: string): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log(user_id,action,resource,resource_id,ip_address,metadata) VALUES($1,$2,$3,$4,$5,$6)`,
      [userId, action, resource, resourceId || null, ip || null, JSON.stringify(metadata)]
    );
  } catch { }
}
