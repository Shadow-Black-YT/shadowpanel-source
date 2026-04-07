import clsx, { ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const formatMB = (mb: number): string => {
  if (mb < 1024) return mb + ' MB'
  return (mb / 1024).toFixed(2) + ' GB'
}

export const pct = (used: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

export const pctColor = (p: number): string =>
  p > 85 ? 'var(--neon-red)' : p > 65 ? 'var(--neon-amber)' : 'var(--neon-green)'

export const statusColor = (status: string): string => ({
  running:    'var(--neon-green)',
  stopped:    'var(--text-muted)',
  error:      'var(--neon-red)',
  installing: 'var(--neon-amber)',
  rebuilding: 'var(--neon-amber)',
  suspended:  'var(--neon-red)',
  online:     'var(--neon-green)',
  offline:    'var(--text-muted)',
  maintenance:'#a855f7',
}[status] || 'var(--text-muted)')

export const statusBadge = (status: string): string => ({
  running:    'badge-green',
  stopped:    'badge-gray',
  error:      'badge-red',
  installing: 'badge-amber',
  rebuilding: 'badge-amber',
  suspended:  'badge-red',
  online:     'badge-green',
  offline:    'badge-gray',
}[status] || 'badge-gray')

export const templateIcon: Record<string, string> = {
  game:     '🎮', webapp: '⚡', bot: '🤖', web: '🌐',
  database: '🗄', custom: '📦',
}

export const gameIcon: Record<string, string> = {
  minecraft_java: '⛏', minecraft_bedrock: '⛏',
  cs2: '🎯', csgo: '🎯', rust: '🦀',
  valheim: '⚔️', ark: '🦖', gmod: '🔧',
  terraria: '🌱', tf2: '🎪',
}

export const truncate = (str: string, n: number) =>
  str.length > n ? str.slice(0, n) + '…' : str

export const timeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return Math.floor(seconds/60) + 'm ago'
  if (seconds < 86400) return Math.floor(seconds/3600) + 'h ago'
  return Math.floor(seconds/86400) + 'd ago'
}
