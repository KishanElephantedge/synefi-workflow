import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext.jsx'
import { V2_NAV_GROUPS } from '../navConfig.js'
import { getJobsToBeDone, getOverridesEvals } from '../api.js'

// Mirrors V1's TenantSwitcher (App.jsx) so the same "Workspace" dropdown reachable from V1
// is also reachable from inside V2: real tenants come from useTenant() (unchanged), plus one
// extra static "Elephant Edge V2" row appended right after the real "Elephant Edge" entry --
// same convention App.jsx's TenantSwitcher already uses. Picking a real tenant navigates to
// /:slug (leaving V2 entirely, mounting V1's AppShell); picking "Elephant Edge V2" just closes
// the menu since we're already there.
function V2WorkspaceSwitcher() {
  const { tenants } = useTenant()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="v2-workspace-switcher" ref={dropdownRef}>
      <div
        className={`v2-workspace-trigger${isOpen ? ' open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div>
          <div className="v2-brand-name">Elephant Edge V2</div>
          <div className="v2-brand-sub">Sales execution</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {isOpen && (
        <div className="v2-workspace-dropdown">
          {tenants.map(t => (
            <div key={t.slug}>
              <div
                className="v2-workspace-option"
                onClick={() => {
                  navigate(`/${t.slug}`)
                  setIsOpen(false)
                }}
              >
                {t.name}
              </div>
              {t.slug === 'elephant-edge' && (
                <div className="v2-workspace-option selected" onClick={() => setIsOpen(false)}>
                  Elephant Edge V2
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Real, live sidebar badge counts -- fetched once on mount, never hardcoded. "jobs" sums every
// AVAILABLE Jobs to Be Done category's real count (skipping "calls_to_make", which is always
// reported unavailable -- see jobs_to_be_done.py). "overridesEvals" is the real candidate-pattern
// count, since that's the one number on that page that genuinely needs attention. Only rendered
// once data has actually loaded (null = not shown yet), never a placeholder/invented number.
function useNavCounts() {
  const [counts, setCounts] = useState({ jobs: null, overridesEvals: null })

  useEffect(() => {
    getJobsToBeDone()
      .then(data => {
        const total = Object.values(data.category_status)
          .filter(s => s.available)
          .reduce((sum, s) => sum + s.count, 0)
        setCounts(prev => ({ ...prev, jobs: total }))
      })
      .catch(() => {})
    getOverridesEvals()
      .then(data => setCounts(prev => ({ ...prev, overridesEvals: data.candidate_patterns.length })))
      .catch(() => {})
  }, [])

  return counts
}

export default function V2Sidebar({ open, onNavigate }) {
  const { user, logout } = useTenant()
  const counts = useNavCounts()

  return (
    <aside className={`v2-sidebar${open ? ' v2-sidebar-open' : ''}`}>
      <div className="v2-brand">
        <V2WorkspaceSwitcher />
      </div>

      <nav className="v2-nav">
        {V2_NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="v2-nav-group-label">{group.label}</div>
            <div className="v2-nav-items">
              {group.items.map(item => {
                const Icon = item.icon
                const count = item.countKey ? counts[item.countKey] : null
                return (
                  <NavLink
                    key={item.path}
                    to={`/v2/${item.path}`}
                    className={({ isActive }) => `v2-nav-item${isActive ? ' active' : ''}`}
                    onClick={onNavigate}
                  >
                    <Icon width={16} height={16} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {count != null && <span className="v2-nav-count">{count}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="v2-sidebar-footer">
        <div className="v2-user-row">
          <div className="v2-avatar">{user?.email ? user.email[0].toUpperCase() : 'U'}</div>
          <span className="v2-user-email">{user?.email}</span>
        </div>
        <button type="button" className="v2-nav-item" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>
      </div>
    </aside>
  )
}
