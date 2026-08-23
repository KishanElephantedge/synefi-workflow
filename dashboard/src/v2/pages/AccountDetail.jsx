import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext.jsx'
import { getAccountBrief, getAccountMessages, reviewMessageDraft, regenerateMessageDraft, getEligibleContacts, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft, IconRefreshCw } from '../icons.jsx'
import { formatRecency } from '../format.js'

const TABS = ['Overview', 'Evidence', 'Opportunity & Strategy', 'Contacts', 'Messages']

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

// Real, complete vocabularies (verified directly against strategy.py/sales_agent.py) --
// translated so the Opportunity & Strategy tab never shows a raw enum like "consultative" or
// "problem_validation_required".
const STRATEGY_TYPE_LABEL = {
  insufficient_context: 'Insufficient context',
  diagnostic: 'Diagnostic',
  consultative: 'Consultative',
  'execution-led': 'Execution-led',
  nurture: 'Nurture',
}

const OFFERING_FIT_LABEL = {
  candidate_match: 'Candidate match',
  no_match: 'No match',
  excluded: 'Excluded',
  insufficient_offering_context: 'Insufficient context',
}

const READINESS_LABEL = {
  insufficient_context: 'Insufficient context',
  decision_maker_required: 'Decision-maker required',
  problem_validation_required: 'Problem validation required',
  demand_validation_required: 'Demand validation required',
  offering_fit_required: 'Offering fit required',
  ready_for_message: 'Ready for message',
}

// Opportunity.VALID_STATUSES, verbatim -- already plain English, just capitalized for display.
const OPPORTUNITY_STATUS_LABEL = {
  candidate: 'Candidate',
  qualified: 'Qualified',
  dismissed: 'Dismissed',
  converted: 'Converted',
}

const TREND_BADGE = {
  emerging: 'v2-badge-info',
  accelerating: 'v2-badge-success',
  persistent: 'v2-badge-info',
  stable: 'v2-badge-neutral',
  declining: 'v2-badge-warning',
  insufficient_evidence: 'v2-badge-neutral',
}

const TREND_LABEL = {
  emerging: 'Emerging',
  accelerating: 'Accelerating',
  persistent: 'Persistent',
  stable: 'Stable',
  declining: 'Declining',
  insufficient_evidence: 'Insufficient evidence',
}

// Translates every real backend action-step enum into authored, human-readable copy -- covers
// the complete real vocabulary both _derive_minimum_next_investigation() (no Opportunity yet)
// and evaluate_sales_readiness() (an Opportunity/GtmStrategy exists) can actually produce,
// verified directly against both functions. Never renders a raw enum or backend sentence
// ("run the Batch 8 ICP matching sweep", "ICPMatch rows") -- if a future value isn't in this
// map, falls back to a plain de-underscored label rather than crashing or leaking raw text.
const ACTION_COPY = {
  identify_decision_maker: {
    label: 'Find a decision-maker',
    detail: 'No contact has been identified for this account yet. Finding the right person is required before any outreach can be prepared.',
  },
  run_icp_matching: {
    label: 'Run ICP matching',
    detail: "This account hasn't been evaluated against an ICP yet. Matching it will determine whether it fits an active ideal customer profile.",
  },
  review_offering_fit: {
    label: 'Review offering fit',
    detail: 'This account matches an ICP, but no offering has been identified as a fit yet.',
  },
  gather_problem_evidence: {
    label: 'Gather problem evidence',
    detail: "No documented problem evidence exists for this account yet.",
  },
  validate_problem: {
    label: 'Validate the problem',
    detail: "The problem hasn't been confirmed directly with the account yet -- current evidence is implied, not declared.",
  },
  validate_demand: {
    label: 'Validate demand',
    detail: 'Problem evidence exists, but nothing yet confirms the account is genuinely evaluating solutions.',
  },
  await_additional_evidence: {
    label: 'Awaiting more evidence',
    detail: "Problem and demand evidence both exist, but not enough yet to open an opportunity. No further action to take until more independent evidence accumulates.",
  },
  prepare_message: {
    label: 'Prepare a message',
    detail: 'Enough is known about this account to prepare outreach.',
  },
}

