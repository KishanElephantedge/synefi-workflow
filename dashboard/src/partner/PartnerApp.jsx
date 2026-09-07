import { Navigate, Route, Routes, NavLink } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { setActiveTenant } from '../api/client'
import PartnerAccounts from './PartnerAccounts.jsx'
import PartnerAccountDetail from './PartnerAccountDetail.jsx'
import './partner.css'

// One entry per possible enabledFeatures value. Stage-by-stage rollout means this map only
// ever grows -- adding "content" here later is the whole job of shipping stage 2, nothing
// else in this file changes. extraRoutes are sub-pages that only exist because the feature
// itself is enabled (the account detail click-through has no reason to be reachable if
// "accounts" itself isn't) -- kept alongside the nav entry rather than registered separately,
// so enabling/disabling a feature can never leave an orphaned route reachable by URL alone.
const FEATURE_PAGES = {
  accounts: {
    label: 'Accounts', path: 'accounts', element: <PartnerAccounts />,
    extraRoutes: [{ path: 'accounts/:companyId', element: <PartnerAccountDetail /> }],
  },
}

export default function PartnerApp() {
  const { user, logout } = useTenant()
  const tenant = user?.tenant

  // Gate() already checks role === 'partner' before rendering this component, but a
  // partner user with no tenant assigned (shouldn't happen -- create_partner_user always
  // requires one -- but "shouldn't happen" is exactly when a null check earns its keep)
  // gets a clear message instead of a blank shell or a crash reading tenant.slug below.
  if (!tenant) {
    return (
      <div className="partnerShell">
        <div className="partnerMain">
          <p className="partnerEmptyFeatures">
            Your account has no workspace assigned yet. Contact Elephant Edge to get set up.
          </p>
        </div>
      </div>
    )
  }

  // Every tenant-scoped API call this shell makes needs to know which tenant it's talking to
  // -- set once here rather than in each page, so a new partner page never has to remember it.
  setActiveTenant(tenant.slug)

  const features = (tenant.enabledFeatures || []).filter((f) => FEATURE_PAGES[f])
  const firstFeature = features[0]

  return (
    <div className="partnerShell">
      <aside className="partnerSidebar">
        <div className="partnerBrand">
          Elephant Edge
          <span className="partnerTenantName">{tenant.name}</span>
        </div>

        <nav>
          {features.length === 0 ? (
            <p className="partnerEmptyFeatures">Nothing to show yet -- check back soon.</p>
          ) : (
            features.map((f) => (
              <NavLink
                key={f}
                to={`/partner/${FEATURE_PAGES[f].path}`}
                className={({ isActive }) => 'partnerNavLink' + (isActive ? ' partnerNavLinkActive' : '')}
              >
                {FEATURE_PAGES[f].label}
              </NavLink>
            ))
          )}
        </nav>

        <div className="partnerSidebarFooter">
          <button className="partnerLogoutBtn" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="partnerMain">
        <Routes>
          {features.map((f) => (
            <Route key={f} path={FEATURE_PAGES[f].path} element={FEATURE_PAGES[f].element} />
          ))}
          {features.flatMap((f) => FEATURE_PAGES[f].extraRoutes || []).map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route
            path="*"
            element={firstFeature ? <Navigate to={`/partner/${FEATURE_PAGES[firstFeature].path}`} replace /> : null}
          />
        </Routes>
      </main>
    </div>
  )
}
