import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import { tunnelApi } from '../../api'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard, Server, Globe, Settings, LogOut, ShieldCheck,
  Network, Bell, Menu, X, Search, Zap, Activity, ChevronRight,
  Cpu, HardDrive, MemoryStick, Radio, ExternalLink, Wifi,
  Users, BarChart3, Plus, Terminal, FolderOpen, Archive,
  MonitorDot, Command, Slash,
} from 'lucide-react'

// ── Nav config ─────────────────────────────────────────────────
const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { to: '/servers',  icon: Server,        label: 'Servers' },
  { to: '/domains',  icon: Globe,         label: 'Domains' },
  { to: '/activity', icon: Activity,      label: 'Activity' },
  { to: '/network',  icon: MonitorDot,    label: 'Network' },
  { to: '/settings', icon: Settings,      label: 'Settings' },
]
const ADMIN_NAV = [
  { to: '/admin',       icon: ShieldCheck, label: 'Overview', exact: true },
  { to: '/admin/users', icon: Users,       label: 'Users' },
  { to: '/admin/nodes', icon: Network,     label: 'Nodes' },
]

// ── Resource mini-bar ───────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  const c = pct > 85 ? 'var(--neon-red)' : pct > 65 ? 'var(--neon-amber)' : color
  return (
    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        style={{ height: '100%', background: c, boxShadow: `0 0 6px ${c}` }}
      />
    </div>
  )
}

// ── Tunnel / network badge ──────────────────────────────────────
function NetworkBadge() {
  const { data } = useQuery({
    queryKey: ['tunnel-status'],
    queryFn: tunnelApi.status,
    refetchInterval: 30000,
    retry: false,
  })
  if (!data) return null

  if (data.accessMethod === 'tunnel') {
    return (
      <motion.a
        href={data.tunnelUrl || '#'}
        target="_blank"
        rel="noopener"
        className="tunnel-badge"
        style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.22)' }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
          background: data.tunnelActive ? 'var(--neon-green)' : 'var(--neon-red)',
          boxShadow: data.tunnelActive ? '0 0 6px var(--neon-green)' : 'none',
        }} />
        <Radio size={10} />
        <span>CF Tunnel</span>
        <ExternalLink size={9} />
      </motion.a>
    )
  }

  if (data.publicIPv4) {
    return (
      <div className="tunnel-badge" style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--neon-green)', border: '1px solid rgba(0,255,136,0.22)' }}>
        <Wifi size={10} />
        <span>{data.publicIPv4}</span>
      </div>
    )
  }
  return null
}

