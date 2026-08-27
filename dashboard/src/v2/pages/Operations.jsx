import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Proposals from './Proposals.jsx'
import Autonomous from './Autonomous.jsx'
import Campaigns from './Campaigns.jsx'

// 2026-08-27, explicit instruction -- sidebar consolidation: Proposals, Autonomous, and
// Campaigns combined under one nav item. Each full existing page component is reused as-is
// (imported directly, no internal logic rewritten) -- this is purely a tab shell around them.
// Uses `section` (not `tab`) for its own query param since Crm.jsx already owns `tab` for its
// own companies/contacts sub-navigation, and Relationships.jsx (the other combined page) wraps
// that same Crm.jsx -- picking a distinct param name here avoids any collision between the two.
const SECTIONS = ['Proposals', 'Autonomous', 'Campaigns']
const SECTION_SLUGS = { proposals: 'Proposals', autonomous: 'Autonomous', campaigns: 'Campaigns' }

export default function Operations() {
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

      {section === 'Proposals' && <Proposals />}
      {section === 'Autonomous' && <Autonomous />}
      {section === 'Campaigns' && <Campaigns />}
    </div>
  )
}
