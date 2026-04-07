import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  role: 'superadmin'|'admin'|'client'
  ram_limit: number
  cpu_limit: number
  disk_limit: number
  server_limit: number
  totp_enabled: boolean
  email_verified: boolean
  github_username?: string
  created_at: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, access: string, refresh: string) => void
  setToken: (access: string, refresh: string) => void
  updateUser: (patch: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth:    (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setToken:   (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      updateUser: (patch) => set(s => ({ user: s.user ? { ...s.user, ...patch } : null })),
      logout:     () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'sp-auth-v1',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }),
    }
  )
)
