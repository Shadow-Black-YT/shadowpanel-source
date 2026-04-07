import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { backupsApi, gdriveApi } from '../api'
import toast from 'react-hot-toast'
import {
  Archive, ArrowLeft, Plus, Trash2, Cloud, Download,
  RefreshCw, Calendar, HardDrive, ChevronRight, Loader2,
  CheckCircle, XCircle, Settings, FileArchive,
} from 'lucide-react'
import { formatBytes, timeAgo } from '../lib/utils'

const CRON_PRESETS = [
  { label: 'Every hour',    value: '0 * * * *' },
  { label: 'Every 6h',     value: '0 */6 * * *' },
  { label: 'Daily 3am',    value: '0 3 * * *' },
  { label: 'Daily midnight',value: '0 0 * * *' },
  { label: 'Weekly Sun',   value: '0 3 * * 0' },
  { label: 'Custom',       value: 'custom' },
]

function GDriveConnect() {
  const qc = useQueryClient()
  const { data: status } = useQuery({ queryKey: ['gdrive-status'], queryFn: gdriveApi.status, retry: false })
  const connectMut = useMutation({
    mutationFn: gdriveApi.connect,
    onSuccess: (d) => { window.location.href = d.authUrl },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Not configured'),
  })
  const disconnectMut = useMutation({
    mutationFn: gdriveApi.disconnect,
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({ queryKey: ['gdrive-status'] }) },
  })

  if (status?.connected) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 900 }}>G</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Google Drive Connected</p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{status.connection?.email}</p>
      </div>
      <button className="btn btn-danger btn-xs" onClick={() => disconnectMut.mutate()}>Disconnect</button>
    </div>
  )

  return (
    <motion.button className="btn btn-secondary" onClick={() => connectMut.mutate()} disabled={connectMut.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900 }}>G</div>
      {connectMut.isPending ? 'Redirecting…' : 'Connect Google Drive'}
      <ChevronRight size={12} />
    </motion.button>
  )
}

