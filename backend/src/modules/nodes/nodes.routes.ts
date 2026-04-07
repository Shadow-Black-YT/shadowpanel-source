import { Router } from 'express';
import { query, queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';
import { requireAdmin } from '../../middleware/auth';
import { AgentClient } from '../../utils/agentClient';
import crypto from 'crypto';

export const nodesRouter = Router();

nodesRouter.get('/', requireAdmin, async (_req, res) => {
  const rows = await query(`SELECT n.*,(SELECT COUNT(*) FROM servers WHERE node_id=n.id AND status!='suspended') as server_count FROM nodes n ORDER BY n.name`);
  res.json(rows);
});

nodesRouter.get('/:id', requireAdmin, async (req, res) => {
  const node = await queryOne(`SELECT * FROM nodes WHERE id=$1`, [req.params.id]);
  if (!node) throw new AppError('Node not found', 404);
  res.json(node);
});

nodesRouter.post('/', requireAdmin, async (req, res) => {
  const { name, agentUrl, location, portRangeStart=25000, portRangeEnd=35000 } = req.body;
  if (!name||!agentUrl) throw new AppError('Name and agent URL required', 400);
  const secret = crypto.randomBytes(32).toString('hex');
  const node = await queryOne(
    `INSERT INTO nodes(name,agent_url,agent_secret,location,port_range_start,port_range_end) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, agentUrl, secret, location||null, portRangeStart, portRangeEnd]
  );
  const installCmd = `curl -sSL ${process.env.PANEL_URL||'http://localhost'}/install-agent.sh | AGENT_SECRET=${secret} PANEL_URL=${process.env.PANEL_URL||'http://localhost'} AGENT_PORT=8080 bash`;
  res.status(201).json({ node, secret, installCommand: installCmd });
});

nodesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const { name, location, status, portRangeStart, portRangeEnd } = req.body;
  await query(`UPDATE nodes SET name=COALESCE($1,name),location=COALESCE($2,location),status=COALESCE($3::node_status,status),port_range_start=COALESCE($4,port_range_start),port_range_end=COALESCE($5,port_range_end),updated_at=NOW() WHERE id=$6`,
    [name||null,location||null,status||null,portRangeStart||null,portRangeEnd||null,req.params.id]);
  res.json({ message: 'Node updated' });
});

nodesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const srvs = await query(`SELECT COUNT(*) as n FROM servers WHERE node_id=$1 AND status!='suspended'`,[req.params.id]);
  if (parseInt((srvs[0] as any).n)>0) throw new AppError('Cannot delete node with active servers', 400);
  await query(`DELETE FROM nodes WHERE id=$1`, [req.params.id]);
  res.json({ message: 'Node deleted' });
});

nodesRouter.post('/:id/ping', requireAdmin, async (req, res) => {
  const node = await queryOne<any>(`SELECT agent_url,agent_secret FROM nodes WHERE id=$1`,[req.params.id]);
  if (!node) throw new AppError('Node not found', 404);
  const agent = new AgentClient(node.agent_url, node.agent_secret);
  try {
    const info = await agent.getNodeInfo();
    await query(`UPDATE nodes SET status='online',last_ping=NOW(),total_ram=$1,total_cpu=$2,total_disk=$3,cpu_usage=$4,ram_usage=$5 WHERE id=$6`,
      [info.totalRam,info.totalCpu,info.totalDisk,info.cpuUsage,info.ramUsed,req.params.id]);
    res.json({ status:'online', ...info });
  } catch (e:any) {
    await query(`UPDATE nodes SET status='offline' WHERE id=$1`,[req.params.id]);
    throw new AppError('Node unreachable: '+e.message, 503);
  }
});
