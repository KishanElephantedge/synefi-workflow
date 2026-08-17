import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPipeline, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft, IconChevronRight } from '../icons.jsx'

const PAGE_SIZE = 20

// execution.status -> badge tone. Reuses the EXACT vocabulary get_next_execution_action()
// already defines (Batch 13) -- deliberately not the reference deck's "Top of funnel / Content /
// Mid-funnel / Bottom of funnel" tab labels, since those don't correspond to any persisted
// backend concept (see Phase 3 report's "screenshot ambiguity" note: inventing stage tabs to
// match that layout would violate Part 15's explicit "do not invent pipeline stages").
const EXECUTION_BADGE = {
  strategy_required: 'v2-badge-neutral',
  insufficient_context: 'v2-badge-neutral',
  blocked: 'v2-badge-warning',
  message_generation_available: 'v2-badge-info',
  message_insufficient_context: 'v2-badge-neutral',
  message_blocked_by_quality_gate: 'v2-badge-warning',
  ready_for_review: 'v2-badge-info',
  approved: 'v2-badge-success',
  message_rejected: 'v2-badge-danger',
  message_changes_requested: 'v2-badge-warning',
}

const EXECUTION_LABEL = {
  strategy_required: 'Strategy required',
  insufficient_context: 'Insufficient context',
  blocked: 'Blocked',
  message_generation_available: 'Ready to draft',
  message_insufficient_context: 'Draft insufficient',
  message_blocked_by_quality_gate: 'Draft needs review',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
  message_rejected: 'Rejected',
  message_changes_requested: 'Changes requested',
}

function PipelineCard({ item }) {
  const exec = item.execution
  return (
    <Link to={`/v2/pipeline/${item.opportunity_id}`} className="v2-card" style={{ marginBottom: '1rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{item.company_name || 'Unnamed account'}</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {exec.requires_human_review && <span className="v2-badge v2-badge-danger">Needs you</span>}
          <span className={`v2-badge ${EXECUTION_BADGE[exec.status] || 'v2-badge-neutral'}`}>
            {EXECUTION_LABEL[exec.status] || exec.status}
          </span>
        </div>
      </div>

      <p className="v2-placeholder-note" style={{ marginTop: '0.4rem' }}>{item.opportunity_statement}</p>

      <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
        <div>
          <div className="v2-kv-label">Problem</div>
          <div className="v2-evidence-item-body">{item.problem_statement || '—'}</div>
        </div>
        <div>
          <div className="v2-kv-label">Demand</div>
          <div className="v2-evidence-item-body">{item.demand_statement || '—'}</div>
        </div>
        <div>
          <div className="v2-kv-label">Strategy</div>
          <div className="v2-evidence-item-body">{item.strategy?.strategy_type || 'Not yet generated'}</div>
        </div>
        <div>
          <div className="v2-kv-label">Offering fit</div>
          <div className="v2-evidence-item-body">{item.strategy?.matched_offering_name || item.strategy?.offering_fit_status || '—'}</div>
        </div>
        <div>
          <div className="v2-kv-label">GTM motion</div>
          <div className="v2-evidence-item-body">{item.gtm_motion?.primary_motion || (item.gtm_motion?.status === 'recommended' ? '—' : 'Not recommended yet')}</div>
        </div>
      </div>

      <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid var(--v2-border)' }}>
        <div className="v2-kv-label">Next action</div>
        <div style={{ color: 'var(--v2-text)', fontSize: '0.88rem', marginTop: 2 }}>
          {(exec.action || 'None').toString().replace(/_/g, ' ')}
        </div>
        {exec.reason && <p className="v2-placeholder-note" style={{ marginBottom: 0, marginTop: 4 }}>{exec.reason}</p>}
      </div>
    </Link>
  )
}

// Answers "what opportunities/accounts need attention and what should happen next" -- every
// item is an existing Opportunity enriched with its already-computed strategy/readiness/
// execution state (Batch 4/5/6/13), never a re-derived score. Read/review only in this phase
// (Part 5): no send, no approve, no autonomous action anywhere on this page.
export default function Pipeline() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPipeline({ page, pageSize: PAGE_SIZE })
      .then(data => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      })
      .catch(err => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load the pipeline: {error}</div>
          </div>
        </div>
      ) : loading ? (
        <div className="v2-account-list">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 160 }} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">
            No Opportunities exist yet for this tenant. Opportunities are opened automatically once Problem
            and Demand evidence for an account reach the eligibility bar (Batch 4) -- this list will populate
            as that evidence accumulates.
          </div>
        </div>
      ) : (
        <>
          {items.map(item => <PipelineCard key={item.opportunity_id} item={item} />)}
          {totalPages > 1 && (
            <div className="v2-pagination">
              <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Previous page">
                <IconChevronLeft width={14} height={14} />
              </button>
              <span>Page {page} of {totalPages} · {total} opportunities</span>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} aria-label="Next page">
                <IconChevronRight width={14} height={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
