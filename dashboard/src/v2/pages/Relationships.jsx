import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Crm from './Crm.jsx'
import Inbound from './Inbound.jsx'
import Network from './Network.jsx'

// 2026-08-27, explicit instruction -- sidebar consolidation: CRM, Inbound, and Network combined
// under one nav item. Each full existing page component is reused as-is (imported directly, no
// internal logic rewritten) -- this is purely a tab shell around them. Uses `section` (not `tab`)
// for its own query param since Crm.jsx already owns `tab` for its own companies/contacts
// sub-navigation -- a distinct param name here avoids any collision with that.
const SECTIONS = ['CRM', 'Inbound', 'Network']
const SECTION_SLUGS = { crm: 'CRM', inbound: 'Inbound', network: 'Network' }

export default function Relationships() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState(SECTION_SLUGS[searchParams.get('section')] || SECTIONS[0])

  return (
    <div>
      <div className="v2-config-tabs">
        {SECTIONS.map(s => (
          <button key={s} type="button" className={`v2-config-tab${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>
            {s}
          </button>
        ))}
      </div>

      {section === 'CRM' && <Crm />}
      {section === 'Inbound' && <Inbound />}
      {section === 'Network' && <Network />}
    </div>
  )
}
