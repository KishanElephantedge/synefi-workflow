import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAccountBrief, getAccountMessages, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft } from '../icons.jsx'

const TABS = ['Overview', 'Signals', 'Opportunity & Strategy', 'Contacts', 'Messages']

// account_status -> badge tone. Mirrors ACCOUNT_STATES_ORDER (Batch 12) exactly -- weakest to
// strongest -- never a new status invented here.
const STATUS_BADGE = {
  insufficient_context: 'v2-badge-neutral',
  identified: 'v2-badge-neutral',
  icp_matched: 'v2-badge-info',
  opportunity_identified: 'v2-badge-info',
  strategy_ready: 'v2-badge-warning',
  sales_ready: 'v2-badge-success',
}

const STATUS_LABEL = {
  insufficient_context: 'Insufficient context',
  identified: 'Identified',
  icp_matched: 'ICP matched',
  opportunity_identified: 'Opportunity identified',
  strategy_ready: 'Strategy ready',
  sales_ready: 'Sales ready',
}

const TREND_BADGE = {
  emerging: 'v2-badge-info',
  accelerating: 'v2-badge-success',
  persistent: 'v2-badge-info',
  stable: 'v2-badge-neutral',
  declining: 'v2-badge-warning',
  insufficient_evidence: 'v2-badge-neutral',
}

function StatusBadge({ status, labels = STATUS_LABEL, tones = STATUS_BADGE }) {
  if (!status) return null
  return <span className={`v2-badge ${tones[status] || 'v2-badge-neutral'}`}>{labels[status] || status}</span>
}

function EmptySection({ children }) {
  return <div className="v2-placeholder-note">{children}</div>
}

function KV({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value">{value ?? '—'}</div>
    </div>
  )
}

