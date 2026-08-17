import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobsToBeDone, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

// Priority order is the Approved-decisions ordering (audit-grounded, not invented): blocking
// deal work first, then a real high-intent flag, then missing information blocking an otherwise
// real account, then lower-urgency topic-level signals. "Calls to make" has no real qualifying
// data in this backend yet (see category_status.calls_to_make.reason from the API) -- shown
// last, honestly, rather than leading with an empty state.
const DISPLAY_ORDER = ['deal_needs_you', 'hot_leads_to_review', 'contacts_to_find', 'worth_engaging', 'calls_to_make']

const CATEGORY_LABEL = {
  deal_needs_you: 'Deal needs you',
  hot_leads_to_review: 'Hot leads to review',
  contacts_to_find: 'Contacts to find',
  worth_engaging: 'Worth engaging',
  calls_to_make: 'Calls to make',
}

function JobCard({ item }) {
  return (
    <Link to={item.action_route} className="v2-card" style={{ marginBottom: '0.8rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{item.title}</span>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: '0.3rem', marginBottom: item.reason ? '0.5rem' : 0 }}>{item.description}</p>
      {item.reason && (
        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--v2-border)' }}>
          <div className="v2-kv-label">Reason</div>
          <div className="v2-evidence-item-body">{item.reason}</div>
        </div>
      )}
    </Link>
  )
}

function CategorySection({ category, items, status }) {
  return (
    <div style={{ marginBottom: '1.6rem' }}>
      <div className="v2-page-head" style={{ marginBottom: '0.8rem' }}>
        <h2 className="v2-page-title" style={{ fontSize: '1.05rem' }}>
          {CATEGORY_LABEL[category]} <span className="v2-badge v2-badge-neutral" style={{ marginLeft: 6 }}>{status.count}</span>
        </h2>
      </div>

      {!status.available ? (
        <div className="v2-card">
          <div className="v2-config-card-head">
            <span className="v2-config-card-title">Not available yet</span>
          </div>
          <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{status.reason}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">Nothing here right now.</div>
        </div>
      ) : (
        items.map(item => <JobCard key={`${item.source_type}-${item.source_id}`} item={item} />)
      )}
    </div>
  )
}

// The action-guidance layer: "what should the operator work on next," composed live from four
// real, already-computed backend signals (execution_readiness.py, Company.hot_lead, decision-
// maker research state, GtmSignal/InterpretedSignal) -- see the backend module's own docstring
// for exactly what each category reuses. Nothing is fabricated: an empty/unavailable category
// says so honestly (see "Calls to make" below) rather than showing invented items. Priority is
// communicated only by section order + real recency within each section -- no per-item HIGH/
// MEDIUM/LOW severity is shown, since no real scoring model exists to back one.
export default function JobsToBeDone() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getJobsToBeDone().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  return (
    <div>
      <div style={{ marginBottom: 'var(--v2-space-5)' }}>
        <p className="v2-placeholder-note" style={{ marginTop: '0.4rem' }}>
          The highest-priority actions requiring attention today, derived from real pipeline,
          account, and signal state -- not a generated summary.
        </p>
      </div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load jobs to be done: {error}</div>
          </div>
        </div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : (
        DISPLAY_ORDER.map(category => (
          <CategorySection
            key={category}
            category={category}
            items={data.items.filter(i => i.category === category)}
            status={data.category_status[category]}
          />
        ))
      )}
    </div>
  )
}
