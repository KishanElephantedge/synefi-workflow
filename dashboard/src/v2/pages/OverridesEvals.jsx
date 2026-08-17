import { useEffect, useState } from 'react'
import { getOverridesEvals, confirmPattern, dismissPattern, formatApiError } from '../api.js'
import { IconAlertTriangle, IconCheck, IconX } from '../icons.jsx'

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

function OverrideRow({ item }) {
  return (
    <div style={{ marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--v2-border)' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{item.company_name || `Opportunity #${item.opportunity_id ?? '—'}`}</span>
        <span className="v2-badge v2-badge-neutral">{item.status ? item.status.replace(/_/g, ' ') : 'lost'}</span>
      </div>
      <div className="v2-kv-grid" style={{ marginTop: '0.4rem' }}>
        <div>
          <div className="v2-kv-label">Category</div>
          <div className="v2-kv-value">{CATEGORY_LABEL[item.category] || item.category}</div>
        </div>
        <div>
          <div className="v2-kv-label">When</div>
          <div className="v2-kv-value">{formatDateTime(item.reviewed_at || item.outcome_recorded_at)}</div>
        </div>
      </div>
      {item.reason && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.4rem', marginBottom: 0 }}>&ldquo;{item.reason}&rdquo;</p>
      )}
    </div>
  )
}

function CandidatePatternCard({ pattern, onDecided }) {
  const [saving, setSaving] = useState(null) // 'confirm' | 'dismiss'
  const [error, setError] = useState(null)

  const decide = async (action) => {
    setSaving(action)
    setError(null)
    try {
      const fn = action === 'confirm' ? confirmPattern : dismissPattern
      await fn(pattern.category, 'v2-user')
      onDecided()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="v2-card" style={{ marginBottom: '0.8rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">{CATEGORY_LABEL[pattern.category] || pattern.category}</span>
        <span className="v2-badge v2-badge-warning">{pattern.occurrence_count} occurrences</span>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: 0 }}>{pattern.pattern_description}</p>
      <div className="v2-kv-grid">
        <div>
          <div className="v2-kv-label">Trigger</div>
          <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{pattern.trigger_description}</div>
        </div>
        <div>
          <div className="v2-kv-label">Lookback period</div>
          <div className="v2-kv-value">{pattern.lookback_days} days</div>
        </div>
      </div>
      <div style={{ marginTop: '0.6rem' }}>
        <div className="v2-kv-label">Supporting evidence</div>
        <ul style={{ margin: '4px 0 0', paddingLeft: '1.1rem', color: 'var(--v2-text)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          {pattern.source_event_refs.map((ref, i) => (
            <li key={i}>{ref.reason || '(no reason text)'} <span className="v2-field-hint">({ref.source_type} #{ref.source_id})</span></li>
          ))}
        </ul>
      </div>
      {pattern.previously_dismissed && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.5rem', marginBottom: 0 }}>Previously dismissed -- recurring again since then.</p>
      )}
      <FormMessage error={error} />
      <div className="v2-btn-row" style={{ marginTop: '0.7rem' }}>
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

function DecidedPatternRow({ pattern, status }) {
  return (
    <div style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--v2-border)' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{CATEGORY_LABEL[pattern.category] || pattern.category}</span>
        <span className={`v2-badge ${status === 'confirmed' ? 'v2-badge-success' : 'v2-badge-neutral'}`}>{status}</span>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: '0.3rem', marginBottom: 0 }}>{pattern.pattern_description}</p>
      <div className="v2-field-hint">{pattern.confirmed_by} · {formatDateTime(pattern.confirmed_at)}</div>
    </div>
  )
}

// The first real layer of the learning loop: recommendation -> human review -> action -> outcome
// -> evaluation -> candidate pattern -> human confirmation. Everything here reads MessageDraft's
// own review lifecycle and CalendarBooking's own outcome fields -- no second review/outcome
// engine. No accuracy % is shown (see the "Not defensible yet" note) since no ground-truth
// "correct recommendation" concept exists anywhere in this backend. Confirming or dismissing a
// pattern only ever writes to that one pattern -- it never changes ICP/offering/GTM-motion
// config, strategy, message drafts, or the revenue goal. Automatic adaptation is future work.
export default function OverridesEvals() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    getOverridesEvals().then(setData).catch(err => setError(formatApiError(err)))
  }

  useEffect(load, [])

  return (
    <div>
      <div style={{ marginBottom: 'var(--v2-space-5)' }}>
        <p className="v2-placeholder-note" style={{ marginTop: '0.4rem' }}>
          What the system recommended, what got overridden or lost, and why -- the foundation for
          learning, not yet a learning system. Confirming a pattern here records institutional
          knowledge; it does not change any recommendation automatically.
        </p>
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
          <div className="v2-stat-row" style={{ marginBottom: '1rem' }}>
            <MetricTile label="Rejected this month" value={data.metrics.messages_rejected} />
            <MetricTile label="Changes requested" value={data.metrics.messages_changes_requested} />
            <MetricTile label="Lost, with reason" value={data.metrics.meetings_lost_with_reason} />
            <MetricTile label="Won" value={data.metrics.meetings_won} />
            <MetricTile label="Traced to an opportunity" value={`${data.metrics.outcomes_linked_to_opportunity} / ${data.metrics.outcomes_total}`} />
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">Accuracy</span>
              <span className="v2-badge v2-badge-neutral">Not available</span>
            </div>
            <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>{data.metrics.accuracy.reason}</p>
          </div>

          <div className="v2-config-tabs" style={{ marginBottom: '0.6rem' }}>
            <span className="v2-page-eyebrow">Candidate patterns requiring confirmation</span>
          </div>
          {data.candidate_patterns.length === 0 ? (
            <div className="v2-card" style={{ marginBottom: '1rem' }}>
              <div className="v2-state">No category has recurred enough times yet to surface a candidate pattern (threshold: {data.detection_config.min_occurrences} in {data.detection_config.lookback_days} days).</div>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              {data.candidate_patterns.map(p => <CandidatePatternCard key={p.category} pattern={p} onDecided={load} />)}
            </div>
          )}

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head"><span className="v2-config-card-title">Confirmed patterns</span></div>
            {data.confirmed_patterns.length === 0 ? (
              <div className="v2-state">None confirmed yet.</div>
            ) : (
              data.confirmed_patterns.map(p => <DecidedPatternRow key={p.id} pattern={p} status="confirmed" />)
            )}
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head"><span className="v2-config-card-title">Dismissed patterns</span></div>
            {data.dismissed_patterns.length === 0 ? (
              <div className="v2-state">None dismissed yet.</div>
            ) : (
              data.dismissed_patterns.map(p => <DecidedPatternRow key={p.id} pattern={p} status="dismissed" />)
            )}
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head"><span className="v2-config-card-title">Recent overrides</span></div>
            {data.recent_overrides.length === 0 ? (
              <div className="v2-state">No rejected or changes-requested message drafts yet.</div>
            ) : (
              data.recent_overrides.map(item => <OverrideRow key={`${item.source_type}-${item.source_id}`} item={item} />)
            )}
          </div>

          <div className="v2-card">
            <div className="v2-config-card-head"><span className="v2-config-card-title">Recent lost outcomes</span></div>
            {data.recent_losses.length === 0 ? (
              <div className="v2-state">No lost meeting outcomes recorded yet.</div>
            ) : (
              data.recent_losses.map(item => <OverrideRow key={`${item.source_type}-${item.source_id}`} item={item} />)
            )}
          </div>
        </>
      )}
    </div>
  )
}
