import { BrowserRouter, Routes, Route, Link, NavLink, useParams, useNavigate, Navigate } from 'react-router-dom'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Autonomous from './pages/Autonomous'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { TenantProvider, useTenant } from './context/TenantContext'
import { setActiveTenant } from './api/client'
import './App.css'

function TenantSwitcher() {
  const { tenants } = useTenant()
  const { tenantSlug } = useParams()
  const navigate = useNavigate()

  if (tenants.length === 0) return null

  return (
    <div className="tenant-switcher">
      <label htmlFor="tenant-select">Workspace</label>
      <select
        id="tenant-select"
        value={tenantSlug ?? ''}
        onChange={e => navigate(`/${e.target.value}`)}
      >
        {tenants.map(t => (
          <option key={t.slug} value={t.slug}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}

// Rendered once per tenant-scoped route change. The URL's :tenantSlug is the single source
// of truth for which tenant is active -- this just keeps the API client's routing in sync
// with it, and redirects away from an invalid/unknown slug instead of silently guessing.
function TenantScope({ children }) {
  const { tenantSlug } = useParams()
  const { tenants } = useTenant()

  const match = tenants.find(t => t.slug === tenantSlug)

  if (match) {
    setActiveTenant(match.slug)
  } else if (tenants.length > 0) {
    return <Navigate to={`/${tenants[0].slug}`} replace />
  }

  return children
}

function RootRedirect() {
  const { tenants } = useTenant()
  if (tenants.length === 0) return null
  return <Navigate to={`/${tenants[0].slug}`} replace />
}

function AppShell() {
  const { user, logout } = useTenant()
  const { tenantSlug } = useParams()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'} className="brand">
          <span className="brand-mark">O</span>
          Outreach Pipeline
        </Link>
        <TenantSwitcher />
        <nav className="nav-links">
          <NavLink to={`/${tenantSlug}`} end>
            <span className="nav-dot" />
            Batches
          </NavLink>
          <NavLink to={`/${tenantSlug}/autonomous`}>
            <span className="nav-dot" />
            Autonomous
          </NavLink>
          <NavLink to={`/${tenantSlug}/settings`}>
            <span className="nav-dot" />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          {user?.email}
          <button type="button" className="secondary" onClick={logout} style={{ marginTop: '0.5rem', width: '100%' }}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        {/* key forces every page to remount (and re-fetch) when the tenant changes */}
        <Routes key={tenantSlug}>
          <Route path="" element={<TenantScope><BatchList /></TenantScope>} />
          <Route path="batches/:batchId" element={<TenantScope><BatchDetail /></TenantScope>} />
          <Route path="autonomous" element={<TenantScope><Autonomous /></TenantScope>} />
          <Route path="settings" element={<TenantScope><Settings /></TenantScope>} />
        </Routes>
      </main>
    </div>
  )
}

function Gate() {
  const { user, loading } = useTenant()

  if (loading) return null
  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/:tenantSlug/*" element={<AppShell />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <Gate />
      </TenantProvider>
    </BrowserRouter>
  )
}

export default App
