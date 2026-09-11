import { cloneElement } from 'react'
import { Navigate, Route, Routes, NavLink } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { setActiveTenant } from '../api/client'
import PartnerAccounts from './PartnerAccounts.jsx'
import PartnerAccountDetail from './PartnerAccountDetail.jsx'
import PartnerContent from './PartnerContent.jsx'
import PartnerSettings from './PartnerSettings.jsx'
import PartnerWorkspaceSwitcher from './PartnerWorkspaceSwitcher.jsx'
import './partner.css'

// One entry per possible enabledFeatures value. Stage-by-stage rollout means this map only
// ever grows -- extraRoutes are sub-pages that only exist because the feature itself is
// enabled (the account detail click-through has no reason to be reachable if "accounts" itself
// isn't) -- kept alongside the nav entry rather than registered separately, so enabling/
// disabling a feature can never leave an orphaned route reachable by URL alone.
const FEATURE_PAGES = {
  accounts: {
    label: 'Accounts', path: 'accounts', element: <PartnerAccounts />,
    extraRoutes: [{ path: 'accounts/:companyId', element: <PartnerAccountDetail /> }],
  },
  content: {
    label: 'LinkedIn Content', path: 'content', element: <PartnerContent />,
  },
}

// Placeholder-only sidebar entries (2026-09-11, explicit instruction) -- shown to every partner
// regardless of enabledFeatures, next to no real page, no route, and no click behavior. These
// exist purely to preview the module list from Majji's reference mockups before any of them are
// built; a plain, non-interactive div rather than a NavLink/Link makes that literal -- there is
// no href to navigate and no route for "*" to fall through to, so clicking one is structurally a
// no-op rather than a broken link.
const PLACEHOLDER_TABS = ['Proposals', 'Webinars', 'Newsletters']

// tenantOverride + basePath let an internal admin view a partner's real dashboard read-through
// their own logged-in session (see v2/AdminPartnerView.jsx) instead of needing a second login --
// gateway's proxy() already allows an internal user through to any tenant, so this is purely a
// frontend routing gap, not a new access grant. adminMode disables the one control
// (ProfileCard's name edit) that would otherwise silently edit the ADMIN's own account while
// looking at someone else's dashboard.
export default function PartnerApp({ tenantOverride, basePath = '/partner', adminMode = false }) {
  const { user, logout } = useTenant()
  const tenant = tenantOverride || user?.tenant

  // Gate() already checks role === 'partner' before rendering this component for a real partner
  // login, but a partner user with no tenant assigned (shouldn't happen -- create_partner_user
  // always requires one -- but "shouldn't happen" is exactly when a null check earns its keep)
  // gets a clear message instead of a blank shell or a crash reading tenant.slug below.
  if (!tenant) {
    return (
      <div className="partnerShell">
        <div className="partnerMain">
          <p className="partnerEmptyFeatures">
            Your account has no workspace assigned yet. Contact Fractional Partners to get set up.
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
  // Settings (profile + ICP) is a baseline capability, not a staged product feature -- it's
  // not gated by enabledFeatures the way "accounts" is, and stays available even before any
  // stage is turned on for a tenant.
  const defaultPath = firstFeature ? FEATURE_PAGES[firstFeature].path : 'settings'

  return (
    <div className="partnerShell">
      <aside className="partnerSidebar">
        <div className="partnerBrand">
          <div className="partnerBrandRow">
            <img src="/logo.png" alt="" className="partnerBrandLogo" />
            Fractional Partners
          </div>
          {/* Every partner Tenant.name is stored as "Partner — <name>" (helps internal admins
              spot partner tenants in the search/tenant list) -- stripped here since a partner
              looking at their own dashboard doesn't need to be told they're a partner. */}
          <span className="partnerTenantName">{tenant.name.replace(/^Partner\s*[—-]\s*/, '')}</span>
          {adminMode && <span className="partnerAdminBadge">Viewing as admin</span>}
          {adminMode && <PartnerWorkspaceSwitcher />}
        </div>

        <nav>
          {features.length === 0 && (
            <p className="partnerEmptyFeatures">Nothing to show yet -- check back soon.</p>
          )}
          {features.map((f) => (
            <NavLink
              key={f}
              to={`${basePath}/${FEATURE_PAGES[f].path}`}
              className={({ isActive }) => 'partnerNavLink' + (isActive ? ' partnerNavLinkActive' : '')}
            >
              {FEATURE_PAGES[f].label}
            </NavLink>
          ))}
          {PLACEHOLDER_TABS.map((label) => (
            <div key={label} className="partnerNavLink partnerNavLinkPlaceholder">
              {label}
            </div>
          ))}
          <NavLink
            to={`${basePath}/settings`}
            className={({ isActive }) => 'partnerNavLink' + (isActive ? ' partnerNavLinkActive' : '')}
          >
            Settings
          </NavLink>
        </nav>

        {!adminMode && (
          <div className="partnerSidebarFooter">
            <button className="partnerLogoutBtn" onClick={logout}>Log out</button>
          </div>
        )}
      </aside>

      <main className="partnerMain">
        <Routes>
          {features.map((f) => (
            <Route key={f} path={FEATURE_PAGES[f].path} element={cloneElement(FEATURE_PAGES[f].element, { basePath })} />
          ))}
          {features.flatMap((f) => FEATURE_PAGES[f].extraRoutes || []).map((r) => (
            <Route key={r.path} path={r.path} element={cloneElement(r.element, { basePath })} />
          ))}
          <Route path="settings" element={<PartnerSettings adminMode={adminMode} />} />
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </main>
    </div>
  )
}
