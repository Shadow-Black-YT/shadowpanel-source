import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { settingsApi, gitApi, gdriveApi, authApi } from '../api'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import {
  Settings, Github, Cloud, Shield, Key, User, Bell,
  ChevronRight, CheckCircle, XCircle, Loader2, ExternalLink,
  Copy, Plus, Trash2, Eye, EyeOff, RefreshCw, Zap,
} from 'lucide-react'

function Section({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <motion.div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </motion.div>
  )
}

function GitHubSection() {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({ queryKey: ['git-status'], queryFn: gitApi.status, retry: false })
  const oauthMut = useMutation({
    mutationFn: gitApi.oauthUrl,
    onSuccess: (d) => { window.location.href = d.url },
    onError: (e: any) => toast.error(e.response?.data?.error || 'GitHub OAuth not configured in panel settings'),
  })
  const disconnectMut = useMutation({
    mutationFn: gitApi.disconnect,
    onSuccess: () => { toast.success('GitHub disconnected'); qc.invalidateQueries({ queryKey: ['git-status'] }) },
  })

  if (isLoading) return <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />

  if (status?.connected) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', marginBottom: 14 }}>
        {status.connection.avatar_url && <img src={status.connection.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.3)' }} />}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            <Github size={12} style={{ display: 'inline', marginRight: 5 }} />
            {status.connection.github_username}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{status.connection.github_email}</p>
        </div>
        <a href={`https://github.com/${status.connection.github_username}`} target="_blank" rel="noopener" className="btn btn-secondary btn-xs">
          <ExternalLink size={10} /> View
        </a>
        <button className="btn btn-danger btn-xs" onClick={() => disconnectMut.mutate()}>Disconnect</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        ✓ Your GitHub account is connected. You can deploy{' '}
        <strong style={{ color: 'var(--text-primary)' }}>private and public repositories</strong> directly to any server.
      </p>
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Connect your GitHub account to deploy private repos, get auto-deploy webhooks, and browse all your repositories from the panel.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {['Deploy private repos', 'Browse all your repos', 'Auto-deploy on push', 'Webhook integration'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <CheckCircle size={12} style={{ color: 'var(--neon-green)', flexShrink: 0 }} /> {f}
          </div>
        ))}
      </div>
      <motion.button className="btn btn-secondary" onClick={() => oauthMut.mutate()} disabled={oauthMut.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
        <Github size={16} />
        {oauthMut.isPending ? 'Redirecting to GitHub…' : 'Connect GitHub Account'}
        <ChevronRight size={13} />
      </motion.button>
    </div>
  )
}

function GDriveSection() {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({ queryKey: ['gdrive-status'], queryFn: gdriveApi.status, retry: false })
  const connectMut = useMutation({
    mutationFn: gdriveApi.connect,
    onSuccess: (d) => { window.location.href = d.authUrl },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Google OAuth not configured'),
  })
  const disconnectMut = useMutation({
    mutationFn: gdriveApi.disconnect,
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({ queryKey: ['gdrive-status'] }) },
  })

  if (isLoading) return <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />

  if (status?.connected) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(52,168,83,0.07)', border: '1px solid rgba(52,168,83,0.25)', marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 900, flexShrink: 0 }}>G</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{status.connection?.display_name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{status.connection?.email}</p>
        </div>
        <button className="btn btn-danger btn-xs" onClick={() => disconnectMut.mutate()}>Disconnect</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        ✓ Backups will automatically sync to a <strong style={{ color: 'var(--text-primary)' }}>shadowPanel Backups</strong> folder in your Drive.
        Each server gets its own sub-folder. Configure schedule on the server's Backups tab.
      </p>
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Connect Google Drive for automatic cloud backup. shadowPanel creates a dedicated folder per server and uploads backups on your chosen schedule.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {['Auto-create server folders', 'Scheduled uploads', 'Import backups from Drive', 'Retention policy'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <CheckCircle size={12} style={{ color: '#34a853', flexShrink: 0 }} /> {f}
          </div>
        ))}
      </div>
      <motion.button className="btn btn-secondary" onClick={() => connectMut.mutate()} disabled={connectMut.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900 }}>G</div>
        {connectMut.isPending ? 'Redirecting to Google…' : 'Connect Google Drive'}
        <ChevronRight size={13} />
      </motion.button>
    </div>
  )
}

function ApiTokenSection() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  const { data: tokens = [] } = useQuery({ queryKey: ['api-tokens'], queryFn: authApi.tokens })
  const createMut = useMutation({
    mutationFn: () => authApi.createToken(name),
    onSuccess: (d) => { setNewToken(d.token); setName(''); qc.invalidateQueries({ queryKey: ['api-tokens'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => authApi.deleteToken(id),
    onSuccess: () => { toast.success('Token deleted'); qc.invalidateQueries({ queryKey: ['api-tokens'] }) },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {newToken && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon-green)', marginBottom: 6 }}>⚠ Save this token now — it will not be shown again</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {show ? newToken : newToken.slice(0,16) + '•'.repeat(20)}
            </code>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(s => !s)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(newToken); toast.success('Copied!') }}><Copy size={13} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setNewToken(null)}>✕</button>
          </div>
        </motion.div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="Token name e.g. My App" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => createMut.mutate()} disabled={!name || createMut.isPending}>
          {createMut.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={13} /> Generate</>}
        </button>
      </div>

      {(tokens as any[]).length > 0 && (
        <div>
          {(tokens as any[]).map((t: any) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(0,212,255,0.06)' }}>
              <Key size={13} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>{t.token_prefix}… · {t.last_used ? 'used ' + t.last_used : 'never used'}</p>
              </div>
              <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteMut.mutate(t.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const change = async () => {
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 8) { toast.error('Password must be 8+ chars'); return }
    setLoading(true)
    try {
      await authApi.updateMe({ password: form.password, currentPassword: form.currentPassword })
      toast.success('Password changed!')
      setForm({ currentPassword: '', password: '', confirm: '' })
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Current Password</label><input type="password" className="input" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} /></div>
      <div><label className="label">New Password</label><input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
      <div><label className="label">Confirm New Password</label><input type="password" className="input" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} /></div>
      <button className="btn btn-primary btn-sm" onClick={change} disabled={loading || !form.currentPassword || !form.password} style={{ alignSelf: 'flex-start' }}>
        {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Shield size={13} /> Change Password</>}
      </button>
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="page-enter">
      <motion.h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Settings
      </motion.h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Account, integrations & security · Powered by shadowblack</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div>
          <Section title="GitHub Integration" icon={Github} color="#333">
            <GitHubSection />
          </Section>

          <Section title="Google Drive Backup" icon={Cloud} color="#34a853">
            <GDriveSection />
          </Section>

          <Section title="Security" icon={Shield} color="var(--neon-red)">
            <SecuritySection />
          </Section>
        </div>

        <div style={{ paddingLeft: 16 }}>
          <Section title="API Tokens" icon={Key} color="var(--cyan)">
            <ApiTokenSection />
          </Section>

          <motion.div className="glass" style={{ padding: '16px 18px' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(121,40,202,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={14} style={{ color: '#a855f7' }} />
              </div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>About shadowPanel</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Version', 'v1.0.0'],
                ['Developer', 'Nystic.Shadow'],
                ['Powered by', 'shadowblack'],
                ['Discord', 'discord.gg/eezz8RAQ9c'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid rgba(0,212,255,0.06)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'Geist Mono, monospace' }}>{v}</span>
                </div>
              ))}
            </div>
            <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" className="btn btn-secondary btn-sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
              💬 Join Discord Support Server
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
