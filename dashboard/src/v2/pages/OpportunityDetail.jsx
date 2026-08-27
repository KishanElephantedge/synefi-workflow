import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext.jsx'
import { getPipelineItem, getAccountBrief, getAccountMessages, reviewMessageDraft, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft, IconCheck } from '../icons.jsx'

const TABS = ['Overview', 'GTM Context', 'Deal Strategy', 'Message Review']

const MESSAGE_STATUS_LABEL = {
  insufficient_context: 'Insufficient context',
  draft: 'Draft — needs review',
  ready_for_review: 'Draft — Not approved',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
}

const MESSAGE_STATUS_BADGE = {
  insufficient_context: 'v2-badge-neutral',
  draft: 'v2-badge-warning',
  ready_for_review: 'v2-badge-warning',
  approved: 'v2-badge-success',
  rejected: 'v2-badge-danger',
  changes_requested: 'v2-badge-warning',
}

function EmptyNote({ children }) {
  return <p className="v2-placeholder-note">{children}</p>
}

function KV({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value">{value ?? '—'}</div>
    </div>
  )
}

// ---------- Overview: Facts / Recommendations / Missing information (Part 5) ----------

function OverviewTab({ item, brief }) {
  const missing = [
    ...(item.execution?.missing_information || []),
    ...(brief?.missing_information || []),
  ]

  return (
    <>
      <div className="v2-fact-group">
        <div className="v2-fact-group-label facts">Facts</div>
        <div className="v2-card">
          <div className="v2-kv-grid">
            <KV label="Account" value={item.company_name} />
            <KV label="Affected function" value={item.affected_function} />
            <KV label="Opportunity status" value={item.opportunity_status} />
            <KV label="Problem" value={item.problem_statement} />
            <KV label="Demand" value={item.demand_statement} />
          </div>
          <p style={{ marginTop: '0.9rem', marginBottom: 0, color: 'var(--v2-text)', fontSize: '0.88rem' }}>{item.opportunity_statement}</p>
        </div>
      </div>

      <div className="v2-fact-group">
        <div className="v2-fact-group-label recommendations">Recommendations (backend-generated, not human-confirmed)</div>
        <div className="v2-card">
          {item.execution?.action ? (
            <>
              <KV label="Next recommended action" value={item.execution.action.replace(/_/g, ' ')} />
              {item.execution.reason && <p className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>{item.execution.reason}</p>}
            </>
          ) : (
            <EmptyNote>No next action is currently recommended.</EmptyNote>
          )}
        </div>
      </div>

      <div className="v2-fact-group">
        <div className="v2-fact-group-label missing">Missing information</div>
        {missing.length === 0 ? (
          <div className="v2-card"><EmptyNote>Nothing is currently flagged as missing for this opportunity.</EmptyNote></div>
        ) : (
          <div className="v2-evidence-list">
            {missing.map((m, i) => (
              <div key={i} className="v2-evidence-item"><div className="v2-evidence-item-body">{m}</div></div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ---------- GTM Context: ICP / Offering / Motion, with governance-style blockers ----------

function GtmContextTab({ item, brief }) {
  if (!brief) return <div className="v2-skeleton-row" style={{ height: 180 }} />

  return (
    <>
      <div className="v2-section">
        <div className="v2-section-title">ICP match</div>
        <div className="v2-card">
          {brief.icp.status !== 'matched' ? (
            <EmptyNote>No ICP match yet for this account.</EmptyNote>
          ) : (
            brief.icp.matches.map(m => (
              <div key={m.icp_id} style={{ marginBottom: '0.5rem' }}>
                <strong>{m.icp_name}</strong>
                <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{(m.reasons || []).join(' · ')}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Offering fit</div>
        <div className="v2-card">
          {item.strategy?.offering_fit_status === 'candidate_match' ? (
            <KV label="Matched offering" value={item.strategy.matched_offering_name} />
          ) : (
            <>
              <EmptyNote>
                Deal strategy is limited by offering fit: <strong>{item.strategy?.offering_fit_status || brief.offerings.best_fit_reason}</strong>
              </EmptyNote>
              <Link to="/v2/settings?tab=icps-offerings" className="v2-btn" style={{ display: 'inline-flex', marginTop: '0.6rem', textDecoration: 'none' }}>
                Configure in ICPs &amp; Offerings → Offerings
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="v2-section">
        <div className="v2-section-title">GTM motion</div>
        <div className="v2-card">
          {item.gtm_motion?.status === 'recommended' ? (
            <KV label="Recommended motion" value={item.gtm_motion.primary_motion} />
          ) : (
            <>
              <EmptyNote>{item.gtm_motion?.reason || 'No GTM motion recommendation yet.'}</EmptyNote>
              <Link to="/v2/settings?tab=icps-offerings" className="v2-btn" style={{ display: 'inline-flex', marginTop: '0.6rem', textDecoration: 'none' }}>
                Configure in ICPs &amp; Offerings → GTM Motion
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="v2-placeholder-note">
        For the full tenant-wide configuration picture, see <Link to="/v2/briefing">Briefing / Governance</Link>.
      </p>
    </>
  )
}

// ---------- Deal Strategy: reuses GtmStrategy verbatim, never regenerated here ----------

function DealStrategyTab({ item }) {
  const strategy = item.strategy
  if (!strategy) {
    return (
      <div className="v2-card">
        <EmptyNote>
          Deal strategy unavailable — no GtmStrategy has been generated yet for this opportunity.
          Strategy generation is a backend sweep (Batch 5), not something this read-only page can trigger.
        </EmptyNote>
      </div>
    )
  }
  return (
    <div className="v2-card">
      <div className="v2-kv-grid" style={{ marginBottom: '1rem' }}>
        <KV label="Strategy type" value={strategy.strategy_type} />
        <KV label="Offering fit" value={strategy.offering_fit_status} />
        <KV label="Matched offering" value={strategy.matched_offering_name} />
      </div>
      {strategy.reasoning_note && <p className="v2-placeholder-note">{strategy.reasoning_note}</p>}
      {strategy.action_plan?.length > 0 && (
        <div className="v2-action-chain">
          {strategy.action_plan.map((step, i) => (
            <div key={step.action_type} className="v2-action-step">
              <span className="v2-action-step-index">{i + 1}</span>
              <span className="v2-action-step-label">{step.objective}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Message Review + Human Approval ----------

function ReviewActions({ draft, onReviewed, userEmail }) {
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const act = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await reviewMessageDraft(draft.id, action, userEmail, note || null)
      onReviewed()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && <div className="v2-form-message error">{error}</div>}
      {showNote && (
        <div className="v2-field">
          <label className="v2-field-label">Note (optional)</label>
          <textarea className="v2-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="What needs to change?" />
        </div>
      )}
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => act('approve')}>Approve</button>
        <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => act('reject')}>Reject</button>
        <button type="button" className="v2-btn" disabled={busy} onClick={() => (showNote ? act('request_changes') : setShowNote(true))}>
          {showNote ? 'Submit change request' : 'Request changes'}
        </button>
      </div>
    </div>
  )
}

function MessageReviewTab({ opportunityId, companyId, userEmail }) {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    getAccountMessages(companyId)
      .then(data => setMessages(data.messages.filter(m => m.opportunity_id === opportunityId)))
      .catch(err => setError(formatApiError(err)))
  }

  useEffect(load, [companyId, opportunityId])

  if (error) return <div className="v2-card"><div className="v2-state v2-state-error">{error}</div></div>
  if (messages === null) return <div className="v2-skeleton-row" style={{ height: 160 }} />
  if (messages.length === 0) {
    return (
      <div className="v2-card">
        <EmptyNote>
          No message draft exists yet for this opportunity. A draft becomes available once strategy and
          readiness reach ready_for_message (Batch 6/13) — this page never generates one automatically.
        </EmptyNote>
      </div>
    )
  }

  return (
    <>
      {messages.map(m => (
        <div key={m.id} className={`v2-message-card${!m.is_current_strategy_version ? ' stale' : ''}`}>
          <div className="v2-message-status-block">
            <div>
              <div className="v2-message-status-title">Message status</div>
              <div className="v2-message-status-value">{MESSAGE_STATUS_LABEL[m.status] || m.status}</div>
            </div>
            <span className={`v2-badge ${MESSAGE_STATUS_BADGE[m.status] || 'v2-badge-neutral'}`}>{m.channel || 'channel unknown'}</span>
          </div>

          {!m.is_current_strategy_version && (
            <div className="v2-form-message error" style={{ marginBottom: '0.9rem' }}>
              This draft was reviewed against an earlier strategy version. The strategy has since changed —
              this review no longer applies to the current version.
            </div>
          )}

          {m.message_text ? (
            <div className="v2-message-text">{m.message_text}</div>
          ) : (
            <EmptyNote>No usable message was produced. {(m.missing_information || []).join(' · ')}</EmptyNote>
          )}

          {m.status === 'ready_for_review' && m.is_current_strategy_version && (
            <ReviewActions draft={m} onReviewed={load} userEmail={userEmail} />
          )}

          {(m.status === 'approved' || m.status === 'rejected' || m.status === 'changes_requested') && (
            <div className="v2-review-meta">
              <IconCheck width={12} height={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {MESSAGE_STATUS_LABEL[m.status]} by {m.reviewed_by || 'unknown'} · {m.reviewed_at ? new Date(m.reviewed_at).toLocaleString() : ''}
              {m.review_note && <> — “{m.review_note}”</>}
            </div>
          )}

          <div className="v2-not-sent-notice">
            Draft / Proposed — not sent. Approval means a human approved this draft for the next explicitly
            implemented workflow step. No email, LinkedIn message, or CRM change has been made.
          </div>
        </div>
      ))}
    </>
  )
}

// ---------- Page ----------

// Closes the loop Pipeline -> Deal Strategy -> Message Review -> Human Approval (Part 1). Every
// fact here comes from the existing backend (get_pipeline_item, build_account_brief,
// list_messages_for_company) -- the only write this page performs is the human review action
// itself (approve/reject/request_changes), which never sends, launches, or mutates anything
// beyond the MessageDraft row it targets (see api.py's review route docstring).
export default function OpportunityDetail() {
  const { opportunityId } = useParams()
  const { user } = useTenant()
  const [item, setItem] = useState(null)
  const [brief, setBrief] = useState(null)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState(TABS[0])

  useEffect(() => {
    let cancelled = false
    setItem(null)
    setBrief(null)
    setError(null)
    setNotFound(false)
    getPipelineItem(opportunityId)
      .then(data => {
        if (cancelled) return
        setItem(data)
        if (data.company_id) {
          getAccountBrief(data.company_id).then(b => { if (!cancelled) setBrief(b) }).catch(() => {})
        }
      })
      .catch(err => {
        if (cancelled) return
        if (err.response?.status === 404) setNotFound(true)
        else setError(formatApiError(err))
      })
    return () => { cancelled = true }
  }, [opportunityId])

  const backLink = <Link to="/v2/pipeline" className="v2-back-link"><IconChevronLeft width={14} height={14} />Pipeline</Link>

  if (notFound) {
    return <div>{backLink}<div className="v2-card"><div className="v2-state">This opportunity doesn't exist or isn't part of this workspace.</div></div></div>
  }
  if (error) {
    return (
      <div>
        {backLink}
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load this opportunity: {error}</div>
          </div>
        </div>
      </div>
    )
  }
  if (item === null) {
    return (
      <div>
        {backLink}
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 300 }} />
      </div>
    )
  }

  return (
    <div>
      {backLink}
      <h1 className="v2-page-title" style={{ marginBottom: 'var(--v2-space-5)' }}>{item.company_name || 'Unnamed account'}</h1>

      <div className="v2-config-tabs">
        {TABS.map(t => (
          <button key={t} type="button" className={`v2-config-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab item={item} brief={brief} />}
      {tab === 'GTM Context' && <GtmContextTab item={item} brief={brief} />}
      {tab === 'Deal Strategy' && <DealStrategyTab item={item} />}
      {tab === 'Message Review' && item.company_id && (
        <MessageReviewTab opportunityId={item.opportunity_id} companyId={item.company_id} userEmail={user?.email || 'unknown user'} />
      )}
    </div>
  )
}
