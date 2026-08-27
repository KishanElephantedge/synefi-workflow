import { useEffect, useState } from 'react'
import { getCampaignIntelligence, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

function formatUsd(value) {
  if (!value) return '$0'
  return `$${Number(value).toLocaleString()}`
}

function formatPercent(rate) {
  return rate == null ? 'Not enough data yet' : `${(rate * 100).toFixed(1)}%`
}

function CampaignCard({ campaign }) {
  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{campaign.campaign_name || campaign.campaign_uuid}</span>
        {campaign.offering_name && <span className="v2-badge v2-badge-info">{campaign.offering_name}</span>}
      </div>

      <div className="v2-stat-row" style={{ marginTop: '0.8rem' }}>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Sent</div>
          <div className="v2-stat-value">{campaign.sent}</div>
        </div>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Accepted</div>
          <div className="v2-stat-value">{campaign.accepted}</div>
        </div>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Replied</div>
          <div className="v2-stat-value">{campaign.replied}</div>
        </div>
      </div>

      <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
        <div>
          <div className="v2-kv-label">Accept rate</div>
          <div className="v2-kv-value">{formatPercent(campaign.accept_rate)}</div>
        </div>
        <div>
          <div className="v2-kv-label">Reply rate</div>
          <div className="v2-kv-value">{formatPercent(campaign.reply_rate)}</div>
        </div>
        <div>
          <div className="v2-kv-label">Deals won / lost</div>
          <div className="v2-kv-value">{campaign.deals_won} / {campaign.deals_lost}</div>
        </div>
        <div>
          <div className="v2-kv-label">Revenue won</div>
          <div className="v2-kv-value">{formatUsd(campaign.revenue_won_usd)}</div>
        </div>
      </div>

      {campaign.meetings_with_recorded_outcome === 0 && (campaign.accepted > 0 || campaign.replied > 0) && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
          Real activity on this campaign, but no meeting outcome recorded yet — record one on the Meetings page once a deal closes.
        </p>
      )}
    </div>
  )
}

// Real, live per-campaign numbers (GET /gtm-os/campaign-intelligence -> SalesRobot's own API,
// same source V1's Campaign tab already uses) plus a grounded LLM reasoning layer on top. The
// intelligence section is the one AI-generated narrative in this app -- unlike Briefing/Governance/
// Revenue Pace's diagnosis (all pure real-count compositions, zero LLM calls), this one genuinely
// reasons across campaigns to compare/prioritize toward revenue -- so it's labeled as such, and
// every claim in it has already been server-side verified against the real numbers shown above
// before it's allowed to render at all (a claim citing a campaign never actually given is
// discarded before this page ever sees it).
function IntelligenceSection({ intelligence }) {
  if (intelligence.status === 'insufficient_data') {
    return (
      <div className="v2-card">
        <div className="v2-state">Not enough real campaign activity yet to compare and prioritize.</div>
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
        <span className="v2-config-card-title">What's actually working</span>
        <span className="v2-badge v2-badge-neutral">AI-reasoned, grounded in the numbers above</span>
      </div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 0 }}>{intelligence.diagnosis}</p>
      <div className="v2-kv-label" style={{ marginTop: '0.8rem' }}>Priority recommendation</div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 4, marginBottom: 0 }}>{intelligence.priority_recommendation}</p>
    </div>
  )
}

export default function Campaigns() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCampaignIntelligence().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load campaigns: {error}</div>
        </div>
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="v2-account-list">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 160 }} />)}
      </div>
    )
  }
  if (data.status !== 'ok') {
    return (
      <div className="v2-card">
        <div className="v2-state">Couldn't reach SalesRobot right now — real numbers aren't available this load.{data.reason ? ` (${data.reason})` : ''}</div>
      </div>
    )
  }

  return (
    <div>
      <IntelligenceSection intelligence={data.intelligence} />
      <div style={{ marginTop: '1rem' }}>
        {data.campaigns.map(c => <CampaignCard key={c.campaign_uuid} campaign={c} />)}
      </div>
    </div>
  )
}
