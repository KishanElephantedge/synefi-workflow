import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Autonomous from './pages/Autonomous'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { TenantProvider, useTenant } from './context/TenantContext'
import './App.css'

function TenantSwitcher() {
  const { tenants, tenantId, setTenantId, loading } = useTenant()

  if (loading) return null

  return (
    <div className="tenant-switcher">
      <label htmlFor="tenant-select">Workspace</label>
      <select
        id="tenant-select"
        value={tenantId ?? ''}
        onChange={e => setTenantId(Number(e.target.value))}
      >
        {(!tenants || tenants.length === 0) && <option value="">No tenants yet</option>}
        {(tenants || []).map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}

function AppShell() {
  const { tenantId, user, logout } = useTenant()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">O</span>
          Outreach Pipeline
        </Link>
        <TenantSwitcher />
        <nav className="nav-links">
          <NavLink to="/" end>
            <span className="nav-dot" />
            Batches
          </NavLink>
          <NavLink to="/autonomous">
            <span className="nav-dot" />
            Autonomous
          </NavLink>
          <NavLink to="/settings">
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
        {/* key forces every page to remount (and re-fetch) when the tenant changes,
            instead of each page needing its own tenantId dependency wiring */}
        <Routes key={tenantId}>
          <Route path="/" element={<BatchList />} />
          <Route path="/batches/:batchId" element={<BatchDetail />} />
          <Route path="/autonomous" element={<Autonomous />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

function Gate() {
  const { user, loading } = useTenant()

  if (loading) return null
  if (!user) return <Login />
  return <AppShell />
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
