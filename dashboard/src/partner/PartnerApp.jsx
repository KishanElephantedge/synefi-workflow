import { cloneElement, useEffect, useState } from 'react'
import { Navigate, Route, Routes, NavLink } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { setActiveTenant } from '../api/client'
import { getFeatureReadiness } from '../v2/api.js'
import PartnerAccounts from './PartnerAccounts.jsx'
import PartnerAccountDetail from './PartnerAccountDetail.jsx'
import CrmLeads from './CrmLeads.jsx'
import PartnerContent from './PartnerContent.jsx'
import PartnerContentDraft from './PartnerContentDraft.jsx'
import PartnerWebinars from './PartnerWebinars.jsx'
import PartnerWebinarDetail from './PartnerWebinarDetail.jsx'
import PartnerEmailCampaigns from './PartnerEmailCampaigns.jsx'
import PartnerEmailCampaignDetail from './PartnerEmailCampaignDetail.jsx'
import PartnerInternalTasks from './PartnerInternalTasks.jsx'
import PartnerSettings from './PartnerSettings.jsx'
import RequestAccess from './RequestAccess.jsx'
import PartnerWorkspaceSwitcher from './PartnerWorkspaceSwitcher.jsx'
import { PartnerThemeProvider, usePartnerTheme } from './PartnerThemeContext.jsx'
import { IconSun, IconMoon } from '../v2/icons.jsx'
import './partner.css'

// One entry per possible enabledFeatures value. Stage-by-stage rollout means this map only
// ever grows -- extraRoutes are sub-pages that only exist because the feature itself is
// enabled (the account detail click-through has no reason to be reachable if "accounts" itself
// isn't) -- kept alongside the nav entry rather than registered separately, so enabling/
// disabling a feature can never leave an orphaned route reachable by URL alone.
const FEATURE_PAGES = {
  accounts: {
    label: 'Accounts', path: 'accounts', element: <PartnerAccounts />,
    description: 'The companies and contacts sourced against your ICP.',
    // Engagement mining's leads live in this SAME list, behind a source filter (2026-09-22,
    // explicit correction -- a first version put them on their own sidebar tab; "I never told
    // you to separate that into a different tab... add filters, All and these two" is the real
    // instruction). :accountId is the account.jsx generic id (e.g. "company:1616" or
    // "engagement:42"), not a companyId -- PartnerAccountDetail dispatches on the prefix.
    extraRoutes: [{ path: 'accounts/:accountId', element: <PartnerAccountDetail /> }],
  },
  content: {
    label: 'LinkedIn Content', path: 'content', element: <PartnerContent />,
    description: 'Trending topics and drafts for your own LinkedIn voice.',
    // Full-page drafting (2026-10-12, explicit instruction): the slide-over drawer was too
    // small for actually reviewing/editing a draft -- "Generate Draft" now navigates here
    // instead of opening the drawer, same click-through pattern as the accounts detail route.
    extraRoutes: [{ path: 'content/draft', element: <PartnerContentDraft /> }],
  },
  // Sandy Yu's webinar outreach CRM (2026-09-23) -- her own stated pain point (per Slack): no
  // structured way to see where each outreach target is in the process. Gated behind its own
  // "crm" enabledFeatures flag, not tied to "accounts", since this is a per-partner opt-in
  // built for one specific engagement, not a stage-1 default.
  crm: {
    label: 'Data', path: 'crm', element: <CrmLeads />,
    description: 'Your uploaded lead lists, enriched and scored.',
  },
  // Real webinars tab (2026-09-29, explicit instruction) -- was a non-interactive placeholder
  // (see PLACEHOLDER_TABS below) until now. Shows real invite performance -- sent/clicked counts
  // straight from webinar_link_clicks, the same table scripts/send_webinar_invites.py writes to
  // on every real send. Its own flag, not tied to "accounts" -- built for one specific campaign
  // (Majji's), not a stage-1 default every partner should see yet.
  webinars: {
    label: 'Webinars', path: 'webinars', element: <PartnerWebinars />,
    description: 'Invite performance for your webinar campaigns.',
    extraRoutes: [{ path: 'webinars/:webinarId', element: <PartnerWebinarDetail /> }],
  },
  // Real Smartlead campaign stats (2026-10-05) for a partner's own campaigns. Key MUST match
  // the backend feature registry's Feature.key exactly (app/gtm_os/features/registry.py) --
  // every other key here already does (accounts/content/crm/webinars); this one was originally
  // written as camelCase ("emailCampaigns") and silently didn't match "email_campaigns", which
  // is why this nav item vanished after the 2026-10-07/08 feature-registry refactor replaced
  // the hardcoded Majji-only backend route with one gated on tenant.enabled_features (found
  // live 2026-10-12 as a 404 on /email-campaigns -- the backend 404'd because the feature
  // wasn't actually enabled under its real key, not a routing bug).
  email_campaigns: {
    label: 'Email', path: 'email-campaigns', element: <PartnerEmailCampaigns />,
    description: 'Your email campaign sends, opens, and replies.',
    extraRoutes: [{ path: 'email-campaigns/:campaignId', element: <PartnerEmailCampaignDetail /> }],
  },
  // Internal-only (2026-10-16, explicit instruction: "this will be only visible to us... and
  // that partners shouldnt see this as this is for internal"). internalOnly marks a tab allTabs
  // (below) must drop whenever adminMode is false -- i.e. a real partner login never sees this
  // entry in FEATURE_PAGES at all, regardless of whether "internal_tasks" is in their own
  // enabledFeatures. The backend enforces the same boundary independently (x-internal-user,
  // see app/routes/api.py's _require_internal_viewer) -- this is belt-and-suspenders, not the
  // only guard, since a frontend-only hide is never real security on its own.
  internal_tasks: {
    label: 'Internal Tasks', path: 'internal-tasks', element: <PartnerInternalTasks />,
    description: 'What we owe this partner and what they owe us.',
    internalOnly: true,
  },
}