function OverviewTab({ brief }) {
  const { icp, offerings, gtm_motion: motion, triggers } = brief

  return (
    <>
      <div className="v2-section">
        <div className="v2-section-title">ICP match</div>
        <div className="v2-card">
          {icp.status !== 'matched' ? (
            <EmptySection>No ICP match yet for this account.</EmptySection>
          ) : (
            <div className="v2-evidence-list">
              {icp.matches.map(m => (
                <div key={m.icp_id} className="v2-evidence-item">
                  <div className="v2-evidence-item-head">
                    <span className="v2-evidence-item-title">{m.icp_name}</span>
                  </div>
                  <div className="v2-evidence-item-body">{(m.reasons || []).join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Trigger evidence</div>
        <div className="v2-card">
          {triggers.length === 0 ? (
            <EmptySection>No trigger evidence recorded for this account.</EmptySection>
          ) : (
            <div className="v2-kv-grid">
              {triggers.map((t, i) => Object.entries(t || {}).map(([k, v]) => (
                <KV key={`${i}-${k}`} label={k.replace(/_/g, ' ')} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
              )))}
            </div>
          )}
        </div>
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Offering fit</div>
        <div className="v2-card">
          {offerings.status === 'insufficient_context' ? (
            <EmptySection>{offerings.best_fit_reason}</EmptySection>
          ) : (
            <>
              {offerings.best_fit && (
                <p style={{ marginTop: 0 }}>Best fit: <strong>{offerings.best_fit.offering}</strong></p>
              )}
              <div className="v2-evidence-list">
                {offerings.matches.flatMap(icpEntry => icpEntry.offerings.map(o => (
                  <div key={`${icpEntry.icp_id}-${o.offering}`} className="v2-evidence-item">
                    <div className="v2-evidence-item-head">
                      <span className="v2-evidence-item-title">{o.offering}</span>
                      <StatusBadge
                        status={o.status}
                        labels={{ candidate_match: 'Candidate match', no_match: 'No match', excluded: 'Excluded' }}
                        tones={{ candidate_match: 'v2-badge-success', no_match: 'v2-badge-neutral', excluded: 'v2-badge-danger' }}
                      />
                    </div>
                    <div className="v2-evidence-item-body">{o.reason}</div>
                  </div>
                )))}
              </div>
              {offerings.unconfigured_offerings.length > 0 && (
                <p className="v2-placeholder-note" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
                  Not yet configured for any ICP: {offerings.unconfigured_offerings.join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="v2-section">
        <div className="v2-section-title">GTM motion</div>
        <div className="v2-card">
          {motion.status !== 'recommended' ? (
            <EmptySection>{motion.reason || 'No GTM motion recommendation yet.'}</EmptySection>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>Recommended: <strong>{motion.primary_motion}</strong></p>
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{motion.reason}</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function SignalsTab({ brief }) {
  const signals = brief.market_context
  if (signals.length === 0) {
    return <div className="v2-card"><EmptySection>No company-linked market signals yet. This is never inferred from a general market trend -- only signals directly tied to this account count here.</EmptySection></div>
  }
  return (
    <div className="v2-evidence-list">
      {signals.map(s => (
        <div key={s.content_topic_id} className="v2-card">
          <div className="v2-evidence-item-head">
            <span className="v2-evidence-item-title">{s.topic_name}</span>
            <StatusBadge status={s.trend_state} labels={{}} tones={TREND_BADGE} />
          </div>
          <p className="v2-placeholder-note">{s.trend_explanation}</p>
          <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{s.account_link_reason}</p>
        </div>
      ))}
    </div>
  )
}

function OpportunityStrategyTab({ brief }) {
  const { problems, demand, opportunities } = brief

  return (
    <>
      <div className="v2-section">
        <div className="v2-section-title">Problem evidence</div>
        {problems.length === 0 ? (
          <div className="v2-card"><EmptySection>No problem evidence recorded yet.</EmptySection></div>
        ) : (
          <div className="v2-evidence-list">
            {problems.map(p => (
              <div key={p.id} className="v2-evidence-item">
                <div className="v2-evidence-item-head">
                  <span className="v2-evidence-item-title">{p.affected_function}</span>
                  <span className="v2-badge v2-badge-neutral">{p.confidence?.best_evidence_tier}</span>
                </div>
                <div className="v2-evidence-item-body">{p.problem_statement}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Demand evidence</div>
        {demand.length === 0 ? (
          <div className="v2-card"><EmptySection>No demand evidence recorded yet.</EmptySection></div>
        ) : (
          <div className="v2-evidence-list">
            {demand.map(d => (
              <div key={d.id} className="v2-evidence-item">
                <div className="v2-evidence-item-head">
                  <span className="v2-evidence-item-title">{d.affected_function}</span>
                  <span className="v2-badge v2-badge-neutral">{d.confidence?.best_evidence_tier}</span>
                </div>
                <div className="v2-evidence-item-body">{d.demand_statement}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="v2-section">
        <div className="v2-section-title">Opportunities</div>
        {opportunities.length === 0 ? (
          <div className="v2-card"><EmptySection>No Opportunity has been opened for this account yet -- Problem and Demand evidence haven't reached the eligibility bar (Batch 4).</EmptySection></div>
        ) : (
          opportunities.map(o => (
            <div key={o.id} className="v2-card" style={{ marginBottom: '1rem' }}>
              <div className="v2-evidence-item-head">
                <span className="v2-evidence-item-title">{o.affected_function}</span>
                <span className="v2-badge v2-badge-neutral">{o.status}</span>
              </div>
              <p className="v2-placeholder-note">{o.opportunity_statement}</p>

              {o.strategy ? (
                <>
                  <div className="v2-kv-grid" style={{ marginBottom: '0.9rem' }}>
                    <KV label="Strategy type" value={o.strategy.strategy_type} />
                    <KV label="Offering fit" value={o.strategy.offering_fit_status} />
                    <KV
                      label="Readiness"
                      value={o.sales_readiness ? (STATUS_LABEL[o.sales_readiness.status] || o.sales_readiness.status) : '—'}
                    />
                  </div>
                  {o.strategy.action_plan?.length > 0 && (
                    <div className="v2-action-chain">
                      {o.strategy.action_plan.map((step, i) => (
                        <div key={step.action_type} className="v2-action-step">
                          <span className="v2-action-step-index">{i + 1}</span>
                          <span className="v2-action-step-label">{step.objective}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.sales_readiness && o.sales_readiness.status !== 'ready_for_message' && (
                    <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{o.sales_readiness.reason}</p>
                  )}
                </>
              ) : (
                <EmptySection>No GtmStrategy has been generated yet for this Opportunity.</EmptySection>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

function ContactsTab({ brief }) {
  const { contacts, decision_maker: decisionMaker } = brief
  return (
    <>
      {decisionMaker.status !== 'known' && (
        <div className="v2-card" style={{ marginBottom: '1rem' }}>
          <EmptySection>Decision maker required — {decisionMaker.reason === 'no_relevant_contact_available' ? 'no relevant contact is available for this account yet.' : 'no company identity to search against.'}</EmptySection>
        </div>
      )}
      {contacts.length === 0 ? (
        <div className="v2-card"><EmptySection>No known contacts for this account.</EmptySection></div>
      ) : (
        <div className="v2-evidence-list">
          {contacts.map(c => (
            <div key={c.id} className="v2-evidence-item">
              <div className="v2-evidence-item-head">
                <span className="v2-evidence-item-title">{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}</span>
                {c.has_email && <span className="v2-badge v2-badge-success">Email on file</span>}
              </div>
              <div className="v2-evidence-item-body">{c.title || 'Title unknown'}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const MESSAGE_STATUS_LABEL = {
  insufficient_context: 'Insufficient context',
  draft: 'Draft (needs review)',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
}

const MESSAGE_STATUS_BADGE = {
  insufficient_context: 'v2-badge-neutral',
  draft: 'v2-badge-warning',
  ready_for_review: 'v2-badge-info',
  approved: 'v2-badge-success',
}

// Phase 3 -- consumes GET /gtm-os/accounts/{id}/messages (list_messages_for_company(), Batch 7's
// MessageDraft, read-only). Deliberately no Send and no Approve button here: Part 7's own
// instruction is to add an Approve action only if a safe, frontend-intended approval API already
// exists, and this phase doesn't add one -- so the lifecycle is shown, never advanced, from V2.
function MessagesTab({ companyId }) {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getAccountMessages(companyId)
      .then(data => { if (!cancelled) setMessages(data.messages) })
      .catch(err => { if (!cancelled) setError(formatApiError(err)) })
    return () => { cancelled = true }
  }, [companyId])

  if (error) {
    return <div className="v2-card"><div className="v2-state v2-state-error">Couldn't load messages: {error}</div></div>
  }

  if (messages === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 100 }} />
  }

  if (messages.length === 0) {
    return (
      <div className="v2-card">
        <EmptySection>
          No message drafts exist yet for this account. A draft becomes available once an Opportunity's
          strategy and readiness reach ready_for_message (Batch 6/13) -- Phase 3 only displays drafts that
          already exist, it never generates one from this page.
        </EmptySection>
      </div>
    )
  }

  return (
    <div className="v2-evidence-list">
      {messages.map(m => (
        <div key={m.id} className="v2-card">
          <div className="v2-evidence-item-head">
            <span className="v2-evidence-item-title">{m.channel ? m.channel[0].toUpperCase() + m.channel.slice(1) : 'Channel undetermined'}</span>
            <span className={`v2-badge ${MESSAGE_STATUS_BADGE[m.status] || 'v2-badge-neutral'}`}>
              {MESSAGE_STATUS_LABEL[m.status] || m.status}
            </span>
          </div>
          {m.message_text ? (
            <p style={{ color: 'var(--v2-text)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{m.message_text}</p>
          ) : (
            <EmptySection>No usable message was produced. {(m.missing_information || []).join(' · ')}</EmptySection>
          )}
          {m.quality_gate_reasons?.length > 0 && (
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
              Needs review: {m.quality_gate_reasons.join(' · ')}
            </p>
          )}
          {m.status === 'approved' && (
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
              Approved by {m.approved_by || 'a reviewer'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export default function AccountDetail() {
  const { companyId } = useParams()
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState(TABS[0])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    getAccountBrief(companyId)
      .then(data => { if (!cancelled) setBrief(data) })
      .catch(err => {
        if (cancelled) return
        if (err.response?.status === 404) setNotFound(true)
        else setError(formatApiError(err))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [companyId])

  const backLink = <Link to="/v2/accounts" className="v2-back-link"><IconChevronLeft width={14} height={14} />Accounts</Link>

  if (loading) {
    return (
      <div>
        {backLink}
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 100, marginBottom: '1.5rem' }} />
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <div className="v2-card"><div className="v2-state">This account doesn't exist or isn't part of this workspace.</div></div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        {backLink}
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load this account: {error}</div>
          </div>
        </div>
      </div>
    )
  }

  const { company, account_status: accountStatus, account_summary: summary } = brief

  return (
    <div>
      {backLink}

      <div className="v2-account-header">
        <div className="v2-account-header-identity">
          <div className="v2-page-title">
            {company.name}
            <StatusBadge status={accountStatus} />
          </div>
          <div className="v2-account-header-meta">
            {[company.domain, company.industry, company.location].filter(Boolean).join(' · ') || 'No firmographic data on file'}
          </div>
        </div>
      </div>

      {summary.next_investigation && (
        <div className="v2-needs-you-banner">
          <div className="v2-banner-label">Next investigation</div>
          <div className="v2-banner-body">
            {summary.next_investigation.replace(/_/g, ' ')}
            {summary.current_blocker && <> — {summary.current_blocker}</>}
          </div>
        </div>
      )}

      {summary.strongest_evidence.length > 0 && (
        <div className="v2-card" style={{ marginBottom: '1.5rem' }}>
          <div className="v2-section-title" style={{ marginBottom: '0.6rem' }}>Strongest evidence</div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--v2-text-muted)', fontSize: '0.88rem' }}>
            {summary.strongest_evidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="v2-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            className={`v2-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && <OverviewTab brief={brief} />}
      {activeTab === 'Signals' && <SignalsTab brief={brief} />}
      {activeTab === 'Opportunity & Strategy' && <OpportunityStrategyTab brief={brief} />}
      {activeTab === 'Contacts' && <ContactsTab brief={brief} />}
      {activeTab === 'Messages' && <MessagesTab companyId={companyId} />}
    </div>
  )
}
