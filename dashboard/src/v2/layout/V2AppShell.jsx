import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import V2Sidebar from './V2Sidebar.jsx'
import V2Header from './V2Header.jsx'
import { useV2Theme } from '../theme/V2ThemeContext.jsx'
import '../v2.css'

// Root of the V2 experience. The theme attribute lives on THIS element, not on <html>/<body>,
// so V2's dark-first tokens (v2.css) never leak outside routes rendered under /v2 -- V1 keeps
// using its own :root tokens (index.css) completely independently.
export default function V2AppShell() {
  const { theme } = useV2Theme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="v2-shell" data-v2-theme={theme}>
      <div className="v2-app-shell">
        <V2Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <div
          className={`v2-sidebar-scrim${mobileNavOpen ? ' v2-scrim-visible' : ''}`}
          onClick={() => setMobileNavOpen(false)}
        />
        <div className="v2-main">
          <V2Header onMenuClick={() => setMobileNavOpen(open => !open)} />
          <main className="v2-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
