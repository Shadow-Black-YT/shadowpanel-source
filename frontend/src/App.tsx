import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/auth'
import { Layout }            from './components/layout/Layout'
import { LoginPage }         from './pages/LoginPage'
import { RegisterPage }      from './pages/RegisterPage'
import { DashboardPage }     from './pages/DashboardPage'
import { ServersPage }       from './pages/ServersPage'
import { CreateServerPage }  from './pages/CreateServerPage'
import { ServerDetailPage }  from './pages/ServerDetailPage'
import { TerminalPage }      from './pages/TerminalPage'
import { FilesPage }         from './pages/FilesPage'
import { BackupsPage }       from './pages/BackupsPage'
import { DomainsPage }       from './pages/DomainsPage'
import { SettingsPage }      from './pages/SettingsPage'
import { ActivityPage }      from './pages/ActivityPage'
import { NetworkPage }       from './pages/NetworkPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage }    from './pages/admin/AdminUsersPage'
import { AdminNodesPage }    from './pages/admin/AdminNodesPage'

const qc = new QueryClient({
  defaultOptions: {
    queries:   { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
})

function Guard({ children, admin }: { children: JSX.Element; admin?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (admin && !['admin', 'superadmin'].includes(user?.role || ''))
    return <Navigate to="/" replace />
  return children
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="bg-space" />
        <div className="scanlines" />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index                       element={<DashboardPage />} />
            <Route path="servers"              element={<ServersPage />} />
            <Route path="servers/create"       element={<CreateServerPage />} />
            <Route path="servers/:id"          element={<ServerDetailPage />} />
            <Route path="servers/:id/terminal" element={<TerminalPage />} />
            <Route path="servers/:id/files"    element={<FilesPage />} />
            <Route path="servers/:id/backups"  element={<BackupsPage />} />
            <Route path="domains"              element={<DomainsPage />} />
            <Route path="activity"             element={<ActivityPage />} />
            <Route path="network"              element={<NetworkPage />} />
            <Route path="settings"             element={<SettingsPage />} />
          </Route>

          <Route path="/admin" element={<Guard admin><Layout /></Guard>}>
            <Route index        element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="nodes" element={<AdminNodesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            background:     'rgba(10,10,24,0.97)',
            backdropFilter: 'blur(20px)',
            border:         '1px solid rgba(0,212,255,0.22)',
            color:          '#e8e8ff',
            fontSize:       '13px',
            borderRadius:   '10px',
            boxShadow:      '0 4px 32px rgba(0,0,0,0.7)',
          },
          success: { iconTheme: { primary: '#00ff88', secondary: '#020209' } },
          error:   { iconTheme: { primary: '#ff2d55', secondary: '#020209' } },
        }}
      />
    </QueryClientProvider>
  )
}
