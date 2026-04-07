import { Router } from 'express';
import { queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';
import { AgentClient } from '../../utils/agentClient';
import multer from 'multer';
import path from 'path';

export const filesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

async function getAgent(serverId: string, userId: string, role: string) {
  const srv = await queryOne<any>(`SELECT s.container_id,s.user_id,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`, [serverId]);
  if (!srv) throw new AppError('Server not found', 404);

  if (srv.user_id !== userId && !['admin', 'superadmin'].includes(role)) {
    const access = await queryOne(`SELECT 1 FROM server_access WHERE server_id=$1 AND user_id=$2 AND 'files'=ANY(permissions)`, [serverId, userId]);
    if (!access) throw new AppError('Permission denied', 403);
  }

  if (!srv.container_id) throw new AppError('Server not running', 400);
  return { agent: new AgentClient(srv.agent_url, srv.agent_secret), cid: srv.container_id };
}

function sanitizePath(p: any): string {
  if (typeof p !== 'string') throw new AppError('Invalid path', 400);
  // Block shell metacharacters and quotes that could enable command injection
  if (/[;&|`$()<>\\"']/.test(p)) throw new AppError('Invalid characters in path', 400);
  // Also block newlines and other control characters
  if (/[\r\n\t\0]/.test(p)) throw new AppError('Invalid characters in path', 400);
  const normalized = path.normalize(p);
  if (!normalized.startsWith('/data')) throw new AppError('Path must be inside /data', 400);
  return normalized;
}

filesRouter.get('/:serverId', async (req, res) => {
  const p = sanitizePath(req.query.path || '/data');
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  const out = await agent.execCommand(cid, `ls -lah "${p}" 2>&1`);
  res.json({ path: p, listing: out });
});

filesRouter.get('/:serverId/read', async (req, res) => {
  const p = sanitizePath(req.query.path);
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  const content = await agent.execCommand(cid, `cat "${p}" 2>&1`);
  res.json({ content });
});

filesRouter.put('/:serverId/write', async (req, res) => {
  const { path: p, content } = req.body;
  if (content === undefined) throw new AppError('content required', 400);
  const safePath = sanitizePath(p);
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  const safe = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
  await agent.execCommand(cid, `cat > "${safePath}" << 'SPEOF'\n${content}\nSPEOF`).catch(async () => {
    await agent.execCommand(cid, `printf '%s' '${safe}' > "${safePath}"`);
  });
  res.json({ message: 'File saved' });
});

filesRouter.delete('/:serverId/delete', async (req, res) => {
  const p = sanitizePath(req.query.path);
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  await agent.execCommand(cid, `rm -rf "${p}"`);
  res.json({ message: 'Deleted' });
});

filesRouter.post('/:serverId/mkdir', async (req, res) => {
  const p = sanitizePath(req.body.path);
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  await agent.execCommand(cid, `mkdir -p "${p}"`);
  res.json({ message: 'Directory created' });
});

filesRouter.post('/:serverId/rename', async (req, res) => {
  const from = sanitizePath(req.body.from);
  const to = sanitizePath(req.body.to);
  const { agent, cid } = await getAgent(req.params.serverId, req.user!.userId, req.user!.role);
  await agent.execCommand(cid, `mv "${from}" "${to}"`);
  res.json({ message: 'Renamed' });
});
