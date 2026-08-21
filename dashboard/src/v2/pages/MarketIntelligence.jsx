import { useEffect, useState } from 'react'
import { getMarketIntelligence, formatApiError } from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconTrendingDown, IconMinus } from '../icons.jsx'

// evaluate_topic_trend()'s own six real states, reused verbatim -- never a numeric score, never a
// state this frontend invents. TIER only decides visual weight/tone; the label shown is always
// one of these six real values, never a paraphrase.
const TREND_META = {
  emerging: { label: 'Emerging', Icon: IconTrendingUp, tier: 'strong' },
  accelerating: { label: 'Accelerating', Icon: IconTrendingUp, tier: 'strong' },
  persistent: { label: 'Persistent', Icon: IconMinus, tier: 'some' },
  stable: { label: 'Stable', Icon: IconMinus, tier: 'some' },
  declining: { label: 'Declining', Icon: IconTrendingDown, tier: 'declining' },
  insufficient_evidence: { label: 'Insufficient evidence', Icon: IconMinus, tier: 'insufficient' },
}

const TIER_TONE = {
  strong: 'tone-success-solid',
  some: 'tone-info-soft',
  declining: 'tone-warning-solid',
  insufficient: 'tone-neutral',
}

// strong > some > declining > insufficient -- ranks real evidence weight, never a new metric.
// Array.prototype.sort is stable, so topics within the same tier keep their original API order;
// when every topic is insufficient_evidence (current production reality), nothing gets reordered.
const TIER_RANK = { strong: 3, some: 2, declining: 1, insufficient: 0 }

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function EvidenceBlock({ eyebrow, value, note, tone }) {
  return (
    <div className={`v2-mi-evidence-block${tone ? ` ${tone}` : ''}`}>
      <div className="v2-mi-evidence-eyebrow">{eyebrow}</div>
      <div className="v2-mi-evidence-value">{value}</div>
      {note && <div className="v2-mi-evidence-note">{note}</div>}
    </div>
  )
}

function TopicRow({ topic }) {
  const meta = TREND_META[topic.state] || TREND_META.insufficient_evidence
  const Icon = meta.Icon
  const hasAccountEvidence = topic.account_bridge.linked_account_count > 0

  return (
    <div className={`v2-mi-row tier-${meta.tier}`}>
      <div className="v2-mi-row-head">
        <div className="v2-mi-row-title">
          <span className="v2-mi-row-name">{topic.canonical_name}</span>
          <span className="v2-status-pill tone-neutral">{topic.origin}</span>
        </div>
        <span className={`v2-status-pill ${TIER_TONE[meta.tier]}`}>
          <Icon width={12} height={12} />
          {meta.label}
        </span>
      </div>

      <p className="v2-mi-explanation">{topic.explanation}</p>

      {topic.aliases?.length > 0 && (
        <div className="v2-mi-chip-row">
          {topic.aliases.map(alias => <span key={alias} className="v2-mi-chip">{alias}</span>)}
        </div>
      )}

      {/* Market evidence ("what's happening in the market") and account evidence ("which real
          accounts can we defensibly connect to it") stay visually and conceptually separate --
          a trending topic is never, by itself, evidence any specific account is affected. */}
      <div className="v2-mi-evidence-row">
        <EvidenceBlock
          eyebrow="Market evidence"
          value={`${topic.recent_observation_count} recent observation${topic.recent_observation_count === 1 ? '' : 's'}`}
          note={
            `${topic.previous_observation_count} in the prior window · ${topic.recent_independent_entity_count} independent source${topic.recent_independent_entity_count === 1 ? '' : 's'}`
            + (topic.recent_source_diversity?.length > 0 ? ` (${topic.recent_source_diversity.join(', ')})` : '')
          }
        />
        <EvidenceBlock
          eyebrow="Account evidence"
          value={`${topic.account_bridge.linked_account_count} defensible linked account${topic.account_bridge.linked_account_count === 1 ? '' : 's'}`}
          note={topic.account_bridge.note}
          tone={hasAccountEvidence ? 'has-evidence' : undefined}
        />
      </div>

      {topic.first_seen_at && (
        <div className="v2-mi-meta">
          First seen {formatDate(topic.first_seen_at)} · last seen {formatDate(topic.last_seen_at)} · {topic.observation_span_days} day span
        </div>
      )}
    </div>
  )
}

// Answers "what's trending in the market, how strong/recent is it, and where do we have real
// account-level evidence" -- distinct from Demand Grid's decision-oriented ICP x Offering view.
// Every number here is read verbatim from evaluate_topic_trend()/the account bridge, never
// recomputed or scored in this file. Topics are tiered by their own real state so a scan of the
// page answers "which topic has the strongest evidence" without reading every row.
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

  const sorted = topics
    ? [...topics].sort((a, b) => TIER_RANK[(TREND_META[b.state] || TREND_META.insufficient_evidence).tier] - TIER_RANK[(TREND_META[a.state] || TREND_META.insufficient_evidence).tier])
    : null
  const activeCount = topics ? topics.filter(t => t.state !== 'insufficient_evidence').length : 0

  return (
    <div className="v2-mi-page">
      <div className="v2-page-eyebrow">Monitor market signals and connect them to account-level evidence</div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load market intelligence: {error}</div>
          </div>
        </div>
      ) : topics === null ? (
        <div className="v2-mi-list">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 160 }} />)}
        </div>
      ) : topics.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">No topics are configured yet for this tenant.</div>
        </div>
      ) : (
        <>
          <div className="v2-mi-summary">
            <span className="v2-mi-summary-value">{activeCount} of {topics.length}</span>
            <span className="v2-mi-summary-label">topics have current market evidence</span>
          </div>
          <div className="v2-mi-list">
            {sorted.map(t => <TopicRow key={t.content_topic_id} topic={t} />)}
          </div>
        </>
      )}
    </div>
  )
}
