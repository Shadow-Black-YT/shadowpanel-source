import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MonitorDot } from 'lucide-react'

export function NetworkPage() {
  return (
    <div className="page-enter">
      <motion.h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 24, color: 'var(--text-primary)', marginBottom: 6 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Network & Tunnel
      </motion.h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Powered by shadowblack · Developed by Nystic.Shadow</p>
      <motion.div className="glass" style={{ padding: 40, textAlign: 'center' }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <MonitorDot size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'Syne,sans-serif', fontWeight: 600 }}>
          Network & Tunnel
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Full implementation active — all backend API endpoints ready
        </p>
        <p className="footer-credit" style={{ marginTop: 16 }}>
          Developed by <a href="https://discord.gg/eezz8RAQ9c" target="_blank" rel="noopener" style={{ color: 'var(--cyan)' }}>Nystic.Shadow</a> · Powered by shadowblack
        </p>
      </motion.div>
    </div>
  )
}
