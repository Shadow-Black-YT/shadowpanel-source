import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authApi } from '../api'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Zap, ArrowRight, Shield, Wifi, Radio, Lock, Github } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [show,  setShow]  = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const d = await authApi.login(email, pass)
      setAuth(d.user, d.accessToken, d.refreshToken)
      navigate('/')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
      {/* Orbs */}
      <motion.div style={{ position: 'absolute', top: '5%', left: '15%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,212,255,0.1) 0%,transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} animate={{ scale: [1, 1.06, 1], x: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(121,40,202,0.12) 0%,transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} animate={{ scale: [1, 1.08, 1], y: [0, -20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,1) 1px,transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />

      <motion.div
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <motion.div
            style={{ width: 70, height: 70, borderRadius: 20, background: 'linear-gradient(135deg,var(--cyan),var(--violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 34, color: '#000', margin: '0 auto 16px', position: 'relative' }}
            animate={{ boxShadow: ['0 0 20px rgba(0,212,255,0.4)', '0 0 50px rgba(0,212,255,0.7)', '0 0 20px rgba(0,212,255,0.4)'] }}
            transition={{ duration: 3, repeat: Infinity }}
            whileHover={{ scale: 1.06, rotate: 3 }}
          >
            S
          </motion.div>
          <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 32, color: 'var(--text-primary)', letterSpacing: '-0.03em' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            shadow<span style={{ background: 'linear-gradient(135deg,var(--cyan),var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Panel</span>
          </motion.h1>
          <motion.p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono,monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 5 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            Mission Control · v1.0
          </motion.p>
        </div>

        {/* Card */}
        <motion.div className="glass-glow" style={{ padding: '28px' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: 'Syne,sans-serif', marginBottom: 20 }}>Authenticate</p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required autoFocus />
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={show ? 'text' : 'password'} className="input" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••••" required style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <motion.button type="submit" disabled={loading || !email || !pass} className="btn btn-primary" style={{ width: '100%', padding: 13, fontSize: 14, fontFamily: 'Syne,sans-serif', fontWeight: 800, letterSpacing: '0.05em', marginTop: 4 }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              {loading ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <><Zap size={15} /> Access Mission Control <ArrowRight size={14} style={{ marginLeft: 'auto' }} /></>}
            </motion.button>
          </form>

          <div className="divider-aurora" style={{ margin: '22px 0 18px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[{icon: Wifi, l: 'IP Auto-Detect'}, {icon: Radio, l: 'CF Tunnel'}, {icon: Shield, l: '2FA TOTP'}, {icon: Lock, l: 'RBAC Access'}].map(({icon: Icon, l}) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <Icon size={10} style={{ color: 'var(--neon-green)' }} /><span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{l}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            No account? <Link to="/register" style={{ color: 'var(--cyan)', fontWeight: 600 }}>Register here</Link>
          </p>
        </motion.div>

        <motion.div style={{ textAlign: 'center', marginTop: 18 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <p className="footer-credit">Developed by <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ color: 'var(--cyan)' }}>Nystic.Shadow</a> · Powered by shadowblack</p>
          <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'inline-block', textDecoration: 'none' }}>💬 Discord Support Server</a>
        </motion.div>
      </motion.div>
    </div>
  )
}
