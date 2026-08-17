import { useEffect, useState } from 'react'
import { getMarketIntelligence, formatApiError } from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconTrendingDown, IconMinus } from '../icons.jsx'

// state -> badge tone + direction icon. Reuses evaluate_topic_trend()'s own six states verbatim
// (Batch 2/6) -- never a numeric trend score, never a state this module invents.
const TREND_META = {
  emerging: { badge: 'v2-badge-info', Icon: IconTrendingUp },
  accelerating: { badge: 'v2-badge-success', Icon: IconTrendingUp },
  persistent: { badge: 'v2-badge-info', Icon: IconMinus },
  stable: { badge: 'v2-badge-neutral', Icon: IconMinus },
  declining: { badge: 'v2-badge-warning', Icon: IconTrendingDown },
  insufficient_evidence: { badge: 'v2-badge-neutral', Icon: IconMinus },
}

const TREND_LABEL = {
  emerging: 'Emerging',
  accelerating: 'Accelerating',
  persistent: 'Persistent',
  stable: 'Stable',
  declining: 'Declining',
  insufficient_evidence: 'Insufficient evidence',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function TrendCard({ topic }) {
  const meta = TREND_META[topic.state] || TREND_META.insufficient_evidence
  const Icon = meta.Icon
  const hasAccountEvidence = topic.account_bridge.linked_account_count > 0

  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-trend-card-head">
        <div className="v2-trend-card-title">
          {topic.canonical_name}
          <span className="v2-badge v2-badge-neutral">{topic.origin}</span>
        </div>
        <span className={`v2-badge ${meta.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon width={12} height={12} />
          {TREND_LABEL[topic.state] || topic.state}
        </span>
      </div>

      <p className="v2-placeholder-note">{topic.explanation}</p>

      {topic.aliases?.length > 0 && (
        <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>Also tracked as: {topic.aliases.join(', ')}</p>
      )}

      {/* Market evidence vs. account evidence, kept visibly separate -- Part 5's own boundary:
          a trending topic is never, by itself, evidence that any specific account is affected. */}
      <div className="v2-evidence-split">
        <div className="v2-evidence-split-block">
          <div className="v2-kv-label">Market evidence</div>
          <div className="v2-kv-value">{topic.recent_observation_count} recent observation{topic.recent_observation_count === 1 ? '' : 's'}</div>
          <p className="v2-placeholder-note" style={{ marginBottom: 0, marginTop: 4 }}>
            {topic.previous_observation_count} in the prior window · {topic.recent_independent_entity_count} independent source{topic.recent_independent_entity_count === 1 ? '' : 's'}
            {topic.recent_source_diversity?.length > 0 && ` (${topic.recent_source_diversity.join(', ')})`}
          </p>
        </div>
        <div className={`v2-evidence-split-block account-evidence${hasAccountEvidence ? ' has-evidence' : ''}`}>
          <div className="v2-kv-label">Account evidence</div>
          <div className="v2-kv-value">
            {topic.account_bridge.linked_account_count} defensible linked account{topic.account_bridge.linked_account_count === 1 ? '' : 's'}
          </div>
          {topic.account_bridge.note && (
            <p className="v2-placeholder-note" style={{ marginBottom: 0, marginTop: 4 }}>{topic.account_bridge.note}</p>
          )}
        </div>
      </div>

      <p className="v2-placeholder-note" style={{ marginTop: '0.7rem', marginBottom: 0, fontSize: '0.78rem' }}>
        First seen {formatDate(topic.first_seen_at)} · last seen {formatDate(topic.last_seen_at)} · {topic.observation_span_days} day span
      </p>
    </div>
  )
}

// Answers "what's trending in the market, how strong/recent is it, and where do we have real
// account-level evidence" -- distinct from Demand Grid's decision-oriented ICP x Offering view
// (Part 2). Every number here is read verbatim from evaluate_topic_trend()/the Batch 11 bridge,
// never recomputed or scored in this file.
export default function MarketIntelligence() {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMarketIntelligence()
      .then(data => { if (!cancelled) setTopics(data.topics) })
      .catch(err => { if (!cancelled) setError(formatApiError(err)) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load market intelligence: {error}</div>
          </div>
        </div>
      ) : topics === null ? (
        <div className="v2-account-list">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 180 }} />)}
        </div>
      ) : topics.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">No topics are configured yet for this tenant.</div>
        </div>
      ) : (
        topics.map(t => <TrendCard key={t.content_topic_id} topic={t} />)
      )}
    </div>
  )
}
