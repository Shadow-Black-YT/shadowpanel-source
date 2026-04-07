import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authApi } from '../api'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react'

export function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be 8+ characters'); return }
    setLoading(true)
    try {
      const d = await authApi.register(form)
      setAuth(d.user, d.accessToken, d.refreshToken)
      toast.success('Welcome to shadowPanel!')
      navigate('/')
    } catch (err: any) { toast.error(err.response?.data?.error || 'Registration failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
      <motion.div style={{ position: 'absolute', top: '20%', right: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(121,40,202,0.12) 0%,transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none' }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 10, repeat: Infinity }} />
      <motion.div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--text-primary)' }}>
            shadow<span style={{ background: 'linear-gradient(135deg,var(--cyan),var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Panel</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Create your account</p>
        </div>
        <div className="glass-glow" style={{ padding: '24px' }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="label">Username</label><input className="input" placeholder="cooldev" required value={form.username} onChange={e => set('username', e.target.value)} minLength={3} maxLength={32} autoFocus /></div>
            <div><label className="label">Email</label><input type="email" className="input" placeholder="you@example.com" required value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={show ? 'text' : 'password'} className="input" placeholder="min 8 characters" required value={form.password} onChange={e => set('password', e.target.value)} minLength={8} style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <motion.button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: 12, fontSize: 13, fontFamily: 'Syne,sans-serif', fontWeight: 700, marginTop: 4 }} whileTap={{ scale: 0.97 }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <><UserPlus size={14} /> Create Account</>}
            </motion.button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--cyan)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
        <p className="footer-credit" style={{ textAlign: 'center', marginTop: 14 }}>Powered by shadowblack · Developed by Nystic.Shadow</p>
      </motion.div>
    </div>
  )
}
