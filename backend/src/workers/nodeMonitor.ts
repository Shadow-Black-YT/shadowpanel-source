import { query, queryOne } from '../database';
import { AgentClient } from '../utils/agentClient';
import { logger } from '../utils/logger';

export class NodeMonitor {
  private static timer: NodeJS.Timeout | null = null;

  static start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 30000);
    this.tick();
    logger.info('[NodeMonitor] Started — polling every 30s');
  }

  static stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  static async tick(): Promise<void> {
    try {
      const nodes = await query<any[]>(`SELECT id,agent_url,agent_secret,status FROM nodes WHERE status!='maintenance'`);
      await Promise.allSettled(nodes.map(n => this.pollNode(n)));
    } catch (e) { logger.error('[NodeMonitor] tick error:', e); }
  }

  static async pollNode(node: any): Promise<void> {
    const agent = new AgentClient(node.agent_url, node.agent_secret);
    try {
      const info = await agent.getNodeInfo();
      await query(
        `UPDATE nodes SET status='online',cpu_usage=$1,ram_usage=$2,disk_usage=$3,load_avg=$4,
         total_ram=$5,total_cpu=$6,total_disk=$7,last_ping=NOW(),updated_at=NOW() WHERE id=$8`,
        [info.cpuUsage, info.ramUsed, info.diskUsed, info.loadAvg,
         info.totalRam, info.totalCpu, info.totalDisk, node.id]
      );
      // Poll running servers
      const servers = await query<{id: string, container_id: string}>(
        `SELECT id,container_id FROM servers WHERE node_id=$1 AND status='running' AND container_id IS NOT NULL`,
        [node.id]
      );
      await Promise.allSettled(servers.map(s => this.pollStats(agent, s.id, s.container_id)));
    } catch {
      if (node.status === 'online') {
        await query(`UPDATE nodes SET status='offline',updated_at=NOW() WHERE id=$1`, [node.id]);
        logger.warn('[NodeMonitor] Node offline: ' + node.id);
      }
    }
  }

  static async pollStats(agent: AgentClient, serverId: string, containerId: string): Promise<void> {
    try {
      const stats = await agent.getStats(containerId);
      await query(
        `INSERT INTO server_stats(server_id,cpu_usage,ram_usage,disk_usage,net_rx,net_tx) VALUES($1,$2,$3,$4,$5,$6)`,
        [serverId, stats.cpu, stats.ram, stats.disk, stats.netRx, stats.netTx]
      );
      await query(
        `UPDATE servers SET cpu_usage=$1,ram_usage=$2,disk_usage=$3,net_rx=$4,net_tx=$5 WHERE id=$6`,
        [stats.cpu, stats.ram, stats.disk, stats.netRx, stats.netTx, serverId]
      );
    } catch {}
  }
}
