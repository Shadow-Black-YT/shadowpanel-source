import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { serversApi } from '../api'
import toast from 'react-hot-toast'
import {
  Server, Plus, Search, Play, Square, RotateCcw, Trash2,
  Terminal, FolderOpen, Archive, ChevronRight, Loader2,
  Filter, RefreshCw, Cpu, MemoryStick,
} from 'lucide-react'
import { statusBadge, statusColor, formatMB, timeAgo } from '../lib/utils'

const STATUS_OPTS = ['all', 'running', 'stopped', 'installing', 'error']

export function ServersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [deleting, setDeleting] = useState<string|null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data = { rows: [], total: 0 }, isLoading, refetch } = useQuery({
    queryKey: ['servers', search, status],
    queryFn: () => serversApi.list({ search: search || undefined, status: status === 'all' ? undefined : status }),
    refetchInterval: 15000,
  })

  const powerMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => serversApi.power(id, action),
    onSuccess: (_, v) => { toast.success(v.action + ' sent'); qc.invalidateQueries({ queryKey: ['servers'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Action failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => serversApi.delete(id),
    onSuccess: () => { toast.success('Server deleted'); qc.invalidateQueries({ queryKey: ['servers'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
  })

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete server "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    await deleteMut.mutateAsync(id).finally(() => setDeleting(null))
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 24, color: 'var(--text-primary)' }} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            Servers
          </motion.h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {data.total} server{data.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm"><RefreshCw size={13} /></button>
          <Link to="/servers/create" className="btn btn-primary btn-sm"><Plus size={14} /> New Server</Link>
        </div>
      </div>

      {/* Filters */}
      <motion.div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search servers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUS_OPTS.map(s => (
            <motion.button key={s} onClick={() => setStatus(s)} className={s === status ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              {s}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Server list */}
      {isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />)}
        </div>
      ) : data.rows.length === 0 ? (
        <motion.div className="glass" style={{ padding: 48, textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Server size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>No servers found</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Create your first server to get started.</p>
          <Link to="/servers/create" className="btn btn-primary"><Plus size={14} /> Create Server</Link>
        </motion.div>
      ) : (
        <AnimatePresence>
          <div style={{ display: 'grid', gap: 10 }}>
            {data.rows.map((srv: any, i: number) => (
              <motion.div key={srv.id} className="glass-hover" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => navigate('/servers/' + srv.id)}
              >
                <span className={'status-dot ' + srv.status} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srv.name}</p>
                    <span className={'badge ' + statusBadge(srv.status)}>{srv.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono,monospace', flexWrap: 'wrap' }}>
                    <span>{srv.docker_image?.split('/').pop()?.split(':')[0]}</span>
                    {srv.external_port && <span>:{srv.external_port}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MemoryStick size={10} />{srv.ram_usage || 0}/{srv.ram_limit} MB</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Cpu size={10} />{srv.cpu_usage || 0}%</span>
                    {srv.node_name && <span>{srv.node_name}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {srv.status === 'running' ? (
                    <motion.button className="btn btn-warning btn-icon btn-sm" onClick={() => powerMut.mutate({ id: srv.id, action: 'stop' })} data-tip="Stop" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}>
                      <Square size={13} />
                    </motion.button>
                  ) : (
                    <motion.button className="btn btn-success btn-icon btn-sm" onClick={() => powerMut.mutate({ id: srv.id, action: 'start' })} data-tip="Start" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}>
                      <Play size={13} />
                    </motion.button>
                  )}
                  <motion.button className="btn btn-secondary btn-icon btn-sm" onClick={() => powerMut.mutate({ id: srv.id, action: 'restart' })} data-tip="Restart" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}>
                    <RotateCcw size={13} />
                  </motion.button>
                  <Link to={'/servers/' + srv.id + '/terminal'} className="btn btn-secondary btn-icon btn-sm" onClick={e => e.stopPropagation()} data-tip="Terminal">
                    <Terminal size={13} />
                  </Link>
                  <Link to={'/servers/' + srv.id + '/files'} className="btn btn-secondary btn-icon btn-sm" onClick={e => e.stopPropagation()} data-tip="Files">
                    <FolderOpen size={13} />
                  </Link>
                  <motion.button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(srv.id, srv.name)} disabled={deleting === srv.id} data-tip="Delete" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}>
                    {deleting === srv.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                  </motion.button>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
