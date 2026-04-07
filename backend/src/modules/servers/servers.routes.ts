import { Router, Request, Response } from 'express';
import { query, queryOne } from '../../database';
import { AppError } from '../../middleware/errorHandler';
import { requireAdmin } from '../../middleware/auth';
import { AgentClient } from '../../utils/agentClient';
import { logger } from '../../utils/logger';

export const serversRouter = Router();

// Helper: verify user owns server or is admin
async function assertAccess(serverId: string, userId: string, role: string, perm = 'view') {
  if (['admin', 'superadmin'].includes(role)) return;
  const owned = await queryOne(`SELECT 1 FROM servers WHERE id=$1 AND user_id=$2`, [serverId, userId]);
  if (owned) return;
  const granted = await queryOne(`SELECT permissions FROM server_access WHERE server_id=$1 AND user_id=$2`, [serverId, userId]);
  if (granted && (granted as any).permissions?.includes(perm)) return;
  throw new AppError('Access denied', 403);
}

// Helper: allocate port
async function allocatePort(nodeId: string): Promise<number> {
  const node = await queryOne<any>(`SELECT port_range_start,port_range_end,used_ports FROM nodes WHERE id=$1`, [nodeId]);
  if (!node) throw new AppError('Node not found', 404);
  for (let p = node.port_range_start; p <= node.port_range_end; p++) {
    if (!(node.used_ports || []).includes(p)) {
      await query(`UPDATE nodes SET used_ports=array_append(used_ports,$1) WHERE id=$2`, [p, nodeId]);
      return p;
    }
  }
  throw new AppError('No ports available on this node', 503);
}

