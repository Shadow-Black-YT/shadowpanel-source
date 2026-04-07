import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { serversApi } from '../api'
import { useServerStats, useConsole } from '../hooks/useSocket'
import toast from 'react-hot-toast'
import {
  Server, Play, Square, RotateCcw, Zap, Terminal, FolderOpen,
  Archive, ArrowLeft, Settings, Cpu, MemoryStick, HardDrive,
  Network, GitBranch, Clock, User, Monitor,
} from 'lucide-react'
import { statusBadge, statusColor, pctColor, formatMB, formatBytes, timeAgo } from '../lib/utils'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useRef, useEffect } from 'react'

function MiniStat({ label, value, pct, color }: { label: string; value: string; pct?: number; color?: string }) {
  return (
    <div className="glass" style={{ padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Syne,sans-serif', marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 20, color: color || 'var(--text-primary)' }}>{value}</p>
      {pct !== undefined && (
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 8, overflow: 'hidden' }}>
          <motion.div style={{ height: '100%', background: pctColor(pct), borderRadius: 2 }} initial={{ width: 0 }} animate={{ width: pct + '%' }} transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }} />
        </div>
      )}
    </div>
  )
}

function ConsolePanel({ serverId }: { serverId: string }) {
  const [lines, setLines] = useState<string[]>([])
  const [cmd, setCmd] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { sendCommand } = useConsole(serverId, line => setLines(prev => [...prev.slice(-300), line]))

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const send = () => {
    if (!cmd.trim()) return
    sendCommand(cmd)
    setLines(prev => [...prev, '> ' + cmd])
    setCmd('')
  }

  return (
    <div className="terminal-wrap">
      <div className="terminal-bar">
        <div className="terminal-dot" style={{ background: '#ff5f57' }} />
        <div className="terminal-dot" style={{ background: '#febc2e' }} />
        <div className="terminal-dot" style={{ background: '#28c840' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono,monospace' }}>console · {serverId.slice(0, 8)}</span>
      </div>
      <div style={{ height: 280, overflowY: 'auto', padding: '10px 14px', fontFamily: 'Geist Mono,monospace', fontSize: 12, lineHeight: 1.6 }}>
        {lines.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Waiting for output… <span style={{ color: 'var(--cyan)' }}>■</span></p>
        ) : lines.map((l, i) => (
          <p key={i} style={{ color: l.startsWith('>') ? 'var(--cyan)' : 'var(--text-secondary)', margin: 0 }}>{l}</p>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid rgba(0,212,255,0.1)' }}>
        <span style={{ padding: '8px 12px', color: 'var(--cyan)', fontFamily: 'Geist Mono,monospace', fontSize: 13, flexShrink: 0 }}>$</span>
        <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'Geist Mono,monospace', fontSize: 12, padding: '8px 8px 8px 0' }}
          placeholder="Enter command…" />
        <button onClick={send} className="btn btn-primary btn-sm" style={{ margin: 4, borderRadius: 8 }}>Send</button>
      </div>
    </div>
  )
}

export function ServerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [liveStats, setLiveStats] = useState<any>(null)

  useServerStats(id || null, stats => setLiveStats(stats))

  const { data: srv, isLoading } = useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.get(id!),
    refetchInterval: 30000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['server-stats', id],
    queryFn: () => serversApi.stats(id!, '1h'),
    refetchInterval: 60000,
    enabled: !!id,
  })

  const powerMut = useMutation({
    mutationFn: (action: string) => serversApi.power(id!, action),
    onSuccess: (_, action) => { toast.success(action + ' sent'); qc.invalidateQueries({ queryKey: ['server', id] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Action failed'),
  })

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[80, 160, 300].map(h => <div key={h} className="skeleton" style={{ height: h, borderRadius: 12 }} />)}
    </div>
  )
  if (!srv) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Server not found</div>

  const cpu  = liveStats?.cpu  ?? srv.cpu_usage  ?? 0
  const ram  = liveStats?.ram  ?? srv.ram_usage  ?? 0
  const disk = liveStats?.disk ?? srv.disk_usage ?? 0

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/servers')} className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></button>
        <div style={{ flex: 1 }}>
          <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 22, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <span className={'status-dot ' + srv.status} />
            {srv.name}
            <span className={'badge ' + statusBadge(srv.status)}>{srv.status}</span>
          </motion.h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Geist Mono,monospace' }}>
            {srv.docker_image} · {srv.node_name || 'no node'} {srv.external_port ? '· :' + srv.external_port : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {srv.status === 'running'
            ? <button className="btn btn-warning btn-sm" onClick={() => powerMut.mutate('stop')}><Square size={13} /> Stop</button>
            : <button className="btn btn-success btn-sm" onClick={() => powerMut.mutate('start')}><Play size={13} /> Start</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => powerMut.mutate('restart')}><RotateCcw size={13} /> Restart</button>
          <Link to={'/servers/' + id + '/terminal'} className="btn btn-secondary btn-sm"><Terminal size={13} /> Terminal</Link>
          <Link to={'/servers/' + id + '/files'} className="btn btn-secondary btn-sm"><FolderOpen size={13} /> Files</Link>
          <Link to={'/servers/' + id + '/backups'} className="btn btn-secondary btn-sm"><Archive size={13} /> Backups</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <MiniStat label="CPU" value={cpu.toFixed(1) + '%'} pct={parseFloat(cpu)} color={pctColor(parseFloat(cpu))} />
        <MiniStat label="RAM" value={formatMB(ram)} pct={Math.round(ram / srv.ram_limit * 100)} />
        <MiniStat label="Disk" value={formatMB(disk)} pct={Math.round(disk / srv.disk_limit * 100)} />
        <MiniStat label="Network RX" value={formatBytes(liveStats?.netRx ?? srv.net_rx ?? 0)} />
        <MiniStat label="Network TX" value={formatBytes(liveStats?.netTx ?? srv.net_tx ?? 0)} />
      </div>

      {/* Chart + Console */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="glass" style={{ padding: '16px 18px' }}>
          <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text-primary)' }}>Resource History (1h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={statsData?.stats || []} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="scpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sram" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 9, fontFamily: 'Geist Mono,monospace' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 9, fontFamily: 'Geist Mono,monospace' }} />
              <Tooltip contentStyle={{ background: 'rgba(10,10,24,0.97)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" stroke="var(--cyan)" strokeWidth={1.5} fill="url(#scpu)" />
              <Area type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={1.5} fill="url(#sram)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <ConsolePanel serverId={id!} />
        </div>
      </div>

      {/* Server info */}
      <div className="glass" style={{ padding: '16px 18px' }}>
        <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--text-primary)' }}>Server Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {[
            ['ID',       srv.id?.slice(0,16) + '…'],
            ['Node',     srv.node_name],
            ['Owner',    srv.username],
            ['RAM Limit', formatMB(srv.ram_limit)],
            ['CPU Limit', srv.cpu_limit + '%'],
            ['Disk Limit', formatMB(srv.disk_limit)],
            ['Port',     srv.external_port ? ':' + srv.external_port : 'none'],
            ['Created',  timeAgo(srv.created_at)],
            srv.git_repo ? ['Git Repo', srv.git_repo] : null,
          ].filter(Boolean).map(([k, v]: any) => (
            <div key={k} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,212,255,0.05)' }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Syne,sans-serif', marginBottom: 3 }}>{k}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Geist Mono,monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
