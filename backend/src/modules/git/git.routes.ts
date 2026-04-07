import { Router, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { query, queryOne } from '../../database';
import { logger } from '../../utils/logger';
import {
  exchangeGitHubCode, listGitHubRepos, deployFromGit,
  getGitHubToken, generateWebhookSecret, verifyWebhookSignature,
} from '../../services/git.service';
import express from 'express';
import jwt from 'jsonwebtoken';

export const gitRouter = Router();

// GET /git/oauth-url — get GitHub OAuth URL
gitRouter.get('/oauth-url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new AppError('GitHub OAuth not configured', 501);
  const scope = 'repo,read:user,user:email';
  const redirect = encodeURIComponent((process.env.PANEL_URL || '') + '/api/v1/git/callback');
  const stateToken = jwt.sign({ sub: req.user!.userId, type: 'oauth_state' }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirect}&state=${stateToken}`;
  res.json({ url });
});

// GET /git/callback — GitHub OAuth callback
gitRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  if (error) { res.redirect('/settings?github=error&reason=' + error); return; }
  if (!code || !state) throw new AppError('No auth code or state', 400);

  let userId: string;
  try {
    const payload = jwt.verify(state as string, process.env.JWT_SECRET!) as any;
    if (payload.type !== 'oauth_state') throw new Error();
    userId = payload.sub;
  } catch {
    res.redirect('/settings?github=error&reason=Invalid_State_Token');
    return;
  }

  try {
    const result = await exchangeGitHubCode(code as string, userId);
    res.redirect('/settings?github=connected&user=' + encodeURIComponent(result.username));
  } catch (err: any) {
    res.redirect('/settings?github=error&reason=' + encodeURIComponent(err.message));
  }
});

// GET /git/status
gitRouter.get('/status', async (req, res) => {
  const conn = await queryOne<any>(
    `SELECT id,github_username,github_email,avatar_url,scopes,connected_at,last_used FROM github_connections WHERE user_id=$1`,
    [req.user!.userId]
  );
  res.json({ connected: !!conn, connection: conn || null });
});

// DELETE /git/disconnect
gitRouter.delete('/disconnect', async (req, res) => {
  await query(`DELETE FROM github_connections WHERE user_id=$1`, [req.user!.userId]);
  res.json({ message: 'GitHub disconnected' });
});

// GET /git/repos — list user repos
gitRouter.get('/repos', async (req, res) => {
  const { search, isPrivate } = req.query;
  let repos = await listGitHubRepos(req.user!.userId);
  if (search) repos = repos.filter((r: any) => r.fullName.toLowerCase().includes((search as string).toLowerCase()));
  if (isPrivate !== undefined) repos = repos.filter((r: any) => r.isPrivate === (isPrivate === 'true'));
  res.json(repos);
});

// GET /git/deployments/:serverId
gitRouter.get('/deployments/:serverId', async (req, res) => {
  const rows = await query(`SELECT * FROM git_deployments WHERE server_id=$1 ORDER BY created_at DESC`, [req.params.serverId]);
  res.json(rows);
});

// POST /git/deployments/:serverId — configure git deployment
gitRouter.post('/deployments/:serverId', async (req, res) => {
  const { repoUrl, repoName, branch = 'main', isPrivate = false, autoDeploy = false } = req.body;
  if (!repoUrl) throw new AppError('repoUrl required', 400);

  const webhookSecret = await generateWebhookSecret();
  const existing = await queryOne<any>(`SELECT id FROM git_deployments WHERE server_id=$1 ORDER BY created_at DESC LIMIT 1`, [req.params.serverId]);

  let dep: any;
  if (existing) {
    dep = await queryOne(`UPDATE git_deployments SET repo_url=$1,repo_name=$2,branch=$3,is_private=$4,auto_deploy=$5,webhook_secret=$6,deploy_status='idle' WHERE id=$7 RETURNING *`,
      [repoUrl, repoName || null, branch, isPrivate, autoDeploy, webhookSecret, existing.id]);
  } else {
    dep = await queryOne(`INSERT INTO git_deployments(server_id,user_id,repo_url,repo_name,branch,is_private,auto_deploy,webhook_secret) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.serverId, req.user!.userId, repoUrl, repoName || null, branch, isPrivate, autoDeploy, webhookSecret]);
  }

  const webhookUrl = (process.env.PANEL_URL || '') + '/api/v1/git/webhook/' + req.params.serverId;
  res.json({ deployment: dep, webhookUrl, webhookSecret });
});

// POST /git/deploy/:serverId — trigger deployment
gitRouter.post('/deploy/:serverId', async (req, res) => {
  const { userId } = req.user!;
  const srv = await queryOne<any>(`SELECT id,user_id FROM servers WHERE id=$1`, [req.params.serverId]);
  if (!srv) throw new AppError('Server not found', 404);

  const dep = await queryOne<any>(`SELECT * FROM git_deployments WHERE server_id=$1 ORDER BY created_at DESC LIMIT 1`, [req.params.serverId]);
  if (!dep) throw new AppError('No git deployment configured', 400);

  if (dep.is_private) {
    const token = await getGitHubToken(userId);
    if (!token) throw new AppError('Connect your GitHub account first to deploy private repos', 400);
  }

  res.json({ message: 'Deployment started', deploymentId: dep.id });
  setImmediate(() => deployFromGit(req.params.serverId, userId).catch(err => console.error('[GitDeploy]', err)));
});

// GET /git/deploy/:serverId/logs — get deploy log
gitRouter.get('/deploy/:serverId/logs', async (req, res) => {
  const dep = await queryOne<any>(`SELECT deploy_status,deploy_log,last_deploy_at,last_commit_sha,last_commit_msg FROM git_deployments WHERE server_id=$1 ORDER BY created_at DESC LIMIT 1`, [req.params.serverId]);
  res.json(dep || { deploy_status: 'idle', deploy_log: '' });
});

// POST /git/webhook/:serverId — GitHub webhook for auto-deploy
gitRouter.post('/webhook/:serverId', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string || '';
  const event = req.headers['x-github-event'] as string || '';
  const payload = req.body.toString();

  const dep = await queryOne<any>(`SELECT * FROM git_deployments WHERE server_id=$1 AND auto_deploy=TRUE`, [req.params.serverId]);
  if (!dep) { res.json({ skipped: 'auto-deploy disabled' }); return; }

  const valid = await verifyWebhookSignature(payload, signature, dep.webhook_secret);
  if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return; }

  if (event === 'push') {
    const body = JSON.parse(payload);
    const pushedBranch = body.ref?.split('/').pop();
    if (pushedBranch === dep.branch) {
      res.json({ message: 'Deployment triggered' });
      setImmediate(() => deployFromGit(req.params.serverId, dep.user_id).catch(console.error));
      return;
    }
  }
  res.json({ skipped: 'not target branch' });
});