function SchedulePanel({ serverId }: { serverId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cronMode, setCronMode] = useState('0 3 * * *')
  const [customCron, setCustomCron] = useState('')
  const [dest, setDest] = useState('both')
  const [retain, setRetain] = useState(7)

  const { data: gStatus } = useQuery({ queryKey: ['gdrive-status'], queryFn: gdriveApi.status, retry: false })
  const { data: sched } = useQuery({ queryKey: ['backup-schedule', serverId], queryFn: () => gdriveApi.getSchedule(serverId), retry: false })

  const saveMut = useMutation({
    mutationFn: (d: any) => gdriveApi.setSchedule(serverId, d),
    onSuccess: () => { toast.success('Schedule saved!'); qc.invalidateQueries({ queryKey: ['backup-schedule', serverId] }); setOpen(false) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Save failed'),
  })
  const delMut = useMutation({
    mutationFn: () => gdriveApi.delSchedule(serverId),
    onSuccess: () => { toast.success('Schedule removed'); qc.invalidateQueries({ queryKey: ['backup-schedule', serverId] }) },
  })

  const finalCron = cronMode === 'custom' ? customCron : cronMode

  return (
    <div className="glass" style={{ padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sched || open ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--cyan)' }} />
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Auto-Backup Schedule</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {sched && <button className="btn btn-danger btn-xs" onClick={() => delMut.mutate()}>Remove</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen(v => !v)}><Settings size={12} /> {open ? 'Close' : 'Configure'}</button>
        </div>
      </div>

      {sched && !open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { k: 'Status',   v: sched.is_enabled ? '● Active' : '○ Paused', c: sched.is_enabled ? 'var(--neon-green)' : 'var(--text-muted)' },
            { k: 'Cron',     v: sched.cron_expr },
            { k: 'Dest',     v: sched.destination === 'both' ? '💾 + ☁' : sched.destination === 'gdrive' ? '☁ Drive' : '💾 Local' },
            { k: 'Retain',   v: sched.retain_count + ' copies' },
            { k: 'Last run', v: sched.last_run ? timeAgo(sched.last_run) : 'Never' },
          ].map(({ k, v, c }: any) => (
            <div key={k} style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Syne, sans-serif' }}>{k}</p>
              <p style={{ fontSize: 12, color: c || 'var(--text-primary)', fontFamily: 'Geist Mono, monospace', marginTop: 2 }}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {!sched && !open && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No automatic backups configured.</p>}

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Frequency</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CRON_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setCronMode(p.value)} className={cronMode === p.value ? 'btn btn-primary btn-xs' : 'btn btn-secondary btn-xs'}>{p.label}</button>
                  ))}
                </div>
                {cronMode === 'custom' && <input className="input" style={{ marginTop: 8 }} placeholder="cron expr e.g. 0 */4 * * *" value={customCron} onChange={e => setCustomCron(e.target.value)} />}
              </div>

              <div>
                <label className="label">Destination</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'local', l: '💾 Local' }, { v: 'gdrive', l: '☁ GDrive' }, { v: 'both', l: '💾 + ☁ Both' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setDest(v)} className={dest === v ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} disabled={v !== 'local' && !gStatus?.connected}>{l}</button>
                  ))}
                </div>
                {dest !== 'local' && !gStatus?.connected && <p style={{ fontSize: 11, color: 'var(--neon-amber)', marginTop: 6 }}>⚠ Connect Google Drive first</p>}
              </div>

              <div>
                <label className="label">Retain last {retain} backups per destination</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="1" max="30" value={retain} onChange={e => setRetain(+e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 20, color: 'var(--cyan)', width: 36, textAlign: 'center' }}>{retain}</span>
                </div>
              </div>

              <motion.button className="btn btn-primary" onClick={() => saveMut.mutate({ isEnabled: true, cronExpr: finalCron, destination: dest, retainCount: retain })} disabled={saveMut.isPending} whileTap={{ scale: 0.97 }}>
                {saveMut.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><CheckCircle size={14} /> Save Schedule</>}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function BackupsPage() {
  const { id: serverId } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: gStatus } = useQuery({ queryKey: ['gdrive-status'], queryFn: gdriveApi.status, retry: false })
  const { data: backups = [], isLoading } = useQuery({ queryKey: ['backups', serverId], queryFn: () => backupsApi.list(serverId!), refetchInterval: 10000 })
  const { data: driveFiles } = useQuery({ queryKey: ['gdrive-files', serverId], queryFn: () => gdriveApi.serverFiles(serverId!), enabled: !!gStatus?.connected, retry: false })

  const createMut  = useMutation({ mutationFn: () => backupsApi.create(serverId!), onSuccess: () => { toast.success('Backup started!'); qc.invalidateQueries({ queryKey: ['backups', serverId] }) }, onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') })
  const gdriveMut  = useMutation({ mutationFn: () => gdriveApi.backupNow(serverId!), onSuccess: () => toast.success('Backup to Drive started!'), onError: (e: any) => toast.error(e.response?.data?.error || 'Failed') })
  const deleteMut  = useMutation({ mutationFn: (bid: string) => backupsApi.delete(serverId!, bid), onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['backups', serverId] }) } })
  const importMut  = useMutation({ mutationFn: ({ fileId, fileName }: { fileId: string; fileName: string }) => gdriveApi.importBackup(serverId!, fileId, fileName), onSuccess: () => toast.success('Import started — server will restart when done!'), onError: (e: any) => toast.error(e.response?.data?.error || 'Import failed') })

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to={`/servers/${serverId}`} className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <div style={{ flex: 1 }}>
          <motion.h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 22, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
            <Archive size={20} style={{ color: 'var(--cyan)' }} /> Backups & Recovery
          </motion.h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{(backups as any[]).length} local · {driveFiles?.files?.length || 0} on Drive</p>
        </div>
        <GDriveConnect />
        <div style={{ display: 'flex', gap: 8 }}>
          {gStatus?.connected && <motion.button className="btn btn-secondary btn-sm" onClick={() => gdriveMut.mutate()} disabled={gdriveMut.isPending} whileTap={{ scale: 0.97 }}><Cloud size={13} /> To Drive</motion.button>}
          <motion.button className="btn btn-primary btn-sm" onClick={() => createMut.mutate()} disabled={createMut.isPending} whileTap={{ scale: 0.97 }}>
            {createMut.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={13} /> Create Backup</>}
          </motion.button>
        </div>
      </div>

      <SchedulePanel serverId={serverId!} />

      {/* Google Drive backups */}
      {gStatus?.connected && (
        <motion.div className="glass" style={{ padding: '16px 18px', marginBottom: 14 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900 }}>G</div>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Drive Backups — Import</h3>
          </div>
          {(driveFiles?.files || []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No backups found in Google Drive for this server.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(driveFiles?.files || []).map((f: any) => (
                <motion.div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(66,133,244,0.2)' }}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                  <FileArchive size={14} style={{ color: '#4285f4', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
                      {f.size ? formatBytes(parseInt(f.size)) : '—'} · {f.modifiedTime ? timeAgo(f.modifiedTime) : ''}
                    </p>
                  </div>
                  <motion.button className="btn btn-secondary btn-xs" onClick={() => importMut.mutate({ fileId: f.id, fileName: f.name })} disabled={importMut.isPending} whileHover={{ scale: 1.05 }}>
                    <Download size={11} /> Restore
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Local backups */}
      <motion.div className="glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={14} style={{ color: 'var(--cyan)' }} />
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Local Backups</h3>
        </div>
        {isLoading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
          </div>
        ) : (backups as any[]).length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <Archive size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No local backups yet</p>
          </div>
        ) : (
          (backups as any[]).map((b: any, i: number) => (
            <motion.div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(0,212,255,0.04)' }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              {b.status === 'completed' ? <CheckCircle size={14} style={{ color: 'var(--neon-green)', flexShrink: 0 }} />
                : b.status === 'failed' ? <XCircle size={14} style={{ color: 'var(--neon-red)', flexShrink: 0 }} />
                : <Loader2 size={14} style={{ color: 'var(--neon-amber)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
                  {b.size_bytes ? formatBytes(b.size_bytes) : '—'} · {timeAgo(b.created_at)}
                </p>
              </div>
              <span className={`badge ${b.status === 'completed' ? 'badge-green' : b.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{b.status}</span>
              {gStatus?.connected && b.status === 'completed' && (
                <motion.button className="btn btn-secondary btn-icon btn-sm" data-tip="Upload to Drive" whileHover={{ scale: 1.08 }}><Cloud size={12} /></motion.button>
              )}
              <motion.button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteMut.mutate(b.id)} whileHover={{ scale: 1.08 }}><Trash2 size={12} /></motion.button>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  )
}
