import { useLocation } from 'react-router-dom'
import { useV2Theme } from '../theme/V2ThemeContext.jsx'
import { IconSun, IconMoon, IconMenu } from '../icons.jsx'
import { V2_NAV_GROUPS } from '../navConfig.js'

const ALL_ITEMS = V2_NAV_GROUPS.flatMap(g => g.items)

function usePageTitle() {
  const location = useLocation()
  const segment = location.pathname.replace('/v2/', '').replace(/^\//, '').split('/')[0]
  const match = ALL_ITEMS.find(item => item.path === segment)
  return match ? match.label : 'Jobs to be done'
}

// Reference screenshots keep the workspace identity + user row in the sidebar footer, not the
// header (see V2Sidebar.jsx) -- the header stays minimal: current page + theme toggle + the
// mobile nav trigger.
export default function V2Header({ onMenuClick }) {
  const { theme, toggleTheme } = useV2Theme()
  const title = usePageTitle()

  return (
    <header className="v2-header">
      <div className="v2-header-left">
        <button type="button" className="v2-menu-toggle" onClick={onMenuClick} aria-label="Open navigation">
          <IconMenu width={18} height={18} />
        </button>
        <span className="v2-header-title">{title}</span>
      </div>
      <div className="v2-header-right">
        <button
          type="button"
          className="v2-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
        </button>
      </div>
    </header>
  )
}
