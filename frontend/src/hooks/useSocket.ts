import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth'

let globalSocket: Socket | null = null

export function getSocket(): Socket {
  if (!globalSocket || !globalSocket.connected) {
    const token = useAuthStore.getState().accessToken
    globalSocket = io('/', {
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
  }
  return globalSocket
}

export function useServerStats(serverId: string | null, onStats: (stats: any) => void) {
  const cbRef = useRef(onStats)
  cbRef.current = onStats

  useEffect(() => {
    if (!serverId) return
    const socket = getSocket()
    socket.emit('stats:subscribe', { serverId })
    const handler = (data: any) => { if (data.serverId === serverId) cbRef.current(data) }
    socket.on('stats:update', handler)
    return () => {
      socket.emit('stats:unsubscribe', { serverId })
      socket.off('stats:update', handler)
    }
  }, [serverId])
}

export function useConsole(serverId: string | null, onLine: (line: string) => void) {
  const cbRef = useRef(onLine)
  cbRef.current = onLine

  const sendCommand = useCallback((command: string) => {
    if (!serverId) return
    getSocket().emit('console:input', { serverId, command })
  }, [serverId])

  useEffect(() => {
    if (!serverId) return
    const socket = getSocket()
    socket.emit('console:subscribe', { serverId })
    const lineHandler = (data: any) => { if (data.serverId === serverId) cbRef.current(data.line) }
    const outHandler  = (data: any) => { if (data.serverId === serverId) cbRef.current(data.output) }
    socket.on('console:line', lineHandler)
    socket.on('console:output', outHandler)
    return () => {
      socket.emit('console:unsubscribe', { serverId })
      socket.off('console:line', lineHandler)
      socket.off('console:output', outHandler)
    }
  }, [serverId])

  return { sendCommand }
}