// Placeholder-only sidebar entries (2026-09-11, originally explicit instruction to show them as
// non-interactive). CHANGED 2026-10-12, explicit instruction, generalized for every partner: a
// tab without a real page yet should still be clickable and open a real "Request Access" page
// (heading, subheading, a button that notifies Elephant Edge) instead of being a dead div. No
// `element`/`path` here because there is no real page behind these yet -- RequestAccess is
// rendered for ANY feature key that isn't in the partner's own enabledFeatures, whether it's one
// of these placeholders or a real FEATURE_PAGES entry they just haven't been enabled for.
const PLACEHOLDER_TABS = [
  { key: 'proposals', label: 'Proposals', description: 'Generate and track proposals for your prospects.' },
  { key: 'newsletters', label: 'Newsletters', description: 'Draft and send newsletters to your list.' },
]

// "accounts" is deliberately exempt from the readiness check every other feature gets
// (2026-10-12): its backend "ready" state requires a real partner_icp, but real account data
// can exist without one -- Paul Foreman's 124 accounts came from a direct import, bypassing the
// ICP-driven sourcing pipeline entirely, and he genuinely has something real to see on that tab
// even though no ICP was ever set for him. Every other feature's real page can actually render
// broken/empty without its own config (content/email_campaigns both did, live), so those stay
// gated on readiness -- not ready, or still loading (readiness === null), shows Request Access.
function isTabReady(key, enabledFeatures, readiness) {
  if (!enabledFeatures.includes(key)) return false
  // Same exemption as "accounts": no per-tenant config exists for this feature to be "ready"
  // against, so there is nothing for a readiness check to ever confirm.
  if (key === 'accounts' || key === 'internal_tasks') return true
  return Boolean(readiness?.[key]?.ready)
}

// tenantOverride + basePath let an internal admin view a partner's real dashboard read-through
// their own logged-in session (see v2/AdminPartnerView.jsx) instead of needing a second login --
// gateway's proxy() already allows an internal user through to any tenant, so this is purely a
// frontend routing gap, not a new access grant. adminMode disables the one control
// (ProfileCard's name edit) that would otherwise silently edit the ADMIN's own account while
// looking at someone else's dashboard.
// Theme toggle shown in the sidebar footer -- same icon pair and on/off logic as V2Header's,
// just not sharing the component since the partner shell has no header bar to put it in.
function PartnerThemeToggle() {
  const { theme, toggleTheme } = usePartnerTheme()
  return (
    <button
      type="button"
      className="partnerThemeToggle"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
    </button>
  )
}

