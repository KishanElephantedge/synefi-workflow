import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'

// Admin-mode equivalent of V2Sidebar's V2WorkspaceSwitcher, deliberately NOT the same component:
// that one imports v2.css for V2's dark theme, and V2AppShell's own comment is explicit that
// v2.css must never leak outside /v2 routes. This is styled with partner.css's own light tokens
// instead, so switching between partners while admin-viewing never flashes/bleeds V2 theming.
export default function PartnerWorkspaceSwitcher() {
  const { tenants } = useTenant()
  const { tenantSlug } = useParams()
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
    <div className="partnerWorkspaceSwitcher" ref={dropdownRef}>
      <div className="partnerWorkspaceTrigger" onClick={() => setIsOpen(!isOpen)}>
        <span>Switch workspace</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {isOpen && (
        <div className="partnerWorkspaceDropdown">
          <div
            className="partnerWorkspaceOption"
            onClick={() => { navigate('/v2'); setIsOpen(false) }}
          >
            Elephant Edge V2
          </div>
          {tenants.filter((t) => t.slug !== 'elephant-edge' && t.slug !== 'synefi').map((t) => (
            <div
              key={t.slug}
              className={`partnerWorkspaceOption${t.slug === tenantSlug ? ' selected' : ''}`}
              onClick={() => { navigate(`/v2/partner-view/${t.slug}`); setIsOpen(false) }}
            >
              {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