function actionCopy(key) {
  if (!key) return null
  return ACTION_COPY[key] || { label: key.replace(/_/g, ' '), detail: null }
}

// GtmStrategy's own action-plan rationale text (sales_readiness.reason) is otherwise real,
// authored prose -- but three of its real strings name internal model classes directly
// ("ProblemHypothesis evidence tier is 'declared'...") rather than a bare enum, so a copy-map
// lookup doesn't apply cleanly. This targeted cleanup swaps the two known model names for plain
// English and un-quotes/despaces any embedded enum value, without rewriting the sentence itself.
function cleanBackendText(s) {
  if (!s) return s
  return s
    .replace(/ProblemHypothesis/g, 'Problem')
    .replace(/DemandHypothesis/g, 'Demand')
    .replace(/\boffering_fit_status\b/g, 'offering fit')
    .replace(/'([a-z_]+)'/g, (_, word) => word.replace(/_/g, ' '))
    // General fallback: any remaining snake_case token (2+ words joined by "_") is a raw enum
    // value that slipped through -- de-underscore it rather than leave it verbatim. Safe
    // because no genuinely authored sentence in this codebase uses snake_case words.
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (m) => m.replace(/_/g, ' '))
}

function StatusBadge({ status, labels = STATUS_LABEL, tones = STATUS_BADGE }) {
  if (!status) return null
  return <span className={`v2-badge ${tones[status] || 'v2-badge-neutral'}`}>{labels[status] || status}</span>
}

function EmptyBlock({ title, body }) {
  return (
    <div className="v2-agent-empty">
      <div className="v2-agent-empty-title">{title}</div>
      {body && <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{body}</p>}
    </div>
  )
}

