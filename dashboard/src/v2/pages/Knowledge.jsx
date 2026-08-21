import { useEffect, useState } from 'react'
import { getKnowledge, submitKnowledge, confirmKnowledge, dismissKnowledge, formatApiError } from '../api.js'
import { useTenant } from '../../context/TenantContext.jsx'
import { IconAlertTriangle } from '../icons.jsx'

// "Teach the GTM OS something" (architecture upgrade, Parts 6-8) -- deliberately a plain
// submit-and-review form, NOT a chatbot. A human writes one business observation; the system
// shows back exactly what it understood (or that it couldn't interpret it) plus the real
// provenance fields, and the human explicitly confirms or dismisses it. Confirming NEVER changes
// ICP/offering/GTM-motion config -- see the backend module's own governance boundary.
const STATUS_META = {
  pending_review: { badge: 'v2-badge-info', label: 'Pending review' },
  pending_interpretation: { badge: 'v2-badge-neutral', label: 'Interpretation unavailable' },
  confirmed: { badge: 'v2-badge-success', label: 'Confirmed' },
  dismissed: { badge: 'v2-badge-neutral', label: 'Dismissed' },
}

function KnowledgeCard({ item, onConfirm, onDismiss, busy }) {
  const meta = STATUS_META[item.status] || STATUS_META.pending_review
  return (
    <div className="v2-card" style={{ marginBottom: '0.9rem' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{item.original_text}</span>
        <span className={`v2-badge ${meta.badge}`}>{meta.label}</span>
      </div>

      {item.interpretation ? (
        <div className="v2-kv-grid" style={{ marginTop: '0.6rem' }}>
          <KVRow label="Understood as" value={item.interpretation.summary} />
          {item.interpretation.condition && <KVRow label="Condition" value={item.interpretation.condition} />}
          {item.interpretation.implication && <KVRow label="Implication" value={item.interpretation.implication} />}
          {item.interpretation.signal_type && <KVRow label="Signal type" value={item.interpretation.signal_type.replace(/_/g, ' ')} />}
        </div>
      ) : (
        <p className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          Interpretation unavailable — the original statement is still saved as-is.
        </p>
      )}

      <div className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
        Source: human input{item.created_by ? ` · ${item.created_by}` : ''} · {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
      </div>

      {(item.status === 'pending_review' || item.status === 'pending_interpretation') && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
          <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => onConfirm(item.id)}>Confirm</button>
          <button type="button" className="v2-btn" disabled={busy} onClick={() => onDismiss(item.id)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}

function KVRow({ label, value }) {
  return (
    <div>
      <div className="v2-kv-label">{label}</div>
      <div className="v2-kv-value">{value}</div>
    </div>
  )
}

export default function Knowledge() {
  const { user } = useTenant()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    getKnowledge().then(setItems).catch(err => setError(formatApiError(err)))
  }

  useEffect(load, [])

  const handleSubmit = e => {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    submitKnowledge(text.trim(), user?.email)
      .then(() => {
        setText('')
        load()
      })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setSubmitting(false))
  }

  const handleConfirm = id => {
    setBusyId(id)
    confirmKnowledge(id, user?.email).then(load).catch(err => setError(formatApiError(err))).finally(() => setBusyId(null))
  }
  const handleDismiss = id => {
    setBusyId(id)
    dismissKnowledge(id, user?.email).then(load).catch(err => setError(formatApiError(err))).finally(() => setBusyId(null))
  }

  return (
    <div>
      <p className="v2-placeholder-note">
        Tell the GTM OS something you know — a pattern you've noticed, a heuristic about who buys.
        This becomes labeled human-provided knowledge the system can consider alongside real evidence.
        It never automatically changes ICP, offering, or GTM motion configuration.
      </p>

      <form onSubmit={handleSubmit} className="v2-card" style={{ marginBottom: '1.2rem' }}>
        <textarea
          className="v2-textarea"
          rows={3}
          placeholder="e.g. Companies hiring more than 10 salespeople usually need our sales enablement offering."
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ width: '100%', resize: 'vertical' }}
        />
        <div style={{ marginTop: '0.7rem' }}>
          <button type="submit" className="v2-btn v2-btn-primary" disabled={!text.trim() || submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>

      {error && (
        <div className="v2-card" style={{ marginBottom: '1.2rem' }}>
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 120 }} />
      ) : items.length === 0 ? (
        <div className="v2-card"><div className="v2-state">Nothing submitted yet.</div></div>
      ) : (
        items.map(item => (
          <KnowledgeCard key={item.id} item={item} onConfirm={handleConfirm} onDismiss={handleDismiss} busy={busyId === item.id} />
        ))
      )}
    </div>
  )
}
