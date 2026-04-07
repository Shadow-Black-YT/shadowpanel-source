import { Router } from 'express';
import { query, queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';

export const domainsRouter = Router();

domainsRouter.get('/', async (req,res) => {
  const rows = await query(`SELECT d.*,s.name as server_name FROM domains d LEFT JOIN servers s ON s.id=d.server_id WHERE d.user_id=$1 ORDER BY d.created_at DESC`,[req.user!.userId]);
  res.json(rows);
});

domainsRouter.post('/', async (req,res) => {
  const { domain, serverId, targetPort=80 } = req.body;
  if (!domain) throw new AppError('Domain required',400);
  const r = await queryOne(`INSERT INTO domains(user_id,server_id,domain,target_port) VALUES($1,$2,$3,$4) RETURNING *`,
    [req.user!.userId,serverId||null,domain.toLowerCase(),targetPort]);
  res.status(201).json(r);
});

domainsRouter.delete('/:id', async (req,res) => {
  await query(`DELETE FROM domains WHERE id=$1 AND user_id=$2`,[req.params.id,req.user!.userId]);
  res.json({ message:'Domain removed' });
});