// ── Command Palette ─────────────────────────────────────────────
const ALL_COMMANDS = [
  { label: 'Dashboard',       to: '/',               icon: LayoutDashboard },
  { label: 'Servers',         to: '/servers',         icon: Server },
  { label: 'New Server',      to: '/servers/create',  icon: Plus },
  { label: 'Domains',         to: '/domains',         icon: Globe },
  { label: 'Activity Log',    to: '/activity',        icon: Activity },
  { label: 'Network & Tunnel',to: '/network',         icon: MonitorDot },
  { label: 'Settings',        to: '/settings',        icon: Settings },
  { label: 'Admin Overview',  to: '/admin',           icon: ShieldCheck },
  { label: 'Manage Users',    to: '/admin/users',     icon: Users },
  { label: 'Manage Nodes',    to: '/admin/nodes',     icon: Network },
]

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const results = ALL_COMMANDS.filter(c =>
    !q || c.label.toLowerCase().includes(q.toLowerCase())
  )

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => setSel(0), [q])

  const go = useCallback((to: string) => { navigate(to); onClose() }, [navigate, onClose])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[sel]) go(results[sel].to)
    if (e.key === 'Escape') onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="cmd-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cmd-palette glass-glow"
          initial={{ opacity: 0, scale: 0.94, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -20 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <Search size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search commands, pages…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', fontFamily: '"DM Sans", sans-serif' }}
            />
            <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 7px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
                No results for &ldquo;{q}&rdquo;
              </p>
            ) : results.map((c, i) => (
              <motion.button
                key={c.to}
                className={cn('cmd-item', i === sel && 'selected')}
                onClick={() => go(c.to)}
                onMouseEnter={() => setSel(i)}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                whileHover={{ x: 2 }}
              >
                <c.icon size={14} />
                <span style={{ flex: 1 }}>{c.label}</span>
                {i === sel && (
                  <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>
                    <ChevronRight size={13} />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>

          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc dismiss</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main Layout ─────────────────────────────────────────────────
export function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  const isAdmin = ['admin', 'superadmin'].includes(user?.role || '')

  // ⌘K shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(c => !c) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Close sidebar on navigation
  useEffect(() => setSidebarOpen(false), [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.78)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        className={cn('fixed lg:static inset-y-0 left-0 z-30 flex flex-col', !sidebarOpen && '-translate-x-full lg:translate-x-0')}
        style={{
          width: 234,
          background: 'rgba(2,2,9,0.98)',
          backdropFilter: 'blur(28px)',
          borderRight: '1px solid var(--border)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <motion.div
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 20, color: '#000',
                position: 'relative',
              }}
              animate={{ boxShadow: ['0 0 12px rgba(0,212,255,0.4)', '0 0 24px rgba(0,212,255,0.7)', '0 0 12px rgba(0,212,255,0.4)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              S
              <motion.span
                style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--neon-green)',
                  border: '2px solid rgba(2,2,9,0.98)',
                }}
                animate={{ boxShadow: ['0 0 4px var(--neon-green)', '0 0 10px var(--neon-green)', '0 0 4px var(--neon-green)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                shadowPanel
              </p>
              <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                v1.0 · mission control
              </p>
            </div>
            <button
              className="lg:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Search button */}
          <motion.button
            onClick={() => setCmdOpen(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(0,212,255,0.04)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12, fontFamily: '"DM Sans", sans-serif',
            }}
            whileHover={{ borderColor: 'var(--border-hover)', background: 'rgba(0,212,255,0.07)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Search size={11} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search everything…</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: 0.5, fontSize: 10 }}>
              <Command size={9} />K
            </span>
          </motion.button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => cn('nav-link', isActive && 'active')}
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    animate={isActive ? { color: 'var(--cyan)', scale: 1.05 } : { color: 'var(--text-muted)', scale: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Icon size={14} />
                  </motion.div>
                  <span>{label}</span>
                  {isActive && (
                    <motion.div
                      style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 6px var(--cyan)' }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="nav-section" style={{ marginTop: 14 }}>Control Tower</div>
              {ADMIN_NAV.map(({ to, icon: Icon, label, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  className={({ isActive }) => cn('nav-link', isActive && 'active')}
                >
                  {({ isActive }) => (
                    <>
                      <motion.div animate={isActive ? { color: 'var(--cyan)' } : { color: 'var(--text-muted)' }}>
                        <Icon size={14} />
                      </motion.div>
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Resource bars */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          {[
            { icon: MemoryStick, label: 'RAM',  pct: 45, color: 'var(--cyan)' },
            { icon: Cpu,         label: 'CPU',  pct: 28, color: '#a855f7' },
            { icon: HardDrive,   label: 'Disk', pct: 62, color: 'var(--neon-amber)' },
          ].map(({ icon: Icon, label, pct, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon size={10} style={{ color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
                <MiniBar pct={pct} color={color} />
              </div>
            </div>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.div
              style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, color: '#000',
                fontFamily: 'Syne, sans-serif', cursor: 'pointer',
              }}
              whileHover={{ scale: 1.08, boxShadow: '0 0 14px rgba(0,212,255,0.5)' }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</p>
            </div>
            <motion.button
              onClick={handleLogout}
              style={{ padding: 7, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              whileHover={{ color: 'var(--neon-red)', background: 'rgba(255,45,85,0.1)' }}
              whileTap={{ scale: 0.93 }}
              title="Logout"
            >
              <LogOut size={14} />
            </motion.button>
          </div>

          {/* Credits */}
          <motion.div
            style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="footer-credit">
              Developed by{' '}
              <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
                Nystic.Shadow
              </a>
            </p>
            <p className="footer-credit" style={{ marginTop: 2 }}>Powered by shadowblack</p>
          </motion.div>
        </div>
      </motion.aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <motion.header
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', flexShrink: 0,
            background: 'rgba(2,2,9,0.88)', backdropFilter: 'blur(18px)',
            borderBottom: '1px solid var(--border)',
          }}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        >
          <button
            className="lg:hidden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'var(--text-primary)' }}>shadowPanel</span>
            <Slash size={10} style={{ opacity: 0.4 }} />
            <motion.span
              key={location.pathname}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ textTransform: 'capitalize' }}
            >
              {location.pathname.split('/').filter(Boolean)[0] || 'dashboard'}
            </motion.span>
          </div>

          <NetworkBadge />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search btn */}
            <motion.button
              onClick={() => setCmdOpen(true)}
              style={{
                display: 'none', alignItems: 'center', gap: 6, padding: '6px 12px',
                background: 'rgba(0,212,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
              className="sm:flex"
              whileHover={{ borderColor: 'var(--border-hover)', background: 'rgba(0,212,255,0.08)' }}
              whileTap={{ scale: 0.97 }}
            >
              <Search size={11} />
              <span>Search</span>
              <kbd style={{ opacity: 0.5, fontSize: 10 }}>⌘K</kbd>
            </motion.button>

            {/* New server */}
            <motion.button
              onClick={() => navigate('/servers/create')}
              className="btn btn-primary btn-sm"
              style={{ display: 'none' }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Plus size={14} /> New Server
            </motion.button>
            <button
              onClick={() => navigate('/servers/create')}
              className="btn btn-primary btn-sm hidden sm:inline-flex"
            >
              <Plus size={13} /> New
            </button>

            {/* Notifications */}
            <motion.button
              style={{ position: 'relative', padding: 8, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              whileHover={{ background: 'rgba(0,212,255,0.07)', color: 'var(--text-primary)' }}
              whileTap={{ scale: 0.93 }}
            >
              <Bell size={17} />
              <span className="notif-dot" />
            </motion.button>

            {/* Avatar */}
            <motion.div
              style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, color: '#000',
                fontFamily: 'Syne, sans-serif', cursor: 'pointer',
              }}
              whileHover={{ scale: 1.1, boxShadow: '0 0 14px rgba(0,212,255,0.5)' }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </motion.div>
          </div>
        </motion.header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </div>

          {/* Footer */}
          <motion.footer
            style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="footer-credit">
              Powered by{' '}
              <span style={{ color: 'var(--cyan)' }}>shadowblack</span>
              {' '}·{' '}
              Developed by{' '}
              <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
                Nystic.Shadow
              </a>
              {' '}·{' '}
              <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                💬 Discord Support
              </a>
            </p>
          </motion.footer>
        </main>
      </div>
    </div>
  )
}
