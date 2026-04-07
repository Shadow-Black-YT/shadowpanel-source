import { query, queryOne } from '../database';
import { encrypt, decrypt, getSystemKey } from './encryption';
import { AgentClient } from '../utils/agentClient';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';

export async function exchangeGitHubCode(code: string, userId: string): Promise<any> {
  const clientId     = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  if (!clientId) throw new Error('GitHub OAuth not configured');

  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    { client_id: clientId, client_secret: clientSecret, code },
    { headers: { Accept: 'application/json' } }
  );
  const { access_token, scope, error } = tokenRes.data;
  if (error || !access_token) throw new Error(tokenRes.data.error_description || 'GitHub OAuth failed');

  const userRes = await axios.get('https://api.github.com/user', {
    headers: { Authorization: 'Bearer ' + access_token, 'User-Agent': 'shadowPanel/1.0' },
  });
  const emailRes = await axios.get('https://api.github.com/user/emails', {
    headers: { Authorization: 'Bearer ' + access_token, 'User-Agent': 'shadowPanel/1.0' },
  });
  const primaryEmail = emailRes.data.find((e: any) => e.primary)?.email || '';

  const sysKey = getSystemKey();
  const encToken = encrypt(access_token, sysKey);

  await query(
    `INSERT INTO github_connections(user_id,github_id,github_username,github_email,access_token_enc,avatar_url,scopes)
     VALUES($1,$2,$3,$4,$5,$6,$7::text[])
     ON CONFLICT(user_id) DO UPDATE SET
       github_id=$2,github_username=$3,github_email=$4,access_token_enc=$5,avatar_url=$6,scopes=$7::text[],last_used=NOW()`,
    [userId, String(userRes.data.id), userRes.data.login, primaryEmail, encToken, userRes.data.avatar_url, scope?.split(',') || []]
  );

  return { username: userRes.data.login, email: primaryEmail, avatarUrl: userRes.data.avatar_url, repos: userRes.data.public_repos };
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const conn = await queryOne<any>(`SELECT access_token_enc FROM github_connections WHERE user_id=$1`, [userId]);
  if (!conn) return null;
  return decrypt(conn.access_token_enc, getSystemKey());
}

export async function listGitHubRepos(userId: string): Promise<any[]> {
  const token = await getGitHubToken(userId);
  if (!token) throw new Error('GitHub not connected');

  const repos: any[] = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`, {
      headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'shadowPanel/1.0' },
    });
    repos.push(...res.data);
    if (res.data.length < 100) break;
    page++;
    if (page > 5) break; // max 500 repos
  }
  return repos.map((r: any) => ({
    id: r.id, name: r.name, fullName: r.full_name, isPrivate: r.private,
    cloneUrl: r.clone_url, defaultBranch: r.default_branch,
    description: r.description, updatedAt: r.updated_at, language: r.language,
    starCount: r.stargazers_count,
  }));
}

export async function deployFromGit(serverId: string, userId: string): Promise<void> {
  const [srv, gitDep] = await Promise.all([
    queryOne<any>(`SELECT s.*,n.agent_url,n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`, [serverId]),
    queryOne<any>(`SELECT * FROM git_deployments WHERE server_id=$1 ORDER BY created_at DESC LIMIT 1`, [serverId]),
  ]);
  if (!srv)    throw new Error('Server not found');
  if (!gitDep) throw new Error('No git deployment configured for this server');

  await query(`UPDATE git_deployments SET deploy_status='deploying',deploy_log='' WHERE id=$1`, [gitDep.id]);

  const token = gitDep.is_private ? await getGitHubToken(userId) : null;
  const agent = new AgentClient(srv.agent_url, srv.agent_secret);

  let log = '';
  const addLog = async (msg: string) => {
    log += '[' + new Date().toISOString() + '] ' + msg + '\n';
    await query(`UPDATE git_deployments SET deploy_log=$1 WHERE id=$2`, [log, gitDep.id]);
    logger.info('[GitDeploy:' + serverId.slice(0,8) + '] ' + msg);
  };

  try {
    await addLog('Starting deployment from ' + gitDep.repo_url + ' branch=' + gitDep.branch);
    await agent.cloneRepo(serverId, gitDep.repo_url, gitDep.branch, token);
    await addLog('Code pulled successfully');

    // Get latest commit info
    if (token) {
      const repoMatch = gitDep.repo_url.match(/github\.com\/(.+?)(?:\.git)?$/);
      if (repoMatch) {
        const commitRes = await axios.get(
          `https://api.github.com/repos/${repoMatch[1]}/commits/${gitDep.branch}`,
          { headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'shadowPanel/1.0' } }
        ).catch(() => null);
        if (commitRes) {
          await query(`UPDATE git_deployments SET last_commit_sha=$1,last_commit_msg=$2 WHERE id=$3`,
            [commitRes.data.sha?.slice(0,7), commitRes.data.commit?.message?.split('\n')[0], gitDep.id]);
          await addLog('Commit: ' + commitRes.data.sha?.slice(0,7) + ' — ' + commitRes.data.commit?.message?.split('\n')[0]);
        }
      }
    }

    // Restart server
    if (srv.container_id && srv.status === 'running') {
      await agent.powerAction(srv.container_id, 'restart');
      await addLog('Server restarted with new code');
    }

    await addLog('Deployment complete ✓');
    await query(`UPDATE git_deployments SET deploy_status='success',last_deploy_at=NOW(),deploy_log=$1 WHERE id=$2`, [log, gitDep.id]);
    await query(`UPDATE servers SET last_deployed=NOW() WHERE id=$1`, [serverId]);
  } catch (err: any) {
    await addLog('ERROR: ' + err.message);
    await query(`UPDATE git_deployments SET deploy_status='failed',deploy_log=$1 WHERE id=$2`, [log, gitDep.id]);
    throw err;
  }
}

export async function generateWebhookSecret(): Promise<string> {
  return crypto.randomBytes(32).toString('hex');
}

export async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
  catch { return false; }
}
