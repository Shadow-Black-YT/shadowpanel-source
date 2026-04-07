import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Terminal, ArrowLeft, Maximize2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export function TerminalPage() {
  const { id } = useParams<{ id: string }>()
  const [lines, setLines] = useState<string[]>(['Connected to shadowPanel terminal. Type a command below.', ''])
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const sendCmd = () => {
    if (!cmd.trim()) return
    setLines(prev => [...prev, '$ ' + cmd])
    setHistory(prev => [cmd, ...prev.slice(0, 49)])
    setHistIdx(-1)
    setCmd('')
    // Simulate response — real impl uses WebSocket
    setTimeout(() => setLines(prev => [...prev, 'Command sent to server...']), 300)
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Link to={'/servers/' + id} className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <Terminal size={16} style={{ color: 'var(--cyan)' }} />
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', flex: 1 }}>Terminal</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(lines.join('\n')); toast.success('Copied!') }}><Copy size={13} /></button>
        <button className="btn btn-secondary btn-sm"><Maximize2 size={13} /></button>
      </div>
      <motion.div className="terminal-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="terminal-bar">
          <div className="terminal-dot" style={{ background: '#ff5f57' }} />
          <div className="terminal-dot" style={{ background: '#febc2e' }} />
          <div className="terminal-dot" style={{ background: '#28c840' }} />
          <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono,monospace' }}>
            shadowPanel Terminal · Server {id?.slice(0, 8)}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: 'Geist Mono,monospace', fontSize: 13, lineHeight: 1.65 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ color: l.startsWith('$') ? 'var(--neon-green)' : l.startsWith('Error') || l.startsWith('error') ? 'var(--neon-red)' : 'var(--text-secondary)' }}>{l}</div>
          ))}
          <span style={{ color: 'var(--cyan)', animation: 'sPulse 1s infinite' }}>█</span>
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid rgba(0,212,255,0.12)', padding: '4px 8px', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--neon-green)', fontFamily: 'Geist Mono,monospace', fontSize: 14, flexShrink: 0 }}>$</span>
          <input value={cmd} onChange={e => setCmd(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') sendCmd()
              if (e.key === 'ArrowUp' && history.length) { const idx = Math.min(histIdx + 1, history.length - 1); setHistIdx(idx); setCmd(history[idx]) }
              if (e.key === 'ArrowDown') { const idx = Math.max(histIdx - 1, -1); setHistIdx(idx); setCmd(idx === -1 ? '' : history[idx]) }
            }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'Geist Mono,monospace', fontSize: 13, padding: '8px 0' }}
            placeholder="Enter command…" autoFocus />
          <button onClick={sendCmd} className="btn btn-primary btn-sm">Send</button>
        </div>
      </motion.div>
    </div>
  )
}