export default function PartnerApp(props) {
  return (
    <PartnerThemeProvider>
      <PartnerAppInner {...props} />
    </PartnerThemeProvider>
  )
}

function PartnerAppInner({ tenantOverride, basePath = '/partner', adminMode = false }) {
  const { user, logout } = useTenant()
  const tenant = tenantOverride || user?.tenant
  const { theme } = usePartnerTheme()
  // {key: {enabled, ready}} -- fetched once per tenant. null while loading, which the route
  // gate below treats as "not ready yet" (same safe-default direction as everything else here:
  // show Request Access rather than risk rendering a real page before we know it actually
  // works). Declared before the early `!tenant` return so hook order never changes between
  // renders.
  const [readiness, setReadiness] = useState(null)

  useEffect(() => {
    if (!tenant?.slug) return
    setReadiness(null)
    getFeatureReadiness().then(setReadiness).catch(() => setReadiness({}))
  }, [tenant?.slug])

  // Gate() already checks role === 'partner' before rendering this component for a real partner
  // login, but a partner user with no tenant assigned (shouldn't happen -- create_partner_user
  // always requires one -- but "shouldn't happen" is exactly when a null check earns its keep)
  // gets a clear message instead of a blank shell or a crash reading tenant.slug below.
  if (!tenant) {
    return (
      <div className="partnerShell" data-partner-theme={theme}>
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

  // Every tab is now clickable (2026-10-12, explicit instruction, generalized for every
  // partner): a key the partner HAS gets its real page+route; a key they don't gets the SAME
  // RequestAccess page+route, just scoped to that feature's own label/description. One list
  // drives both the nav AND the routes, so a tab can never silently exist in one but not the
  // other -- the exact failure mode the old PLACEHOLDER_TABS (plain divs, no route at all) and
  // FEATURE_PAGES (route only if enabled) split caused when they were two different lists.
  // internalOnly entries are dropped entirely outside adminMode -- not shown as a locked/
  // RequestAccess tab either, just absent, so a partner's own login has no way to discover
  // this page exists at all (not in the nav list, and its route below is never registered).
  const allTabs = [
    ...Object.entries(FEATURE_PAGES)
      .filter(([, page]) => !page.internalOnly || adminMode)
      .map(([key, page]) => ({ key, ...page })),
    ...PLACEHOLDER_TABS.map((t) => ({ ...t, path: t.key, extraRoutes: [] })),
  ]

  return (
    <div className="partnerShell" data-partner-theme={theme}>
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
          {allTabs.map((tab) => (
            <NavLink
              key={tab.key}
              to={`${basePath}/${tab.path}`}
              className={({ isActive }) => 'partnerNavLink' + (isActive ? ' partnerNavLinkActive' : '')}
            >
              {tab.label}
            </NavLink>
          ))}
          <NavLink
            to={`${basePath}/settings`}
            className={({ isActive }) => 'partnerNavLink' + (isActive ? ' partnerNavLinkActive' : '')}
          >
            Settings
          </NavLink>
        </nav>

        <div className="partnerSidebarFooter">
          <PartnerThemeToggle />
          {!adminMode && (
            <button className="partnerLogoutBtn" onClick={logout}>Log out</button>
          )}
        </div>
      </aside>

      <main className="partnerMain">
        <Routes>
          {allTabs.map((tab) => (
            <Route
              key={tab.key}
              path={tab.path}
              element={
                isTabReady(tab.key, features, readiness)
                  ? cloneElement(tab.element, { basePath })
                  : <RequestAccess featureKey={tab.key} label={tab.label} />
              }
            />
          ))}
          {features.flatMap((f) => FEATURE_PAGES[f].extraRoutes || []).map((r) => (
            <Route key={r.path} path={r.path} element={cloneElement(r.element, { basePath })} />
          ))}
          <Route path="settings" element={<PartnerSettings adminMode={adminMode} />} />
          {/* Absolute, not `to={defaultPath}`. A relative Navigate on the catch-all resolves
              against the UNMATCHED url, so /accounts on a tenant without that feature became
              /accounts/settings, which also doesn't match, which became /accounts/settings/settings
              -- an infinite loop (found live 2026-09-13: one page visit, 1,684 redirects). */}
          <Route path="*" element={<Navigate to={`${basePath}/${defaultPath}`} replace />} />
        </Routes>
      </main>
    </div>
  )
}