// GET /servers
serversRouter.get('/', async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const { status, search, page = '1', limit = '20' } = req.query;
  const isAdmin = ['admin', 'superadmin'].includes(role);
  const off = (parseInt(page as string) - 1) * parseInt(limit as string);

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (!isAdmin) {
    conditions.push(`(s.user_id=$${paramIdx} OR EXISTS(SELECT 1 FROM server_access sa WHERE sa.server_id=s.id AND sa.user_id=$${paramIdx}))`);
    params.push(userId);
    paramIdx++;
  }
  if (status) {
    conditions.push(`s.status=$${paramIdx}`);
    params.push(status);
    paramIdx++;
  }
  if (search) {
    conditions.push(`s.name ILIKE $${paramIdx}`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const rows = await query(
    `SELECT s.*,u.username,n.name as node_name,n.location,n.status as node_status FROM servers s
     LEFT JOIN users u ON u.id=s.user_id LEFT JOIN nodes n ON n.id=s.node_id
     ${where} ORDER BY s.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit as string), off]
  );
  const [total] = await query(`SELECT COUNT(*) as c FROM servers s ${where}`, params);
  res.json({ rows, total: parseInt((total as any).c), page: parseInt(page as string) });
});

// GET /servers/templates
serversRouter.get('/templates', async (_req, res) => {
  const rows = await query(`SELECT * FROM templates ORDER BY sort_order,name`);
  res.json(rows);
});

// GET /servers/:id
serversRouter.get('/:id', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role);
  const srv = await queryOne(
    `SELECT s.*,u.username,n.name as node_name,n.location,n.public_ip,n.status as node_status
     FROM servers s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`,
    [req.params.id]
  );
  if (!srv) throw new AppError('Server not found', 404);
  res.json(srv);
});

// POST /servers
serversRouter.post('/', async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const {
    name, nodeId, templateId, dockerImage, startupCommand, environment,
    ramLimit = 512, cpuLimit = 100, diskLimit = 2048, swapLimit = 0,
    gitRepo, gitBranch = 'main', gitAutoDeploy = false, autoBackup = false, description
  } = req.body;
  if (!name) throw new AppError('Server name required', 400);

  // Check limits
  const user = await queryOne<any>(`SELECT server_limit,ram_limit,cpu_limit,disk_limit FROM users WHERE id=$1`, [userId]);
  const counts = await queryOne<any>(`SELECT COUNT(*) as n, COALESCE(SUM(ram_limit),0) as ram, COALESCE(SUM(cpu_limit),0) as cpu, COALESCE(SUM(disk_limit),0) as disk FROM servers WHERE user_id=$1 AND status!='suspended'`, [userId]);
  if (parseInt(counts.n) >= user!.server_limit) throw new AppError('Server limit reached (' + user!.server_limit + ')', 422);
  if (parseInt(counts.ram) + ramLimit > user!.ram_limit) throw new AppError('RAM limit exceeded', 422);
  if (parseInt(counts.cpu) + cpuLimit > user!.cpu_limit) throw new AppError('CPU limit exceeded', 422);
  if (parseInt(counts.disk) + diskLimit > user!.disk_limit) throw new AppError('Disk limit exceeded', 422);

  // Find node
  let targetNode = nodeId;
  if (!targetNode) {
    const node = await queryOne<any>(`SELECT id FROM nodes WHERE status='online' AND (total_ram-allocated_ram)>=$1 AND (total_cpu-allocated_cpu)>=$2 ORDER BY (allocated_ram::float/NULLIF(total_ram,0)) ASC LIMIT 1`, [ramLimit, cpuLimit]);
    if (!node) throw new AppError('No node available with sufficient resources', 503);
    targetNode = node.id;
  }

  // Template defaults
  let image = dockerImage;
  let startup = startupCommand;
  let env = environment || {};
  let ports: any[] = [];

  if (templateId) {
    const tpl = await queryOne<any>(`SELECT * FROM templates WHERE id=$1`, [templateId]);
    if (tpl) {
      image = image || tpl.docker_image;
      startup = startup || tpl.startup_cmd;
      env = { ...tpl.default_env, ...env };
      ports = tpl.default_ports || [];
    }
  }
  if (!image) throw new AppError('Docker image required', 400);

  // Allocate port
  const externalPort = await allocatePort(targetNode);
  if (ports.length > 0) ports[0].external = externalPort;

  const srv = await queryOne<any>(
    `INSERT INTO servers(user_id,node_id,name,description,status,docker_image,startup_command,
       environment,port_mappings,volumes,ram_limit,cpu_limit,disk_limit,swap_limit,
       external_port,git_repo,git_branch,git_auto_deploy,auto_backup)
     VALUES($1,$2,$3,$4,'installing',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [userId, targetNode, name, description || null, image, startup || null,
      JSON.stringify(env), JSON.stringify(ports),
      JSON.stringify([{ host: '/data/servers/' + userId, container: '/data' }]),
      ramLimit, cpuLimit, diskLimit, swapLimit, externalPort,
      gitRepo || null, gitBranch, !!gitAutoDeploy, !!autoBackup]
  );

  // Deploy async
  setImmediate(() => deployServer(srv.id).catch(e => logger.error('Deploy error:', e)));
  res.status(201).json(srv);
});

async function deployServer(serverId: string): Promise<void> {
  const srv = await queryOne<any>(
    `SELECT s.*,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`, [serverId]
  );
  if (!srv) return;
  const agent = new AgentClient(srv.agent_url, srv.agent_secret);
  try {
    await query(`UPDATE servers SET status='installing' WHERE id=$1`, [serverId]);
    const netName = 'sp_net_' + serverId.replace(/-/g, '').slice(0, 8);
    await agent.createNetwork(netName);
    await agent.pullImage(srv.docker_image);
    if (srv.git_repo) {
      const user = await queryOne<any>(`SELECT github_token_enc FROM users WHERE id=$1`, [srv.user_id]);
      const tok = user?.github_token_enc ? Buffer.from(user.github_token_enc, 'base64').toString('utf-8') : null;
      await agent.cloneRepo(serverId, srv.git_repo, srv.git_branch || 'main', tok);
    }
    const ports = srv.port_mappings || [];
    const spec = {
      serverId,
      name: 'sp_' + serverId.replace(/-/g, '').slice(0, 12),
      image: srv.docker_image,
      startup: srv.startup_command,
      env: srv.environment || {},
      ports,
      volumes: srv.volumes || [],
      memory: (srv.ram_limit || 512) * 1024 * 1024,
      memorySwap: ((srv.ram_limit || 512) + (srv.swap_limit || 0)) * 1024 * 1024,
      cpuQuota: (srv.cpu_limit || 100) * 1000,
      cpuPeriod: 100000,
      networkMode: netName,
      restartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 0 },
      capDrop: ['ALL'],
      capAdd: ['CHOWN', 'SETUID', 'SETGID', 'NET_BIND_SERVICE'],
      securityOpt: ['no-new-privileges:true'],
      labels: { 'shadowpanel.server_id': serverId, 'shadowpanel.managed': 'true' },
    };
    const containerId = await agent.createContainer(spec);
    await agent.startContainer(containerId);
    await query(`UPDATE servers SET container_id=$1,status='running',updated_at=NOW() WHERE id=$2`, [containerId, serverId]);
    logger.info('Server deployed: ' + serverId + ' → ' + containerId);
  } catch (err: any) {
    await query(`UPDATE servers SET status='error' WHERE id=$1`, [serverId]);
    logger.error('Deploy failed ' + serverId + ': ' + err.message);
  }
}

// PATCH /servers/:id
serversRouter.patch('/:id', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'settings');
  const { name, description, startupCommand, environment, gitRepo, gitBranch, gitAutoDeploy, autoBackup } = req.body;
  await query(
    `UPDATE servers SET name=COALESCE($1,name),description=COALESCE($2,description),
     startup_command=COALESCE($3,startup_command),environment=COALESCE($4::jsonb,environment),
     git_repo=COALESCE($5,git_repo),git_branch=COALESCE($6,git_branch),
     git_auto_deploy=COALESCE($7,git_auto_deploy),auto_backup=COALESCE($8,auto_backup),updated_at=NOW()
     WHERE id=$9`,
    [name || null, description || null, startupCommand || null,
    environment ? JSON.stringify(environment) : null,
    gitRepo || null, gitBranch || null,
    gitAutoDeploy !== undefined ? gitAutoDeploy : null,
    autoBackup !== undefined ? autoBackup : null,
    req.params.id]
  );
  res.json({ message: 'Server updated' });
});

