import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { domainsApi, serversApi } from '../api'
import toast from 'react-hot-toast'
import {
  Globe, Plus, Search, Trash2, Server, ExternalLink,
  RefreshCw, Loader2, ChevronRight, Link as LinkIcon,
  Filter, X
} from 'lucide-react'
import { timeAgo } from '../lib/utils'

export function DomainsPage() {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newDomain, setNewDomain] = useState({ domain: '', serverId: '', targetPort: 80 })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: domains = [], isLoading, refetch } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainsApi.list(),
    refetchInterval: 10000,
  })

  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list().then(r => r.rows),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => domainsApi.create(data),
    onSuccess: () => {
      toast.success('Domain added')
      qc.invalidateQueries({ queryKey: ['domains'] })
      setShowCreate(false)
      setNewDomain({ domain: '', serverId: '', targetPort: 80 })
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add domain'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => domainsApi.delete(id),
    onSuccess: () => {
      toast.success('Domain removed')
      qc.invalidateQueries({ queryKey: ['domains'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete domain'),
    onSettled: () => setDeletingId(null),
  })

  const filtered = domains.filter((d: any) =>
    d.domain.toLowerCase().includes(search.toLowerCase()) ||
    (d.server_name && d.server_name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.domain) {
      toast.error('Domain is required')
      return
    }
    createMut.mutate(newDomain)
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 24, color: 'var(--text-primary)' }} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            Domains
          </motion.h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {filtered.length} domain{filtered.length !== 1 ? 's' : ''} · Powered by shadowblack
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} className="btn btn-secondary btn-sm"><RefreshCw size={13} /></button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm"><Plus size={14} /> Add Domain</button>
        </div>
      </div>

      {/* Search */}
      <motion.div style={{ marginBottom: 18 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div style={{ position: 'relative', maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search domains…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </motion.div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)}>
            <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Add Domain</h3>
                <button onClick={() => setShowCreate(false)} className="btn btn-icon"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label className="label">Domain</label>
                    <input className="input" placeholder="example.com" value={newDomain.domain} onChange={e => setNewDomain({ ...newDomain, domain: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Server (optional)</label>
                    <select className="input" value={newDomain.serverId} onChange={e => setNewDomain({ ...newDomain, serverId: e.target.value })}>
                      <option value="">— No server —</option>
                      {servers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Target Port</label>
                    <input className="input" type="number" min="1" max="65535" value={newDomain.targetPort} onChange={e => setNewDomain({ ...newDomain, targetPort: parseInt(e.target.value) || 80 })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
                    {createMut.isPending ? <Loader2 size={14} className="spin" /> : 'Add Domain'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domains list */}
      {isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div className="glass" style={{ padding: 48, textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Globe size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>No domains yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Add a domain to point to your server.</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus size={14} /> Add Domain</button>
        </motion.div>
      ) : (
        <AnimatePresence>
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((dom: any, i: number) => (
              <motion.div key={dom.id} className="glass-hover" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                    <a href={`${dom.ssl_enabled ? 'https' : 'http'}://${dom.domain}`} target="_blank" rel="noopener" className="link" style={{ fontSize: 15, fontWeight: 600 }}>
                      {dom.domain}
                      <ExternalLink size={11} style={{ marginLeft: 4 }} />
                    </a>
                    {dom.ssl_enabled && (
                      <span style={{ fontSize: 10, background: 'var(--green)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>SSL</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    {dom.server_name ? (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Server size={11} /> {dom.server_name}
                        </span>
                        <span>·</span>
                      </>
                    ) : null}
                    <span>Port {dom.target_port || 80}</span>
                    <span>·</span>
                    <span>Added {timeAgo(dom.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete domain ${dom.domain}?`)) {
                      setDeletingId(dom.id)
                      deleteMut.mutate(dom.id)
                    }
                  }}
                  className="btn btn-danger btn-sm"
                  disabled={deleteMut.isPending && deletingId === dom.id}
                >
                  {deleteMut.isPending && deletingId === dom.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                </button>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
