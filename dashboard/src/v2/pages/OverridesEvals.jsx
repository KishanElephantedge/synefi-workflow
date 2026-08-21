import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext.jsx'
import { getOverridesEvals, confirmPattern, dismissPattern, formatApiError } from '../api.js'
import { IconAlertTriangle, IconCheck, IconX } from '../icons.jsx'

const KNOWLEDGE_STATUS_TONE = {
  confirmed: 'tone-success-solid', dismissed: 'tone-neutral',
  pending_review: 'tone-warning-solid', pending_interpretation: 'tone-warning-solid',
}

const CATEGORY_LABEL = {
  pricing: 'Pricing', budget: 'Budget', timing: 'Timing', wrong_person: 'Wrong person',
  wrong_fit: 'Wrong fit', competition: 'Competition', feature_gap: 'Feature gap',
  no_response: 'No response', messaging: 'Messaging', unknown: 'Uncategorized',
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function FormMessage({ error }) {
  if (!error) return null
  return <div className="v2-form-message error">{error}</div>
}

function MetricTile({ label, value }) {
  return (
    <div className="v2-stat-tile">
      <div className="v2-stat-label">{label}</div>
      <div className="v2-stat-value">{value}</div>
    </div>
  )
}

// Compact single-line empty state -- used instead of a full "None yet" card so an empty section
// still reads as an intentional, honest state rather than wasted vertical space.
function QuietEmpty({ text }) {
  return <div className="v2-oe-quiet-empty">{text}</div>
}

// Real rejected-message / lost-meeting event, already returned by the API -- rendered as a
// compact row (not a full card) so Recent overrides and Recent losses read as one related list
// language rather than two more stacked cards.
function EventRow({ item }) {
  return (
    <div className="v2-oe-event-row">
      <div className="v2-oe-event-top">
        <span className="v2-oe-event-name">{item.company_name || `Opportunity #${item.opportunity_id ?? '—'}`}</span>
        <span className="v2-status-pill tone-neutral">{CATEGORY_LABEL[item.category] || item.category}</span>
      </div>
      {item.reason && <p className="v2-oe-event-reason">&ldquo;{item.reason}&rdquo;</p>}
      <div className="v2-oe-event-meta">
        {item.status && <><span className="v2-oe-event-status">{item.status.replace(/_/g, ' ')}</span> · </>}
        {formatDateTime(item.reviewed_at || item.outcome_recorded_at)}
      </div>
    </div>
  )
}

// The most actionable section on this page: a real, threshold-detected recurring category, still
// requiring a human decision. Strongest visual presence -- an accent border, not just another
// flat card -- since this is the one place this page asks for something.
function CandidatePatternCard({ pattern, confirmedBy, onDecided }) {
  const [saving, setSaving] = useState(null) // 'confirm' | 'dismiss'
  const [error, setError] = useState(null)

  const decide = async (action) => {
    setSaving(action)
    setError(null)
    try {
      const fn = action === 'confirm' ? confirmPattern : dismissPattern
      await fn(pattern.category, confirmedBy)
      onDecided()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="v2-oe-candidate">
      <div className="v2-oe-candidate-head">
        <span className="v2-oe-candidate-name">{CATEGORY_LABEL[pattern.category] || pattern.category}</span>
        <span className="v2-status-pill tone-warning-solid">{pattern.occurrence_count} occurrences</span>
      </div>
      <p className="v2-oe-candidate-desc">{pattern.pattern_description}</p>
      <div className="v2-oe-evidence-row">
        <div className="v2-oe-evidence-block">
          <div className="v2-oe-evidence-eyebrow">Trigger</div>
          <div className="v2-oe-evidence-value small">{pattern.trigger_description}</div>
        </div>
        <div className="v2-oe-evidence-block">
          <div className="v2-oe-evidence-eyebrow">Lookback period</div>
          <div className="v2-oe-evidence-value">{pattern.lookback_days} days</div>
        </div>
      </div>
      <div className="v2-oe-candidate-refs">
        <div className="v2-oe-evidence-eyebrow">Supporting evidence</div>
        <ul>
          {pattern.source_event_refs.map((ref, i) => (
            <li key={i}>{ref.reason || '(no reason text)'} <span className="v2-field-hint">({ref.source_type} #{ref.source_id})</span></li>
          ))}
        </ul>
      </div>
      {pattern.previously_dismissed && (
        <p className="v2-oe-note">Previously dismissed -- recurring again since then.</p>
      )}
      <FormMessage error={error} />
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={!!saving} onClick={() => decide('confirm')}>
          <IconCheck width={13} height={13} /> {saving === 'confirm' ? 'Confirming…' : 'Confirm'}
        </button>
        <button type="button" className="v2-btn" disabled={!!saving} onClick={() => decide('dismiss')}>
          <IconX width={13} height={13} /> {saving === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}

// Confirmed = a human decided this pattern is real institutional knowledge -- shown with real
// presence (success tone), but never implies it changes any autonomous behavior (it doesn't).
// Dismissed = the same record kept quieter, since it's a "no" rather than a "yes".
function DecidedPatternRow({ pattern, status }) {
  return (
    <div className="v2-oe-decided-row">
      <div className="v2-oe-event-top">
        <span className="v2-oe-event-name">{CATEGORY_LABEL[pattern.category] || pattern.category}</span>
        <span className={`v2-status-pill ${status === 'confirmed' ? 'tone-success-solid' : 'tone-neutral'}`}>{status}</span>
      </div>
      <p className="v2-oe-event-reason">{pattern.pattern_description}</p>
      <div className="v2-oe-event-meta">{pattern.confirmed_by || 'unknown'} · {formatDateTime(pattern.confirmed_at)}</div>
    </div>
  )
}

// V2 Phase 9 -- read-only surface for HumanKnowledge (app/gtm_os/learning/human_knowledge.py),
// a real, already-functioning capability with no frontend anywhere yet. Deliberately read-only
// here (no submit/confirm/dismiss form) -- this phase only makes the existing readout visible;
// it does not build new input UI. original_text is always shown verbatim; interpretation (a
// small LLM-derived heuristic) is shown alongside it, never replacing it, and only when present
// (a failed interpretation still keeps the row, with interpretation=null).
function HumanKnowledgeRow({ item }) {
  return (
    <div className="v2-oe-event-row">
      <div className="v2-oe-event-top">
        <span className="v2-oe-event-name">&ldquo;{item.original_text}&rdquo;</span>
        <span className={`v2-status-pill ${KNOWLEDGE_STATUS_TONE[item.status] || 'tone-neutral'}`}>{item.status.replace(/_/g, ' ')}</span>
      </div>
      {item.interpretation?.summary && <p className="v2-oe-event-reason">{item.interpretation.summary}</p>}
      <div className="v2-oe-event-meta">{item.created_by || 'unknown'} · {formatDateTime(item.created_at)}</div>
    </div>
  )
}

// The first real layer of the learning loop: recommendation -> human review -> action -> outcome
// -> categorization -> candidate pattern -> human confirmation. Everything here reads MessageDraft's
// own review lifecycle and CalendarBooking's own outcome fields -- no second review/outcome
// engine. No accuracy % is shown (see the "Not available" block) since no ground-truth "correct
// recommendation" concept exists anywhere in this backend. Confirming or dismissing a pattern
// only ever writes to that one pattern -- it never changes ICP/offering/GTM-motion config,
// strategy, message drafts, the revenue goal, or any autonomous-run behavior. Automatic
// adaptation is future work, not implied anywhere on this page.
export default function OverridesEvals() {
  const { user } = useTenant()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    getOverridesEvals().then(setData).catch(err => setError(formatApiError(err)))
  }

  useEffect(load, [])

  return (
    <div className="v2-oe-page">
      <div className="v2-page-eyebrow">
        Recurring reasons behind rejected messages and lost meetings -- confirm or dismiss a pattern as institutional knowledge.
        Message-pipeline volume and outcomes-by-strategy-type live in{' '}
        <Link to="/v2/settings?tab=performance">Settings → Performance</Link>.
      </div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load overrides &amp; evals: {error}</div>
          </div>
        </div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : (
        <>
          <div className="v2-stat-row">
            <MetricTile label="Rejected this month" value={data.metrics.messages_rejected} />
            <MetricTile label="Changes requested" value={data.metrics.messages_changes_requested} />
            <MetricTile label="Won" value={data.metrics.meetings_won} />
            <MetricTile label="Lost" value={data.metrics.meetings_lost} />
            <MetricTile label="Traced to an opportunity" value={`${data.metrics.outcomes_linked_to_opportunity} / ${data.metrics.outcomes_total}`} />
          </div>

          <div className="v2-oe-accuracy">
            <span className="v2-status-pill tone-neutral">Accuracy: not available</span>
            <span className="v2-oe-accuracy-reason">{data.metrics.accuracy.reason}</span>
          </div>

          <div className="v2-oe-section">
            <div className="v2-oe-section-title">Recurring reasons</div>
            <p className="v2-oe-accuracy-reason" style={{ marginBottom: 8 }}>
              Every real category seen in overrides/losses this lookback window ({data.detection_config.lookback_days} days) --
              {' '}{data.metrics.meetings_lost_with_reason} of this month's lost meetings included a reason.
              A category below only becomes a candidate pattern once it crosses {data.detection_config.min_occurrences} occurrences.
            </p>
            {data.recurring_categories.length === 0 ? (
              <QuietEmpty text="No categorized reason has recurred yet." />
            ) : (
              <div className="v2-set-tag-row">
                {data.recurring_categories.map(({ category, count }) => (
                  <span key={category} className="v2-status-pill tone-neutral">{CATEGORY_LABEL[category] || category}: {count}</span>
                ))}
              </div>
            )}
          </div>

          <div className="v2-oe-section">
            <div className="v2-oe-section-title">Candidate patterns</div>
            {data.candidate_patterns.length === 0 ? (
              <QuietEmpty text={`No category has recurred enough times yet (threshold: ${data.detection_config.min_occurrences} in ${data.detection_config.lookback_days} days).`} />
            ) : (
              <div className="v2-oe-candidate-list">
                {data.candidate_patterns.map(p => (
                  <CandidatePatternCard key={p.category} pattern={p} confirmedBy={user?.email} onDecided={load} />
                ))}
              </div>
            )}
          </div>

          {data.confirmed_patterns.length > 0 && (
            <div className="v2-oe-section quiet">
              <div className="v2-oe-section-title">Confirmed patterns</div>
              {data.confirmed_patterns.map(p => <DecidedPatternRow key={p.id} pattern={p} status="confirmed" />)}
            </div>
          )}

          {data.dismissed_patterns.length > 0 && (
            <div className="v2-oe-section quiet">
              <div className="v2-oe-section-title">Dismissed patterns</div>
              {data.dismissed_patterns.map(p => <DecidedPatternRow key={p.id} pattern={p} status="dismissed" />)}
            </div>
          )}

          <div className="v2-oe-section">
            <div className="v2-oe-section-title">Recent overrides</div>
            {data.recent_overrides.length === 0 ? (
              <QuietEmpty text="No rejected or changes-requested message drafts yet." />
            ) : (
              <div className="v2-oe-event-list">
                {data.recent_overrides.map(item => <EventRow key={`${item.source_type}-${item.source_id}`} item={item} />)}
              </div>
            )}
          </div>

          <div className="v2-oe-section">
            <div className="v2-oe-section-title">Recent losses</div>
            {data.recent_losses.length === 0 ? (
              <QuietEmpty text="No lost meeting outcomes recorded yet." />
            ) : (
              <div className="v2-oe-event-list">
                {data.recent_losses.map(item => <EventRow key={`${item.source_type}-${item.source_id}`} item={item} />)}
              </div>
            )}
          </div>

          <div className="v2-oe-section quiet">
            <div className="v2-oe-section-title">Human-provided knowledge</div>
            <p className="v2-oe-accuracy-reason" style={{ marginBottom: 8 }}>
              Free-text observations submitted directly by the team -- a learning input, read-only here.
              Never changes ICP, offering, strategy, or message generation automatically.
            </p>
            {data.human_knowledge.length === 0 ? (
              <QuietEmpty text="Nothing submitted yet." />
            ) : (
              <div className="v2-oe-event-list">
                {data.human_knowledge.map(item => <HumanKnowledgeRow key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
