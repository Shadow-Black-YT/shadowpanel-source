import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { AgentClient } from '../utils/agentClient';
import { queryOne } from '../database';
import * as pty from 'node-pty';

let io: SocketServer;
export const getIO = () => io;

const ptySessions = new Map<string, ReturnType<typeof pty.spawn>>();

export function initWebSocket(server: HTTPServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: '*', credentials: true },
    path: '/ws',
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).user = { userId: p.sub, role: p.role, username: p.username };
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.debug('WS connected: ' + user?.userId);

    const statsIntervals = new Map<string, NodeJS.Timeout>();

    // ── Stats subscription ────────────────────────────────────
    socket.on('stats:subscribe', async ({ serverId }: { serverId: string }) => {
      if (statsIntervals.has(serverId)) return;
      const t = setInterval(async () => {
        try {
          const srv = await queryOne<any>(
            `SELECT s.container_id, n.agent_url, n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1 AND s.status='running'`,
            [serverId]
          );
          if (!srv?.container_id) return;
          const agent = new AgentClient(srv.agent_url, srv.agent_secret);
          const stats = await agent.getStats(srv.container_id);
          socket.emit('stats:update', { serverId, ...stats, timestamp: Date.now() });
        } catch {}
      }, 2000);
      statsIntervals.set(serverId, t);
    });

    socket.on('stats:unsubscribe', ({ serverId }: { serverId: string }) => {
      const t = statsIntervals.get(serverId);
      if (t) { clearInterval(t); statsIntervals.delete(serverId); }
    });

    // ── Console log streaming ─────────────────────────────────
    socket.on('console:subscribe', async ({ serverId }: { serverId: string }) => {
      const srv = await queryOne<any>(
        `SELECT s.container_id, s.user_id, n.agent_url, n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`,
        [serverId]
      );
      if (!srv?.container_id) return;
      const hasAccess = srv.user_id === user.userId || ['admin','superadmin'].includes(user.role);
      if (!hasAccess) return;

      socket.join('console:' + serverId);
      const agent = new AgentClient(srv.agent_url, srv.agent_secret);
      try {
        const stream = await agent.streamLogs(srv.container_id);
        stream.on('data', (chunk: Buffer) => {
          const line = chunk.slice(8).toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
          if (line.trim()) socket.emit('console:line', { serverId, line, timestamp: Date.now() });
        });
        socket.on('disconnect', () => stream.destroy());
        socket.on('console:unsubscribe', () => { stream.destroy(); socket.leave('console:' + serverId); });
      } catch {}
    });

    // ── Console input ─────────────────────────────────────────
    socket.on('console:input', async ({ serverId, command }: { serverId: string; command: string }) => {
      const srv = await queryOne<any>(
        `SELECT s.container_id, s.user_id, n.agent_url, n.agent_secret FROM servers s JOIN nodes n ON n.id=s.node_id WHERE s.id=$1`,
        [serverId]
      );
      if (!srv?.container_id) return;
      const hasAccess = srv.user_id === user.userId || ['admin','superadmin'].includes(user.role);
      if (!hasAccess) return;
      const agent = new AgentClient(srv.agent_url, srv.agent_secret);
      const output = await agent.execCommand(srv.container_id, command).catch(() => '');
      socket.emit('console:output', { serverId, output, timestamp: Date.now() });
    });

    // ── Host PTY terminal (admin only) ────────────────────────
    socket.on('terminal:create', (opts: { cols: number; rows: number }) => {
      if (!['admin','superadmin'].includes(user?.role)) {
        socket.emit('terminal:error', 'Permission denied');
        return;
      }
      const sessionId = 'pty_' + user.userId + '_' + Date.now();
      const term = pty.spawn(process.env.SHELL || '/bin/bash', [], {
        name: 'xterm-256color',
        cols: opts.cols || 80,
        rows: opts.rows || 24,
        cwd: '/',
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          PS1: '\\[\\x1b[01;32m\\]shadowPanel\\[\\x1b[00m\\]:\\[\\x1b[01;34m\\]\\w\\[\\x1b[00m\\]\\$ ',
        } as NodeJS.ProcessEnv,
      });
      ptySessions.set(sessionId, term);
      term.onData(d => socket.emit('terminal:data', { sessionId, data: d }));
      term.onExit(({ exitCode }) => { socket.emit('terminal:exit', { sessionId, exitCode }); ptySessions.delete(sessionId); });
      socket.emit('terminal:ready', { sessionId });
    });

    socket.on('terminal:input', ({ sessionId, data }: { sessionId: string; data: string }) => {
      const term = ptySessions.get(sessionId);
      if (term) try { term.write(data); } catch {}
    });

    socket.on('terminal:resize', ({ sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
      const term = ptySessions.get(sessionId);
      if (term) try { term.resize(cols, rows); } catch {}
    });

    socket.on('terminal:close', ({ sessionId }: { sessionId: string }) => {
      const term = ptySessions.get(sessionId);
      if (term) { try { term.kill(); } catch {} ptySessions.delete(sessionId); }
    });

    socket.on('disconnect', () => {
      statsIntervals.forEach(t => clearInterval(t));
      statsIntervals.clear();
      for (const [id, term] of ptySessions.entries()) {
        if (id.includes(user?.userId || '')) { try { term.kill(); } catch {} ptySessions.delete(id); }
      }
    });
  });

  logger.info('WebSocket ready on /ws');
  return io;
}
