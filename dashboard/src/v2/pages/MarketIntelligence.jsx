import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MarketTrends from './MarketTrends.jsx'
import ContentStrategy from './ContentStrategy.jsx'

// 2026-08-28, explicit instruction -- Market Intelligence and Content were one long scrolling
// page; split into tabs, same shell pattern as Operations.jsx/Relationships.jsx. Uses `section`
// (not `tab`) for the same reason Operations.jsx does -- avoids colliding with any nested page's
// own `tab` param.
const SECTIONS = ['Trends', 'Content']
const SECTION_SLUGS = { trends: 'Trends', content: 'Content' }

export default function MarketIntelligence() {
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

      {section === 'Trends' && <MarketTrends />}
      {section === 'Content' && <ContentStrategy />}
    </div>
  )
}
