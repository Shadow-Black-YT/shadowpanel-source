import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { serversApi, nodesApi, activityApi } from '../api'
import { useAuthStore } from '../store/auth'
import {
  Server, Cpu, MemoryStick, HardDrive, Activity, Plus, ChevronRight,
  Zap, Globe, ArrowUp, ArrowDown, RefreshCw, Circle,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { statusBadge, statusColor, pctColor, formatMB, timeAgo } from '../lib/utils'
import { useState } from 'react'

// ── Animated counter ───────────────────────────────────────────
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {value}{suffix}
    </motion.span>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, delay = 0
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: any; color: string; delay?: number;
}) {
  return (
    <motion.div
      className="glass-hover stat-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 320, damping: 26 }}
    >
      <div style={{ position: 'absolute', top: -30, right: -30, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.15, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {sub && (
          <motion.span
            style={{ fontSize: 11, color: sub.startsWith('+') ? 'var(--neon-green)' : sub.startsWith('-') ? 'var(--neon-red)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Geist Mono, monospace' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
          >
            {sub.startsWith('+') ? <ArrowUp size={10} /> : sub.startsWith('-') ? <ArrowDown size={10} /> : null}
            {sub}
          </motion.span>
        )}
      </div>
      <div>
        <motion.p
          style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.1 }}
        >
          {value}
        </motion.p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Syne, sans-serif' }}>
          {label}
        </p>
      </div>
    </motion.div>
  )
}

// ── Progress ring ──────────────────────────────────────────────
function ProgressRing({ pct, size = 60, stroke = 5, label }: { pct: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pctColor(pct)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size/2} cy={size/2} r={r} strokeWidth={stroke} />
        <motion.circle
          className="ring-fill"
          cx={size/2} cy={size/2} r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          style={{ boxShadow: `0 0 8px ${color}` }}
        />
      </svg>
      {label && (
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>{pct}%</p>
          {label && <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>}
        </div>
      )}
    </div>
  )
}

// ── Custom chart tooltip ───────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass" style={{ padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'Geist Mono, monospace' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke, fontFamily: 'Geist Mono, monospace' }}>
          {p.dataKey === 'ram' ? formatMB(p.value) : p.value + '%'}
        </p>
      ))}
    </div>
  )
}

// ── Mock chart data (will be replaced with real data) ──────────
const mockChartData = Array.from({ length: 12 }, (_, i) => ({
  time: `${i}:00`,
  cpu: Math.round(10 + Math.random() * 50),
  ram: Math.round(300 + Math.random() * 400),
}))

