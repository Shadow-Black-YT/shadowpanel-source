import { Router } from 'express';
import { query, queryOne } from '../../database';
import { requireAdmin } from '../../middleware/auth';

export const settingsRouter = Router();

settingsRouter.get('/public', async (_req,res) => {
  const rows = await query(`SELECT key,value FROM settings WHERE key IN ('panel.name','panel.tagline','panel.url','panel.registration','panel.support_discord','panel.developed_by','panel.version')`);
  const obj: Record<string,string> = {};
  rows.forEach((r:any) => { obj[r.key]=r.value; });
  res.json(obj);
});

settingsRouter.get('/', requireAdmin, async (_req,res) => {
  const rows = await query(`SELECT key,value,type,updated_at FROM settings ORDER BY key`);
  res.json(rows);
});

settingsRouter.put('/:key', requireAdmin, async (req,res) => {
  const { value } = req.body;
  await query(`INSERT INTO settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=NOW()`,
    [req.params.key,value]);
  res.json({ message:'Setting saved' });
});

settingsRouter.put('/', requireAdmin, async (req,res) => {
  const { settings } = req.body;
  if (!settings) { res.status(400).json({error:'settings required'}); return; }
  for (const [k,v] of Object.entries(settings)) {
    await query(`INSERT INTO settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=NOW()`,
      [k,String(v)]);
  }
  res.json({ message:'Settings saved' });
});
