import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { V2ThemeProvider } from './theme/V2ThemeContext.jsx'
import { setActiveTenant } from '../api/client'
import V2AppShell from './layout/V2AppShell.jsx'
import JobsToBeDone from './pages/JobsToBeDone.jsx'
import Briefing from './pages/Briefing.jsx'
import BriefingCategoryDetail from './pages/BriefingCategoryDetail.jsx'
import Meetings from './pages/Meetings.jsx'
import Pipeline from './pages/Pipeline.jsx'
import RevenuePace from './pages/RevenuePace.jsx'
import Efficiency from './pages/Efficiency.jsx'
import OverridesEvals from './pages/OverridesEvals.jsx'
import OpportunityDetail from './pages/OpportunityDetail.jsx'
import Accounts from './pages/Accounts.jsx'
import AccountDetail from './pages/AccountDetail.jsx'
import DemandGrid from './pages/DemandGrid.jsx'
import MarketIntelligence from './pages/MarketIntelligence.jsx'
import Network from './pages/Network.jsx'
import IcpOfferings from './pages/IcpOfferings.jsx'
import Knowledge from './pages/Knowledge.jsx'
import Settings from './pages/Settings.jsx'

// Isolated V2 route tree, mounted at /v2/* from the existing App.jsx (see that file's Gate()).
// Reuses the existing auth gate (a user must already be logged in to reach here, same as V1) but
// owns its own layout, theme, and nav entirely -- nothing here renders V1's AppShell/App.css.
export default function V2App() {
  // V2 is an Elephant-Edge-only product (no tenant switcher of its own, unlike V1's AppShell).
  // The shared api client only tenant-scopes a request once setActiveTenant() has been called
  // for this browser session -- V1's TenantScope does that per-route; V2 has no equivalent
  // wrapper, so it's set once here instead, reusing the exact same client-level mechanism.
  useEffect(() => {
    setActiveTenant('elephant-edge')
  }, [])

  return (
    <V2ThemeProvider>
      <Routes>
        <Route element={<V2AppShell />}>
          <Route index element={<Navigate to="briefing" replace />} />
          <Route path="jobs" element={<JobsToBeDone />} />
          <Route path="briefing" element={<Briefing />} />
          <Route path="briefing/:category" element={<BriefingCategoryDetail />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="revenue-pace" element={<RevenuePace />} />
          <Route path="efficiency" element={<Efficiency />} />
          <Route path="overrides-evals" element={<OverridesEvals />} />
          <Route path="pipeline/:opportunityId" element={<OpportunityDetail />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:companyId" element={<AccountDetail />} />
          <Route path="demand-grid" element={<DemandGrid />} />
          <Route path="market-intelligence" element={<MarketIntelligence />} />
          <Route path="network" element={<Network />} />
          <Route path="icps-offerings" element={<IcpOfferings />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="briefing" replace />} />
        </Route>
      </Routes>
    </V2ThemeProvider>
  )
}