// POST /servers/:id/power
serversRouter.post('/:id/power', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'power');
  const { action } = req.body;
  if (!['start', 'stop', 'restart', 'kill'].includes(action)) throw new AppError('Invalid action', 400);
  const srv = await queryOne<any>(
    `SELECT s.container_id,s.status,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`,
    [req.params.id]
  );
  if (!srv?.container_id) throw new AppError('Container not found — rebuild the server', 400);
  const agent = new AgentClient(srv.agent_url, srv.agent_secret);
  await agent.powerAction(srv.container_id, action);
  const statusMap: Record<string, string> = { start: 'running', stop: 'stopped', restart: 'running', kill: 'stopped' };
  await query(`UPDATE servers SET status=$1,updated_at=NOW() WHERE id=$2`, [statusMap[action], req.params.id]);
  res.json({ message: action + ' sent' });
});

// POST /servers/:id/rebuild
serversRouter.post('/:id/rebuild', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'power');
  await query(`UPDATE servers SET status='rebuilding' WHERE id=$1`, [req.params.id]);
  const srv = await queryOne<any>(`SELECT container_id,node_id,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`, [req.params.id]);
  if (srv?.container_id) {
    const agent = new AgentClient(srv.agent_url, srv.agent_secret);
    await agent.powerAction(srv.container_id, 'kill').catch(() => { });
    await agent.deleteContainer(srv.container_id, false).catch(() => { });
  }
  setImmediate(() => deployServer(req.params.id).catch(e => logger.error('Rebuild error:', e)));
  res.json({ message: 'Rebuild started' });
});

// DELETE /servers/:id
serversRouter.delete('/:id', async (req: Request, res: Response) => {
  const srv = await queryOne<any>(`SELECT s.*,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`, [req.params.id]);
  if (!srv) throw new AppError('Server not found', 404);
  const { userId, role } = req.user!;
  if (srv.user_id !== userId && !['admin', 'superadmin'].includes(role)) throw new AppError('Forbidden', 403);
  if (srv.container_id) {
    const agent = new AgentClient(srv.agent_url, srv.agent_secret);
    await agent.powerAction(srv.container_id, 'kill').catch(() => { });
    await agent.deleteContainer(srv.container_id, true).catch(() => { });
  }
  if (srv.external_port) await query(`UPDATE nodes SET used_ports=array_remove(used_ports,$1) WHERE id=$2`, [srv.external_port, srv.node_id]);
  await query(`DELETE FROM servers WHERE id=$1`, [req.params.id]);
  res.json({ message: 'Server deleted' });
});

