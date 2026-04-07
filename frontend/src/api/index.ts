import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '../store/auth'

export const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true
      const refresh = useAuthStore.getState().refreshToken
      if (refresh) {
        try {
          const r = await axios.post('/api/v1/auth/refresh', { refreshToken: refresh })
          useAuthStore.getState().setToken(r.data.accessToken, r.data.refreshToken)
          orig.headers.Authorization = `Bearer ${r.data.accessToken}`
          return api(orig)
        } catch {
          useAuthStore.getState().logout()
          window.location.href = '/login'
        }
      } else {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// Typed API helpers
export const authApi = {
  login:    (email: string, password: string, totpCode?: string) => api.post('/auth/login', { email, password, totpCode }).then(r => r.data),
  register: (data: any) => api.post('/auth/register', data).then(r => r.data),
  refresh:  (token: string) => api.post('/auth/refresh', { refreshToken: token }).then(r => r.data),
  logout:   (refreshToken: string) => api.post('/auth/logout', { refreshToken }).then(r => r.data),
  me:       () => api.get('/auth/me').then(r => r.data),
  updateMe: (data: any) => api.patch('/auth/me', data).then(r => r.data),
  sessions: () => api.get('/auth/sessions').then(r => r.data),
  revokeSession: (id: string) => api.delete('/auth/sessions/' + id).then(r => r.data),
  tokens:   () => api.get('/auth/tokens').then(r => r.data),
  createToken: (name: string) => api.post('/auth/tokens', { name }).then(r => r.data),
  deleteToken: (id: string) => api.delete('/auth/tokens/' + id).then(r => r.data),
  setup2fa: () => api.post('/auth/2fa/setup').then(r => r.data),
  confirm2fa: (code: string) => api.post('/auth/2fa/confirm', { code }).then(r => r.data),
  disable2fa: (code: string, password: string) => api.post('/auth/2fa/disable', { code, password }).then(r => r.data),
  connectGitHub: (code: string) => api.post('/auth/github/callback', { code }).then(r => r.data),
  disconnectGitHub: () => api.delete('/auth/github').then(r => r.data),
}

export const serversApi = {
  list:      (params?: any) => api.get('/servers', { params }).then(r => r.data),
  templates: () => api.get('/servers/templates').then(r => r.data),
  get:       (id: string) => api.get('/servers/' + id).then(r => r.data),
  create:    (data: any) => api.post('/servers', data).then(r => r.data),
  update:    (id: string, data: any) => api.patch('/servers/' + id, data).then(r => r.data),
  delete:    (id: string) => api.delete('/servers/' + id).then(r => r.data),
  power:     (id: string, action: string) => api.post('/servers/' + id + '/power', { action }).then(r => r.data),
  rebuild:   (id: string) => api.post('/servers/' + id + '/rebuild').then(r => r.data),
  stats:     (id: string, period?: string) => api.get('/servers/' + id + '/stats', { params: { period } }).then(r => r.data),
  access:    (id: string) => api.get('/servers/' + id + '/access').then(r => r.data),
  grantAccess:  (id: string, email: string, permissions?: string[]) => api.post('/servers/' + id + '/access', { email, permissions }).then(r => r.data),
  revokeAccess: (id: string, uid: string) => api.delete('/servers/' + id + '/access/' + uid).then(r => r.data),
  // Admin
  adminUsers:     () => api.get('/servers/admin/users').then(r => r.data),
  adminUserServers: (id: string) => api.get('/servers/admin/users/' + id + '/servers').then(r => r.data),
  adminUpdateUser:  (id: string, data: any) => api.patch('/servers/admin/users/' + id, data).then(r => r.data),
  adminCreateUser:  (data: any) => api.post('/servers/admin/users', data).then(r => r.data),
  adminDeleteUser:  (id: string) => api.delete('/servers/admin/users/' + id).then(r => r.data),
}

export const nodesApi = {
  list:   () => api.get('/nodes').then(r => r.data),
  get:    (id: string) => api.get('/nodes/' + id).then(r => r.data),
  create: (data: any) => api.post('/nodes', data).then(r => r.data),
  update: (id: string, data: any) => api.patch('/nodes/' + id, data).then(r => r.data),
  delete: (id: string) => api.delete('/nodes/' + id).then(r => r.data),
  ping:   (id: string) => api.post('/nodes/' + id + '/ping').then(r => r.data),
}

export const filesApi = {
  list:   (sid: string, path: string) => api.get('/files/' + sid, { params: { path } }).then(r => r.data),
  read:   (sid: string, path: string) => api.get('/files/' + sid + '/read', { params: { path } }).then(r => r.data),
  write:  (sid: string, path: string, content: string) => api.put('/files/' + sid + '/write', { path, content }).then(r => r.data),
  delete: (sid: string, path: string) => api.delete('/files/' + sid + '/delete', { params: { path } }).then(r => r.data),
  mkdir:  (sid: string, path: string) => api.post('/files/' + sid + '/mkdir', { path }).then(r => r.data),
  rename: (sid: string, from: string, to: string) => api.post('/files/' + sid + '/rename', { from, to }).then(r => r.data),
}

export const backupsApi = {
  list:   (sid: string) => api.get('/backups/' + sid).then(r => r.data),
  create: (sid: string, name?: string) => api.post('/backups/' + sid, { name }).then(r => r.data),
  delete: (sid: string, bid: string) => api.delete('/backups/' + sid + '/' + bid).then(r => r.data),
}

export const domainsApi = {
  list:   () => api.get('/domains').then(r => r.data),
  create: (data: any) => api.post('/domains', data).then(r => r.data),
  delete: (id: string) => api.delete('/domains/' + id).then(r => r.data),
}

export const settingsApi = {
  public: () => api.get('/settings/public').then(r => r.data),
  list:   () => api.get('/settings').then(r => r.data),
  save:   (settings: Record<string,any>) => api.put('/settings', { settings }).then(r => r.data),
}

export const activityApi = {
  list: (params?: any) => api.get('/activity', { params }).then(r => r.data),
}

export const tunnelApi = {
  status: () => api.get('/tunnel/status').then(r => r.data),
  logs:   () => api.get('/tunnel/logs').then(r => r.data),
  setUrl: (url: string) => api.post('/tunnel/url', { url }).then(r => r.data),
}

export const gdriveApi = {
  connect:      () => api.get('/gdrive/connect').then(r => r.data),
  status:       () => api.get('/gdrive/status').then(r => r.data),
  disconnect:   () => api.delete('/gdrive/disconnect').then(r => r.data),
  files:        (folderId?: string) => api.get('/gdrive/files', { params: { folderId } }).then(r => r.data),
  serverFiles:  (sid: string) => api.get('/gdrive/files/' + sid).then(r => r.data),
  importBackup: (sid: string, fileId: string, fileName: string) => api.post('/gdrive/import/' + sid, { fileId, fileName }).then(r => r.data),
  backupNow:    (sid: string) => api.post('/gdrive/backup/' + sid).then(r => r.data),
  getSchedule:  (sid: string) => api.get('/gdrive/schedule/' + sid).then(r => r.data),
  setSchedule:  (sid: string, data: any) => api.put('/gdrive/schedule/' + sid, data).then(r => r.data),
  delSchedule:  (sid: string) => api.delete('/gdrive/schedule/' + sid).then(r => r.data),
}

export const gitApi = {
  oauthUrl:    () => api.get('/git/oauth-url').then(r => r.data),
  status:      () => api.get('/git/status').then(r => r.data),
  disconnect:  () => api.delete('/git/disconnect').then(r => r.data),
  repos:       (params?: any) => api.get('/git/repos', { params }).then(r => r.data),
  deployments: (sid: string) => api.get('/git/deployments/' + sid).then(r => r.data),
  configure:   (sid: string, data: any) => api.post('/git/deployments/' + sid, data).then(r => r.data),
  deploy:      (sid: string) => api.post('/git/deploy/' + sid).then(r => r.data),
  logs:        (sid: string) => api.get('/git/deploy/' + sid + '/logs').then(r => r.data),
}
