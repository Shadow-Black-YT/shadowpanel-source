import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { serversApi, nodesApi } from '../api'
import toast from 'react-hot-toast'
import { Server, Gamepad2, Globe, Bot, Database, Package, ChevronRight, Loader2, Plus, ArrowLeft } from 'lucide-react'

const CAT_ICONS: Record<string, any> = { game: Gamepad2, webapp: Globe, web: Globe, bot: Bot, database: Database, custom: Package }
const CAT_COLORS: Record<string, string> = { game: 'var(--cyan)', webapp: '#a855f7', web: 'var(--neon-blue)', bot: 'var(--neon-amber)', database: 'var(--neon-green)', custom: 'var(--text-muted)' }

export function CreateServerPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState<any>(null)
  const [form, setForm] = useState({ name: '', nodeId: '', ramLimit: '512', cpuLimit: '100', diskLimit: '2048', gitRepo: '', gitBranch: 'main', gitAutoDeploy: false, autoBackup: false })

  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: serversApi.templates })
  const { data: nodes = [] } = useQuery({ queryKey: ['nodes'], queryFn: nodesApi.list })

  const createMut = useMutation({
    mutationFn: () => serversApi.create({
      name: form.name, nodeId: form.nodeId || undefined,
      templateId: template?.id,
      ramLimit: parseInt(form.ramLimit), cpuLimit: parseInt(form.cpuLimit), diskLimit: parseInt(form.diskLimit),
      gitRepo: form.gitRepo || undefined, gitBranch: form.gitBranch,
      gitAutoDeploy: form.gitAutoDeploy, autoBackup: form.autoBackup,
    }),
    onSuccess: (srv: any) => { toast.success('Server created!'); navigate('/servers/' + srv.id) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Create failed'),
  })

  const cats = [...new Set((templates as any[]).map((t: any) => t.category))]

  return (
    <div className="page-enter" style={{ maxWidth: 720, margin: '0 auto' }}>
      <motion.button onClick={() => navigate('/servers')} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ArrowLeft size={14} /> Back to servers
      </motion.button>

      <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Create Server
      </motion.h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Powered by shadowblack</p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= s ? (step > s ? 'var(--cyan)' : 'var(--cyan)') : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />
        ))}
      </div>

      {/* Step 1: Template */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>Choose a template</h2>
          {cats.map(cat => {
            const Icon = CAT_ICONS[cat] || Package
            const color = CAT_COLORS[cat] || 'var(--cyan)'
            const catTemplates = (templates as any[]).filter((t: any) => t.category === cat)
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Icon size={13} style={{ color }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'Syne,sans-serif' }}>{cat}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                  {catTemplates.map((t: any) => (
                    <motion.button key={t.id} onClick={() => { setTemplate(t); setStep(2) }}
                      className="glass-hover"
                      style={{ padding: '14px', textAlign: 'left', background: 'none', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s' }}
                      whileHover={{ borderColor: color + 'aa', boxShadow: '0 0 20px ' + color + '22' }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span style={{ fontSize: 22 }}>{t.icon}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{t.description?.slice(0, 60)}{t.description?.length > 60 ? '…' : ''}</p>
                      </div>
                      {t.is_featured && <span className="badge badge-cyan" style={{ alignSelf: 'flex-start', fontSize: 9 }}>FEATURED</span>}
                    </motion.button>
                  ))}
                </div>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && template && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{template.icon}</span>
            <div>
              <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Configure: {template.name}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{template.description}</p>
            </div>
          </div>
          <div className="glass" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Server Name *</label>
              <input className="input" placeholder="My Awesome Server" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="label">Node (auto-assign if empty)</label>
              <select className="input" value={form.nodeId} onChange={e => setForm(f => ({ ...f, nodeId: e.target.value }))}>
                <option value="">Auto-assign best node</option>
                {(nodes as any[]).filter((n: any) => n.status === 'online').map((n: any) => (
                  <option key={n.id} value={n.id}>{n.name} ({n.location || 'unknown'}) — {Math.round((n.total_ram - n.allocated_ram))} MB free</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">RAM (MB)</label>
                <input type="number" className="input" min="128" step="128" value={form.ramLimit} onChange={e => setForm(f => ({ ...f, ramLimit: e.target.value }))} />
              </div>
              <div>
                <label className="label">CPU (%)</label>
                <input type="number" className="input" min="25" max="400" step="25" value={form.cpuLimit} onChange={e => setForm(f => ({ ...f, cpuLimit: e.target.value }))} />
              </div>
              <div>
                <label className="label">Disk (MB)</label>
                <input type="number" className="input" min="512" step="512" value={form.diskLimit} onChange={e => setForm(f => ({ ...f, diskLimit: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Git Repository (optional)</label>
              <input className="input" placeholder="https://github.com/user/repo" value={form.gitRepo} onChange={e => setForm(f => ({ ...f, gitRepo: e.target.value }))} />
            </div>
            {form.gitRepo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <label className="label">Branch</label>
                  <input className="input" value={form.gitBranch} onChange={e => setForm(f => ({ ...f, gitBranch: e.target.value }))} />
                </div>
                <div style={{ paddingTop: 20, display: 'flex', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.gitAutoDeploy} onChange={e => setForm(f => ({ ...f, gitAutoDeploy: e.target.checked }))} /> Auto-deploy
                  </label>
                </div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.autoBackup} onChange={e => setForm(f => ({ ...f, autoBackup: e.target.checked }))} />
              Enable automatic daily backups
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStep(1)} className="btn btn-secondary">← Back</button>
            <button onClick={() => setStep(3)} disabled={!form.name} className="btn btn-primary" style={{ flex: 1 }}>
              Review & Deploy →
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>Review Configuration</h2>
          <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
            {[
              ['Server Name', form.name],
              ['Template', template?.name],
              ['Docker Image', template?.docker_image],
              ['RAM Limit', form.ramLimit + ' MB'],
              ['CPU Limit', form.cpuLimit + '%'],
              ['Disk Limit', form.diskLimit + ' MB'],
              form.gitRepo ? ['Git Repo', form.gitRepo] : null,
              ['Node', form.nodeId ? (nodes as any[]).find((n: any) => n.id === form.nodeId)?.name || form.nodeId : 'Auto-assign'],
            ].filter(Boolean).map(([k, v]: any, i: number) => (
              <motion.div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 7 ? '1px solid rgba(0,212,255,0.06)' : 'none' }}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Geist Mono,monospace', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </motion.div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} className="btn btn-secondary">← Edit</button>
            <motion.button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="btn btn-primary" style={{ flex: 1, padding: 12, fontSize: 14, fontFamily: 'Syne,sans-serif', fontWeight: 800 }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              {createMut.isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Deploying…</> : <><Plus size={15} /> Deploy Server</>}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