// GET /servers/:id/stats
serversRouter.get('/:id/stats', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role);
  const { period = '1h' } = req.query;
  const intervals: Record<string, string> = { '1h': '1 hour', '6h': '6 hours', '24h': '1 day', '7d': '7 days', '30d': '30 days' };
  let interval = intervals[period as string];
  if (!interval) interval = '1 hour';

  const stats = await query(
    `SELECT date_trunc('minute',recorded_at) as time, AVG(cpu_usage)::numeric(5,2) as cpu,
            AVG(ram_usage)::integer as ram, SUM(net_rx) as net_rx, SUM(net_tx) as net_tx
     FROM server_stats WHERE server_id=$1 AND recorded_at > NOW() - $2::interval
     GROUP BY 1 ORDER BY 1`,
    [req.params.id, interval]
  );
  res.json({ stats, period });
});

// POST /servers/:id/access — share server
serversRouter.post('/:id/access', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'settings');
  const { email, permissions = ['view', 'console', 'files'] } = req.body;
  const target = await queryOne<any>(`SELECT id FROM users WHERE email=$1`, [email?.toLowerCase()]);
  if (!target) throw new AppError('User not found', 404);
  await query(
    `INSERT INTO server_access(server_id,user_id,granted_by,permissions) VALUES($1,$2,$3,$4)
     ON CONFLICT(server_id,user_id) DO UPDATE SET permissions=$4`,
    [req.params.id, target.id, req.user!.userId, permissions]
  );
  res.json({ message: 'Access granted to ' + email });
});

serversRouter.delete('/:id/access/:uid', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'settings');
  await query(`DELETE FROM server_access WHERE server_id=$1 AND user_id=$2`, [req.params.id, req.params.uid]);
  res.json({ message: 'Access revoked' });
});

serversRouter.get('/:id/access', async (req: Request, res: Response) => {
  await assertAccess(req.params.id, req.user!.userId, req.user!.role, 'settings');
  const rows = await query(`SELECT sa.*,u.username,u.email FROM server_access sa JOIN users u ON u.id=sa.user_id WHERE sa.server_id=$1`, [req.params.id]);
  res.json(rows);
});

// Admin-only: list all users (for server create)
serversRouter.get('/admin/users', requireAdmin, async (_req, res) => {
  const rows = await query(`SELECT id,username,email,role,server_limit,ram_limit,cpu_limit,disk_limit,is_suspended,created_at FROM users ORDER BY created_at DESC`);
  res.json(rows);
});
serversRouter.get('/admin/users/:id/servers', requireAdmin, async (req, res) => {
  const rows = await query(`SELECT s.*,n.name as node_name FROM servers s LEFT JOIN nodes n ON n.id=s.node_id WHERE s.user_id=$1`, [req.params.id]);
  res.json(rows);
});
serversRouter.patch('/admin/users/:id', requireAdmin, async (req, res) => {
  const { serverLimit, ramLimit, cpuLimit, diskLimit, isSuspended, suspensionReason } = req.body;
  await query(`UPDATE users SET server_limit=COALESCE($1,server_limit),ram_limit=COALESCE($2,ram_limit),cpu_limit=COALESCE($3,cpu_limit),disk_limit=COALESCE($4,disk_limit),is_suspended=COALESCE($5,is_suspended),suspension_reason=COALESCE($6,suspension_reason),updated_at=NOW() WHERE id=$7`,
    [serverLimit || null, ramLimit || null, cpuLimit || null, diskLimit || null, isSuspended !== undefined ? isSuspended : null, suspensionReason || null, req.params.id]);
  res.json({ message: 'User updated' });
});
serversRouter.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  const srvs = await query(`SELECT COUNT(*) as n FROM servers WHERE user_id=$1`, [req.params.id]);
  if (parseInt((srvs[0] as any).n) > 0) throw new AppError('Delete user servers first', 400);
  await query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
  res.json({ message: 'User deleted' });
});
serversRouter.post('/admin/users', requireAdmin, async (req, res) => {
  const bcrypt = await import('bcryptjs');
  const { username, email, password, role = 'client', serverLimit = 2, ramLimit = 512, cpuLimit = 100, diskLimit = 2048 } = req.body;
  if (!username || !email || !password) throw new AppError('username, email, password required', 400);
  const hash = await bcrypt.default.hash(password, 12);
  const u = await queryOne(`INSERT INTO users(username,email,password_hash,role,email_verified,server_limit,ram_limit,cpu_limit,disk_limit) VALUES($1,$2,$3,$4,TRUE,$5,$6,$7,$8) RETURNING id,username,email,role`,
    [username.toLowerCase(), email.toLowerCase(), hash, role, serverLimit, ramLimit, cpuLimit, diskLimit]);
  res.status(201).json(u);
});
