import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBriefingGovernance, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft } from '../icons.jsx'
import { CheckRow, CATEGORY_LINK, STAGE_LINK } from '../briefingHelpers.jsx'

// One field per category, all real (Batch 14's own evaluate_gtm_governance() output) -- this
// page never recomputes anything, it just re-fetches the same governance readout Briefing.jsx
// uses and shows one category's list in full, untruncated (unlike the 3-item preview there).
const CATEGORY_META = {
  attention: { title: 'Needs your attention', field: 'human_attention' },
  configuration: { title: 'Configuration gaps', field: 'configuration_gaps' },
  data: { title: 'Data gaps', field: 'data_gaps' },
  operational: { title: 'Operational issues', field: 'operational_issues' },
}

export default function BriefingCategoryDetail() {
  const { category } = useParams()
  const [gov, setGov] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getBriefingGovernance().then(setGov).catch(err => setError(formatApiError(err)))
  }, [])

  const meta = CATEGORY_META[category]
  const items = gov ? (gov[meta?.field] || []) : null

  return (
    <div>
      <Link to="/v2/briefing" className="v2-back-link"><IconChevronLeft width={14} height={14} /> Back to Briefing</Link>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 650, color: 'var(--v2-text)', margin: '0 0 1.2rem' }}>
        {meta?.title || 'Not found'} {items && <span className="v2-badge v2-badge-neutral">{items.length}</span>}
      </h2>

      {!meta ? (
        <div className="v2-card"><div className="v2-state">Unknown category.</div></div>
      ) : error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load governance: {error}</div>
          </div>
        </div>
      ) : gov === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 300 }} />
      ) : items.length === 0 ? (
        <div className="v2-card"><div className="v2-state">Nothing in this category right now.</div></div>
      ) : category === 'attention' ? (
        items.map((item, i) => (
          <CheckRow key={i} severity={item.category === 'operational' ? 'danger' : 'warning'} description={item.description} link={CATEGORY_LINK[item.category]} maxLength={2000} />
        ))
      ) : category === 'configuration' ? (
        items.map((gap, i) => (
          <CheckRow key={i} severity="warning" description={gap.description} meta={`source: ${gap.source}`} link={STAGE_LINK[gap.relates_to_stage] || CATEGORY_LINK.configuration} maxLength={2000} />
        ))
      ) : category === 'data' ? (
        items.map((gap, i) => (
          <CheckRow key={i} severity="warning" description={`${gap.missing_count}/${gap.denominator} companies missing ${gap.field}`} meta={`source: ${gap.source}`} link={CATEGORY_LINK.data} maxLength={2000} />
        ))
      ) : (
        items.map((issue, i) => (
          <CheckRow key={i} severity="danger" description={issue.error_message} meta={`run #${issue.run_id} · ${issue.started_at ? new Date(issue.started_at).toLocaleString() : ''}`} maxLength={4000} />
        ))
      )}
    </div>
  )
}