// The primary hero -- the first thing a sales user should understand about this account.
// "What we know" prefers the backend's own real strongest_evidence summary; when that's empty
// (most accounts today), it falls back to other already-real fields (decision-maker on file,
// hot-lead reasoning, hiring signal) rather than showing nothing. "Recommended next step"
// always goes through actionCopy() -- never a raw enum.
function AgentSummary({ brief }) {
  const { account_summary: summary, decision_maker: dm, company } = brief
  const copy = actionCopy(summary.next_investigation)

  const knowBullets = summary.strongest_evidence?.length ? [...summary.strongest_evidence] : []
  if (knowBullets.length === 0) {
    if (dm.status === 'known' && dm.contacts?.[0]) {
      const c = dm.contacts[0]
      knowBullets.push(`Decision-maker on file: ${c.name}${c.title ? `, ${c.title}` : ''}.`)
    }
    if (company.hot_lead && company.hot_lead_reasoning) {
      knowBullets.push(`Flagged as a hot lead: ${company.hot_lead_reasoning}`)
    }
    if (company.hiring_signal_role) {
      knowBullets.push(`Hiring signal: ${company.hiring_signal_role.replace(/_/g, ' ')} (${company.hiring_signal_strength || 'unknown'} strength).`)
    }
  }

  return (
    <div className="v2-agent-hero">
      <div className="v2-agent-hero-label">Account Agent</div>
      <div className="v2-agent-hero-grid">
        <div>
          <div className="v2-agent-hero-title">What we know</div>
          {knowBullets.length > 0 ? (
            <ul className="v2-agent-hero-list">
              {knowBullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          ) : (
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>No account-level evidence has been gathered yet.</p>
          )}
        </div>
        <div>
          <div className="v2-agent-hero-title">Recommended next step</div>
          {copy ? (
            <>
              <p className="v2-agent-hero-action">{copy.label}</p>
              {copy.detail && <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{copy.detail}</p>}
            </>
          ) : (
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>No further action to recommend right now.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact 2x2 "Account Understanding" dashboard -- ICP fit, Signals, Opportunity, Strategy
// (Offering Fit + Offering Recommendation + GTM Motion consolidated into one card). Every
// field read verbatim from the brief; nothing computed here.
function OverviewGrid({ brief }) {
  const { icp, icp_candidates: icpCandidates, market_context: signals, opportunities, offerings, offering_recommendation: offeringRec, gtm_motion: motion } = brief

  return (
    <div className="v2-agent-grid">
      <div className="v2-agent-card">
        <div className="v2-agent-card-title">ICP fit</div>
        {icp.status === 'matched' ? (
          icp.matches.map(m => (
            <div key={m.icp_id} className="v2-agent-fact">
              <div className="v2-agent-fact-title">{m.icp_name}</div>
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{(m.reasons || []).join(' · ')}</p>
            </div>
          ))
        ) : (
          <EmptyBlock title="Not matched yet" body="This account hasn't been evaluated against an ICP." />
        )}
        {icpCandidates?.primary && (
          <div className="v2-agent-fact">
            <div className="v2-agent-fact-title">
              {icpCandidates.primary.icp_name} <span className="v2-badge v2-badge-success">Primary candidate</span>
            </div>
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{(icpCandidates.primary.reasons || []).join(' · ')}</p>
          </div>
        )}
      </div>

      <div className="v2-agent-card">
        <div className="v2-agent-card-title">Signals</div>
        {signals.length > 0 ? (
          signals.map(s => (
            <div key={s.content_topic_id} className="v2-agent-fact">
              <div className="v2-agent-fact-title">
                {s.topic_name} <StatusBadge status={s.trend_state} labels={TREND_LABEL} tones={TREND_BADGE} />
              </div>
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{s.account_link_reason}</p>
            </div>
          ))
        ) : (
          <EmptyBlock title="No account signals yet" body="No account-level signals have been recorded for this company." />
        )}
      </div>

      <div className="v2-agent-card">
        <div className="v2-agent-card-title">Opportunity</div>
        {opportunities.length > 0 ? (
          opportunities.map(o => (
            <div key={o.id} className="v2-agent-fact">
              <div className="v2-agent-fact-title">
                {o.affected_function} <span className="v2-badge v2-badge-neutral">{OPPORTUNITY_STATUS_LABEL[o.status] || o.status}</span>
              </div>
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{o.opportunity_statement}</p>
            </div>
          ))
        ) : (
          <EmptyBlock title="No opportunity identified yet" body="Problem and demand evidence haven't reached the threshold to open an opportunity." />
        )}
      </div>

      <div className="v2-agent-card">
        <div className="v2-agent-card-title">Strategy</div>
        {offeringRec?.primary_recommendation ? (
          <div className="v2-agent-fact">
            <div className="v2-agent-fact-title">{offeringRec.primary_recommendation.offering}</div>
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{offeringRec.primary_recommendation.explanation}</p>
          </div>
        ) : offerings.best_fit ? (
          <div className="v2-agent-fact">
            <div className="v2-agent-fact-title">{offerings.best_fit.offering}</div>
          </div>
        ) : (
          <EmptyBlock title="No offering recommendation yet" body="Not enough is known about this account to recommend an offering." />
        )}
        {motion.status === 'recommended' && (
          <div className="v2-agent-fact">
            <div className="v2-agent-fact-title">GTM motion: {motion.primary_motion}</div>
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{motion.reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Unified evidence feed -- market signals, problem/demand evidence, and ICP reasoning as one
// list of title + human explanation + type badge. Never Object.entries() over a raw object,
// never a field-name dump. `triggers` folds in here too (currently always empty in production,
// same real field the old page rendered raw).
function EvidenceTab({ brief }) {
  const items = []
  brief.market_context.forEach(s => items.push({ title: s.topic_name, body: s.trend_explanation, type: 'Market signal' }))
  brief.problems.forEach(p => items.push({ title: p.affected_function, body: p.problem_statement, type: 'Problem evidence' }))
  brief.demand.forEach(d => items.push({ title: d.affected_function, body: d.demand_statement, type: 'Demand evidence' }))
  if (brief.icp.matches?.length) {
    brief.icp.matches.forEach(m => items.push({ title: m.icp_name, body: (m.reasons || []).join(' · '), type: 'ICP reasoning' }))
  }
  ;(brief.triggers || []).forEach((t, i) => {
    const body = cleanBackendText(Object.values(t || {}).filter(Boolean).join(' · '))
    if (body) items.push({ title: 'Trigger', body, type: 'Trigger evidence' })
  })

  if (items.length === 0) {
    return <div className="v2-card"><EmptyBlock title="No account-level evidence recorded yet." /></div>
  }

  return (
    <div className="v2-evidence-list">
      {items.map((it, i) => (
        <div key={i} className="v2-evidence-item">
          <div className="v2-evidence-item-head">
            <span className="v2-evidence-item-title">{it.title}</span>
            <span className="v2-badge v2-badge-neutral">{it.type}</span>
          </div>
          <div className="v2-evidence-item-body">{it.body}</div>
        </div>
      ))}
    </div>
  )
}

function KV({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value">{value ?? '—'}</div>
    </div>
  )
}

function OpportunityStrategyTab({ brief }) {
  const { opportunities } = brief

  if (opportunities.length === 0) {
    return <div className="v2-card"><EmptyBlock title="No opportunity identified yet" body="Problem and Demand evidence haven't reached the eligibility bar yet." /></div>
  }

  return (
    <>
      {opportunities.map(o => (
        <div key={o.id} className="v2-card" style={{ marginBottom: '1rem' }}>
          <div className="v2-evidence-item-head">
            <span className="v2-evidence-item-title">{o.affected_function}</span>
            <span className="v2-badge v2-badge-neutral">{OPPORTUNITY_STATUS_LABEL[o.status] || o.status}</span>
          </div>
          <p className="v2-placeholder-note">{o.opportunity_statement}</p>

          {o.strategy ? (
            <>
              <div className="v2-kv-grid" style={{ marginBottom: '0.9rem' }}>
                <KV label="Strategy type" value={STRATEGY_TYPE_LABEL[o.strategy.strategy_type] || o.strategy.strategy_type} />
                <KV label="Offering fit" value={OFFERING_FIT_LABEL[o.strategy.offering_fit_status] || o.strategy.offering_fit_status} />
                <KV
                  label="Readiness"
                  value={o.sales_readiness ? (READINESS_LABEL[o.sales_readiness.status] || o.sales_readiness.status) : '—'}
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
                <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{cleanBackendText(o.sales_readiness.reason)}</p>
              )}
            </>
          ) : (
            <EmptyBlock title="No strategy generated yet for this opportunity." />
          )}
        </div>
      ))}
    </>
  )
}

function ContactsTab({ brief }) {
  const { contacts, decision_maker: decisionMaker } = brief
  return (
    <>
      <div className="v2-section-title">Who we need to reach</div>
      {decisionMaker.status !== 'known' && (
        <div className="v2-card" style={{ marginBottom: '1rem' }}>
          <EmptyBlock
            title="Decision-maker required"
            body={decisionMaker.reason === 'no_relevant_contact_available' ? 'No relevant contact is available for this account yet.' : 'No company identity to search against.'}
          />
        </div>
      )}
      {contacts.length === 0 ? (
        <div className="v2-card"><EmptyBlock title="No known contacts for this account." /></div>
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

// A couple of real channel values are proper nouns that plain capitalization gets wrong
// ("linkedin" -> "Linkedin" instead of "LinkedIn").
const CHANNEL_LABEL = { linkedin: 'LinkedIn', email: 'Email' }
function channelLabel(channel) {
  if (!channel) return 'Channel undetermined'
  return CHANNEL_LABEL[channel] || channel[0].toUpperCase() + channel.slice(1)
}

// Real, complete vocabulary -- MessageDraft.status (message_draft.py:58), never a paraphrase.
const MESSAGE_STATUS_LABEL = {
  insufficient_context: 'Insufficient context',
  draft: 'Draft (needs review)',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
}

const MESSAGE_STATUS_BADGE = {
  insufficient_context: 'v2-badge-neutral',
  draft: 'v2-badge-warning',
  ready_for_review: 'v2-badge-info',
  approved: 'v2-badge-success',
  rejected: 'v2-badge-danger',
  changes_requested: 'v2-badge-warning',
}

// V2 Frontend Phase (Message Workspace, inline) -- approve/reject/request-changes, same real
// lifecycle OpportunityDetail's own ReviewActions already uses (reviewMessageDraft(), Phase 7's
// one human-approval-boundary write route). Duplicated here deliberately rather than extracted
// into a shared file, to avoid touching OpportunityDetail.jsx while this inline placement is
// still being proven -- same "do not remove/disturb the existing working review UI" caution the
// approved plan already called for.
function MessageReviewActions({ draft, onChanged, userEmail }) {
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const act = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await reviewMessageDraft(draft.id, action, userEmail, note || null)
      onChanged()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {error && <div className="v2-form-message error">{error}</div>}
      {showNote && (
        <div className="v2-field">
          <label className="v2-field-label">Note (optional)</label>
          <textarea className="v2-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="What needs to change?" />
        </div>
      )}
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => act('approve')}>Approve</button>
        <button type="button" className="v2-btn" disabled={busy} onClick={() => (showNote ? act('request_changes') : setShowNote(true))}>
          {showNote ? 'Submit change request' : 'Request changes'}
        </button>
        <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => act('reject')}>Reject</button>
      </div>
    </div>
  )
}

// Regenerate + "change recipient" -- backed by the new POST /gtm-os/messages/{id}/regenerate and
// GET /gtm-os/opportunities/{id}/eligible-contacts (real, additive routes; see message_draft.py's
// regenerate_message_draft()). Eligible contacts are fetched lazily, only when the picker is
// opened, never preloaded for every draft card.
function RegenerateControl({ draft, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [contacts, setContacts] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const regenerate = async (contactId) => {
    setBusy(true)
    setError(null)
    try {
      await regenerateMessageDraft(draft.id, contactId)
      setPickerOpen(false)
      onChanged()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const openPicker = () => {
    setPickerOpen(o => !o)
    if (!contacts) {
      getEligibleContacts(draft.opportunity_id).then(data => setContacts(data.contacts)).catch(err => setError(formatApiError(err)))
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {error && <div className="v2-form-message error">{error}</div>}
      <div className="v2-btn-row">
        <button type="button" className="v2-btn" disabled={busy} onClick={() => regenerate(null)}>
          <IconRefreshCw width={13} height={13} /> Regenerate
        </button>
        <button type="button" className="v2-btn" disabled={busy} onClick={openPicker}>Change recipient</button>
      </div>
      {pickerOpen && (
        <div className="v2-card" style={{ marginTop: '0.5rem', padding: 'var(--v2-space-3)' }}>
          {contacts === null ? (
            <div className="v2-placeholder-note">Loading eligible contacts…</div>
          ) : contacts.length === 0 ? (
            <div className="v2-placeholder-note">No other eligible contacts exist for this company.</div>
          ) : (
            contacts.map(c => (
              <button
                key={c.id}
                type="button"
                className="v2-btn"
                style={{ width: '100%', textAlign: 'left', marginBottom: '4px' }}
                disabled={busy || c.id === draft.contact_id}
                onClick={() => regenerate(c.id)}
              >
                {c.first_name} {c.last_name}{c.title ? ` — ${c.title}` : ''}{c.id === draft.contact_id ? ' (current)' : ''}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function MessageDraftCard({ draft, onChanged, userEmail }) {
  const isEmail = draft.channel === 'email'
  return (
    <div className="v2-card">
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{channelLabel(draft.channel)}</span>
        <span className={`v2-badge ${MESSAGE_STATUS_BADGE[draft.status] || 'v2-badge-neutral'}`}>
          {MESSAGE_STATUS_LABEL[draft.status] || draft.status}
        </span>
      </div>
      {isEmail && draft.subject && (
        <div style={{ marginBottom: '0.4rem' }}>
          <div className="v2-kv-label">Subject</div>
          <div className="v2-kv-value">{draft.subject}</div>
        </div>
      )}
      {draft.message_text ? (
        <p style={{ color: 'var(--v2-text)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{draft.message_text}</p>
      ) : (
        <EmptyBlock title="No usable message was produced." body={cleanBackendText((draft.missing_information || []).join(' · ')) || null} />
      )}
      {draft.quality_gate_reasons?.length > 0 && (
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
          Needs review: {draft.quality_gate_reasons.join(' · ')}
        </p>
      )}
      {draft.status === 'approved' && (
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
          Approved by {draft.approved_by || 'a reviewer'}
        </p>
      )}
      {draft.status === 'ready_for_review' && <MessageReviewActions draft={draft} onChanged={onChanged} userEmail={userEmail} />}
      {draft.status !== 'approved' && <RegenerateControl draft={draft} onChanged={onChanged} />}
    </div>
  )
}

const MESSAGE_CHANNEL_TABS = ['Message', 'Email']

// Phase 3 -- consumes GET /gtm-os/accounts/{id}/messages (list_messages_for_company(), Batch 7's
// MessageDraft). V2 Frontend Phase (Message Workspace): split into a Message (LinkedIn-channel
// drafts) / Email (email-channel drafts) sub-tab, matching each draft's own real `channel` field
// -- never fabricated, since a MessageDraft is generated for exactly one channel at a time (no V1-
// style dual LinkedIn+email content on one row). Now actionable (approve/reject/request-changes/
// regenerate/change-recipient), reusing the exact same real lifecycle OpportunityDetail's Message
// Review tab already established -- that tab is left untouched.
function MessagesTab({ companyId }) {
  const { user } = useTenant()
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState(null)
  const [channelTab, setChannelTab] = useState('Message')

  const load = () => {
    getAccountMessages(companyId)
      .then(data => setMessages(data.messages))
      .catch(err => setError(formatApiError(err)))
  }

  useEffect(load, [companyId])

  if (error) {
    return <div className="v2-card"><div className="v2-state v2-state-error">Couldn't load messages: {error}</div></div>
  }

  if (messages === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 100 }} />
  }

  if (messages.length === 0) {
    return (
      <div className="v2-card">
        <EmptyBlock
          title="No message drafts yet"
          body="A draft becomes available once an opportunity's strategy and readiness are ready for a message. This page only displays drafts that already exist -- it never generates one."
        />
      </div>
    )
  }

  const filtered = messages.filter(m => (channelTab === 'Email' ? m.channel === 'email' : m.channel !== 'email'))

  return (
    <>
      <div className="v2-config-tabs">
        {MESSAGE_CHANNEL_TABS.map(tab => (
          <button key={tab} type="button" className={`v2-config-tab${channelTab === tab ? ' active' : ''}`} onClick={() => setChannelTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="v2-card">
          <EmptyBlock title={`No ${channelTab.toLowerCase()} drafts`} body={`No draft with channel="${channelTab === 'Email' ? 'email' : 'linkedin (or another non-email channel)'}" exists for this company yet.`} />
        </div>
      ) : (
        <div className="v2-evidence-list">
          {filtered.map(m => (
            <MessageDraftCard key={m.id} draft={m} onChanged={load} userEmail={user?.email} />
          ))}
        </div>
      )}
    </>
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

  const { company, account_status: accountStatus } = brief
  const added = formatRecency(company.created_at)

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
            {[company.domain, company.industry].filter(Boolean).join(' · ') || 'No firmographic data on file'}
            {added && <span title={added.exact}> · Added {added.label}</span>}
          </div>
        </div>
      </div>

      <AgentSummary brief={brief} />

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

      {activeTab === 'Overview' && <OverviewGrid brief={brief} />}
      {activeTab === 'Evidence' && <EvidenceTab brief={brief} />}
      {activeTab === 'Opportunity & Strategy' && <OpportunityStrategyTab brief={brief} />}
      {activeTab === 'Contacts' && <ContactsTab brief={brief} />}
      {activeTab === 'Messages' && <MessagesTab companyId={companyId} />}
    </div>
  )
}
