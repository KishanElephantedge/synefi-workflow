import { useEffect, useState } from 'react'
import { getChannelIntelligence, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

const CHANNEL_LABELS = {
  personal_network: 'Personal network',
  linkedin_content: 'LinkedIn content',
  inbound: 'Inbound (website)',
  webinar: 'Webinars',
  outbound: 'Outbound',
  other: 'Other',
}

function formatUsd(value) {
  if (!value) return '$0'
  return `$${Number(value).toLocaleString()}`
}

function ChannelCard({ channelKey, stats }) {
  const isActive = stats.meetings_with_recorded_outcome > 0
  return (
    <div className="v2-card" style={{ marginBottom: '1rem', opacity: isActive ? 1 : 0.7 }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{CHANNEL_LABELS[channelKey] || channelKey}</span>
        {!isActive && <span className="v2-badge v2-badge-neutral">No outcomes recorded yet</span>}
      </div>

      <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
        <div>
          <div className="v2-kv-label">Meetings with recorded outcome</div>
          <div className="v2-kv-value">{stats.meetings_with_recorded_outcome}</div>
        </div>
        <div>
          <div className="v2-kv-label">Deals won / lost</div>
          <div className="v2-kv-value">{stats.deals_won} / {stats.deals_lost}</div>
        </div>
        <div>
          <div className="v2-kv-label">Revenue won</div>
          <div className="v2-kv-value">{formatUsd(stats.revenue_won_usd)}</div>
        </div>
      </div>
    </div>
  )
}

// Same "genuinely reasons, but every claim is server-side verified against real numbers before
// this page ever sees it" discipline as Campaigns.jsx's IntelligenceSection.
function IntelligenceSection({ intelligence }) {
  if (intelligence.status === 'insufficient_data') {
    return (
      <div className="v2-card">
        <div className="v2-state">Not enough real recorded meeting outcomes yet to compare channels.</div>
      </div>
    )
  }
  if (intelligence.status === 'llm_unavailable' || intelligence.status === 'discarded') {
    return (
      <div className="v2-card">
        <div className="v2-state">
          {intelligence.status === 'discarded'
            ? "Couldn't generate a trustworthy comparison this time — discarded rather than shown ungrounded."
            : 'Reasoning is temporarily unavailable — the real numbers above are still accurate.'}
        </div>
      </div>
    )
  }
  return (
    <div className="v2-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">Which channel is actually producing revenue</span>
        <span className="v2-badge v2-badge-neutral">AI-reasoned, grounded in the numbers above</span>
      </div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 0 }}>{intelligence.diagnosis}</p>
      <div className="v2-kv-label" style={{ marginTop: '0.8rem' }}>Priority recommendation</div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 4, marginBottom: 0 }}>{intelligence.priority_recommendation}</p>
    </div>
  )
}

export default function Channels() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getChannelIntelligence().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load channels: {error}</div>
        </div>
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="v2-account-list">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 140 }} />)}
      </div>
    )
  }

  return (
    <div>
      <IntelligenceSection intelligence={data.intelligence} />
      <div style={{ marginTop: '1rem' }}>
        {Object.entries(data.by_channel).map(([key, stats]) => <ChannelCard key={key} channelKey={key} stats={stats} />)}
      </div>
      {data.unattributed_outcomes_count > 0 && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.8rem' }}>
          {data.unattributed_outcomes_count} recorded meeting outcome(s) have no channel attributed — record the channel on the Meetings page so they count here.
        </p>
      )}
    </div>
  )
}
