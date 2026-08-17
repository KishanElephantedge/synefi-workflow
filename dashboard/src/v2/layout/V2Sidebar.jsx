import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext.jsx'
import { V2_NAV_GROUPS } from '../navConfig.js'
import { getJobsToBeDone, getOverridesEvals } from '../api.js'

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
        <div className="v2-brand-name">Elephant Edge</div>
        <div className="v2-brand-sub">Sales execution</div>
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
