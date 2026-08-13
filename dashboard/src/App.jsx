import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, useParams, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Overview from './pages/Overview'
import Calendar from './pages/Calendar'
import Companies from './pages/Companies'
import Meetings from './pages/Meetings'
import Notifications from './pages/Notifications'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Autonomous from './pages/Autonomous'
import Outcomes from './pages/Outcomes'
import Targets from './pages/Targets'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NotificationBell from './components/NotificationBell'
import ChatWidget from './components/ChatWidget'
import { TenantProvider, useTenant } from './context/TenantContext'
import { setActiveTenant } from './api/client'
import './App.css'

function TenantSwitcher() {
  const { tenants } = useTenant()
  const { tenantSlug } = useParams()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const activeTenant = tenants.find(t => t.slug === tenantSlug) || tenants[0]

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (tenants.length === 0) return null

  return (
    <div className="tenant-switcher" ref={dropdownRef}>
      <label>Workspace</label>
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{activeTenant?.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      
      {isOpen && (
        <div className="custom-select-dropdown">
          {tenants.map(t => (
            <div
              key={t.slug}
              className={`custom-select-option ${t.slug === tenantSlug ? 'selected' : ''}`}
              onClick={() => {
                navigate(`/${t.slug}`)
                setIsOpen(false)
              }}
            >
              {t.name}
              {t.slug === tenantSlug && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </div>
          ))}
        </div>
      )}
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
    const elephant = tenants.find(t => t.slug === 'elephant-edge')
    const defaultTenant = elephant || tenants[0]
    return <Navigate to={`/${defaultTenant.slug}`} replace />
  }

  return children
}

function RootRedirect() {
  const { tenants } = useTenant()
  if (tenants.length === 0) return null
  const elephant = tenants.find(t => t.slug === 'elephant-edge')
  const defaultTenant = elephant || tenants[0]
  return <Navigate to={`/${defaultTenant.slug}`} replace />
}

// Root ("") route -- Elephant Edge lands on the new Overview funnel; every other tenant
// keeps its original behavior (the batch list) unchanged.
function Home() {
  const { tenantSlug } = useParams()
  return tenantSlug === 'elephant-edge' ? <Overview /> : <BatchList />
}

// The breadcrumb previously hardcoded "Overview" regardless of which page was actually
// showing -- derives the real current page from the URL instead.
function useBreadcrumbLabel() {
  const { tenantSlug } = useParams()
  const location = useLocation()
  const rest = location.pathname.replace(`/${tenantSlug}`, '').replace(/^\//, '')
  const segment = rest.split('/')[0]

  if (!segment) return tenantSlug === 'elephant-edge' ? 'Overview' : 'Hot Accounts'
  const labels = {
    batches: 'Hot Accounts',
    autonomous: 'Autonomous',
    companies: 'Companies',
    campaign: 'Campaign',
    meetings: 'Meetings',
    notifications: 'Notifications',
    calendar: 'Review',
    targets: 'Targets',
    settings: 'Settings',
  }
  return labels[segment] || 'Batch Detail'
}

function AppShell() {
  const { user, logout } = useTenant()
  const { tenantSlug } = useParams()
  const breadcrumbLabel = useBreadcrumbLabel()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'} className="brand">
          Sales Operating System
        </Link>
        <TenantSwitcher />
        <nav className="nav-links">
          {tenantSlug === 'elephant-edge' ? (
            <>
              <NavLink to={`/${tenantSlug}`} end>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                Overview
              </NavLink>
              <NavLink to={`/${tenantSlug}/batches`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
                Hot Accounts
              </NavLink>
              <NavLink to={`/${tenantSlug}/autonomous`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                Autonomous
              </NavLink>
              <NavLink to={`/${tenantSlug}/campaign`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Campaign
              </NavLink>
              <NavLink to={`/${tenantSlug}/meetings`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
                Meetings
              </NavLink>
              <NavLink to={`/${tenantSlug}/calendar`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"></path></svg>
                Review
              </NavLink>
              <NavLink to={`/${tenantSlug}/targets`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                Targets
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to={`/${tenantSlug}`} end>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
                Hot Accounts
              </NavLink>
              <NavLink to={`/${tenantSlug}/autonomous`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                Autonomous
              </NavLink>
            </>
          )}
          <NavLink to={`/${tenantSlug}/settings`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <span>{user?.email}</span>
          <button type="button" className="secondary" onClick={logout} style={{ width: '100%' }}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="content-header">
          <div className="breadcrumb-trail">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <span className="active-trail">{breadcrumbLabel}</span>
          </div>
          <div className="user-profile">
            <NotificationBell />
            <span className="user-email">{user?.email}</span>
            <div className="avatar-circle">
              {user?.email ? user.email[0].toUpperCase() : 'U'}
            </div>
          </div>
        </header>
        <div className="page-container">
          <Routes key={tenantSlug}>
            <Route path="" element={<TenantScope><Home /></TenantScope>} />
            <Route path="batches" element={<TenantScope><BatchList /></TenantScope>} />
            <Route path="batches/:batchId" element={<TenantScope><BatchDetail /></TenantScope>} />
            <Route path="autonomous" element={<TenantScope><Autonomous /></TenantScope>} />
            <Route path="companies" element={<TenantScope><Companies /></TenantScope>} />
            <Route path="campaign" element={<TenantScope><Outcomes /></TenantScope>} />
            <Route path="meetings" element={<TenantScope><Meetings /></TenantScope>} />
            <Route path="notifications" element={<TenantScope><Notifications /></TenantScope>} />
            <Route path="calendar" element={<TenantScope><Calendar /></TenantScope>} />
            <Route path="targets" element={<TenantScope><Targets /></TenantScope>} />
            <Route path="settings" element={<TenantScope><Settings /></TenantScope>} />
          </Routes>
        </div>
      </main>
      <ChatWidget />
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
