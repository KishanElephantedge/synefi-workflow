import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listWebinars, formatApiError } from '../v2/api.js'

// Real webinars list (2026-09-29), grouped by status (live/upcoming/past) -- status is set by a
// human on the webinars table, not derived from a date this data doesn't reliably carry for
// every entry. Each card's sent/clicked counts are a live read of webinar_link_clicks via the
// list route's own _webinar_stats() call, so this updates as real sends/clicks happen -- no
// separate refresh mechanism needed beyond reloading the page, since there's no long-lived
// polling need for a page someone checks occasionally, not watches continuously.

const SECTION_DEF = [
  { key: 'live', title: 'Live now', blurb: 'Happening right now.' },
  { key: 'upcoming', title: 'Upcoming', blurb: 'Scheduled and invites may already be going out.' },
  { key: 'past', title: 'Past', blurb: 'Already happened -- final stats below.' },
]

function WebinarCard({ webinar, basePath }) {
  return (
    <Link to={`${basePath}/webinars/${webinar.id}`} className="partnerAccountCard">
      <div className="partnerAccountCardTop">
        <div>
          <div className="partnerAccountName">{webinar.title}</div>
          {webinar.speaker_name && <div className="partnerAccountDomain">with {webinar.speaker_name}</div>}
        </div>
      </div>
      <div className="partnerAccountFooter">
        <span className="partnerTag">{webinar.total_sent} sent</span>
        <span className="partnerTag partnerTagPrimary">{webinar.total_clicked} clicked</span>
        <span className="partnerAccountArrow">&rarr;</span>
      </div>
    </Link>
  )
}

export default function PartnerWebinars({ basePath }) {
  const [buckets, setBuckets] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listWebinars().then(setBuckets).catch(e => setError(formatApiError(e)))
  }, [])

  if (error) return <div className="partnerMain"><p className="partnerEmptyFeatures">{error}</p></div>
  if (!buckets) return <div className="partnerMain"><p className="partnerEmptyFeatures">Loading...</p></div>

  const total = SECTION_DEF.reduce((n, s) => n + (buckets[s.key]?.length || 0), 0)

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Webinars</h1>
        <p>Real invite performance, tracked from actual sends and link clicks.</p>
      </div>

      {total === 0 && <p className="partnerEmptyFeatures">No webinars yet.</p>}

      {SECTION_DEF.map(section => {
        const items = buckets[section.key] || []
        if (items.length === 0) return null
        return (
          <div key={section.key} style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '0.25rem' }}>{section.title} <span className="partnerFilterPillCount">{items.length}</span></h3>
            <p className="partnerAccountsHeaderP" style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--partner-muted, #666)' }}>{section.blurb}</p>
            <div className="partnerAccountGrid">
              {items.map(w => <WebinarCard key={w.id} webinar={w} basePath={basePath} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