// ── Dashboard Page ─────────────────────────────────────────────
export function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'superadmin'].includes(user?.role || '')

  const { data: servers = { rows: [], total: 0 }, isLoading: srvLoading } = useQuery({
    queryKey: ['servers', 'dashboard'],
    queryFn: () => serversApi.list({ limit: 6 }),
    staleTime: 15000,
  })

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: nodesApi.list,
    enabled: isAdmin,
  })

  const { data: activity = { rows: [] } } = useQuery({
    queryKey: ['activity', 'dashboard'],
    queryFn: () => activityApi.list({ limit: 8 }),
    staleTime: 30000,
  })

  const totalServers  = servers.total || 0
  const runningCount  = servers.rows.filter((s: any) => s.status === 'running').length
  const stoppedCount  = servers.rows.filter((s: any) => s.status === 'stopped').length
  const errorCount    = servers.rows.filter((s: any) => s.status === 'error').length
  const onlineNodes   = (nodes as any[]).filter((n: any) => n.status === 'online').length

  return (
    <div className="page-enter">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <motion.h1
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 26, color: 'var(--text-primary)', lineHeight: 1.2 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            Mission Control{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--cyan), var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Dashboard
            </span>
          </motion.h1>
          <motion.p
            style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Welcome back, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.username}</span> · Powered by shadowblack
          </motion.p>
        </div>
        <motion.div
          style={{ display: 'flex', gap: 8 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Link to="/servers" className="btn btn-secondary btn-sm">
            <Server size={13} /> Servers
          </Link>
          <Link to="/servers/create" className="btn btn-primary btn-sm">
            <Plus size={13} /> New Server
          </Link>
        </motion.div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Servers"  value={<Counter value={totalServers} />} sub={'+2 this week'} icon={Server}      color="var(--cyan)"       delay={0} />
        <StatCard label="Running"        value={<Counter value={runningCount} />} sub={undefined}      icon={Zap}         color="var(--neon-green)" delay={0.06} />
        <StatCard label="Stopped"        value={<Counter value={stoppedCount} />} sub={undefined}     icon={Circle}      color="var(--text-muted)" delay={0.12} />
        <StatCard label="Errors"         value={<Counter value={errorCount} />}   sub={undefined}     icon={Activity}    color="var(--neon-red)"   delay={0.18} />
        {isAdmin && <StatCard label="Online Nodes" value={<Counter value={onlineNodes} />} sub={undefined} icon={Globe} color="#a855f7" delay={0.24} />}
      </div>

      {/* ── Main grid ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>

        {/* Resource chart */}
        <motion.div
          className="glass"
          style={{ padding: 20 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                Resource Usage
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Last 12 hours</p>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--cyan)' }}>
                <span style={{ width: 20, height: 2, background: 'var(--cyan)', borderRadius: 1, display: 'inline-block' }} /> CPU
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#a855f7' }}>
                <span style={{ width: 20, height: 2, background: '#a855f7', borderRadius: 1, display: 'inline-block' }} /> RAM
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockChartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--cyan)"  stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--cyan)"  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gram" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: 'Geist Mono, monospace' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10, fontFamily: 'Geist Mono, monospace' }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="cpu" stroke="var(--cyan)"  strokeWidth={1.5} fill="url(#gcpu)" />
              <Area type="monotone" dataKey="ram" stroke="#a855f7"      strokeWidth={1.5} fill="url(#gram)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Resource rings */}
        <motion.div
          className="glass"
          style={{ padding: 20 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 20 }}>
            Allocations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'RAM',  pct: 45, icon: MemoryStick, color: 'var(--cyan)',        used: '460 MB',  total: formatMB(user?.ram_limit  || 1024) },
              { label: 'CPU',  pct: 28, icon: Cpu,         color: '#a855f7',            used: '28 cores', total: (user?.cpu_limit||100) + '%' },
              { label: 'Disk', pct: 62, icon: HardDrive,   color: 'var(--neon-amber)', used: '3.1 GB',  total: formatMB(user?.disk_limit || 5120) },
            ].map(({ label, pct, icon: Icon, color, used, total }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ProgressRing pct={pct} size={58} stroke={5} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Icon size={12} style={{ color }} />
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
                    {used} / {total}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Node Health
              </p>
              {(nodes as any[]).slice(0, 3).map((n: any, i: number) => (
                <motion.div
                  key={n.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                >
                  <span className={`status-dot ${n.status}`} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{n.cpu_usage || 0}%</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Recent servers ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Recent Servers</h3>
            <Link to="/servers" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div>
            {srvLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="skeleton" style={{ flex: 1, height: 14 }} />
                  <div className="skeleton" style={{ width: 50, height: 14 }} />
                </div>
              ))
            ) : servers.rows.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <Server size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No servers yet</p>
                <Link to="/servers/create" className="btn btn-primary btn-sm" style={{ marginTop: 12, display: 'inline-flex' }}>
                  <Plus size={13} /> Create Server
                </Link>
              </div>
            ) : servers.rows.map((srv: any, i: number) => (
              <motion.div
                key={srv.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
              >
                <Link
                  to={`/servers/${srv.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', textDecoration: 'none', borderBottom: '1px solid rgba(0,212,255,0.04)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className={`status-dot ${srv.status}`} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {srv.name}
                  </span>
                  <span className={`badge ${statusBadge(srv.status)}`}>{srv.status}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
                    {srv.ram_usage || 0} MB
                  </span>
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Activity</h3>
            <Link to="/activity" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div>
            {(activity.rows || []).slice(0, 8).map((a: any, i: number) => (
              <motion.div
                key={a.id}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 18px', borderBottom: '1px solid rgba(0,212,255,0.04)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.04 }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,212,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Activity size={12} style={{ color: 'var(--cyan)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.username || 'system'}</span>{' '}
                    {a.action} {a.resource}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'Geist Mono, monospace' }}>
                    {timeAgo(a.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
            {(activity.rows || []).length === 0 && (
              <p style={{ textAlign: 'center', padding: '32px', fontSize: 13, color: 'var(--text-muted)' }}>No recent activity</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
