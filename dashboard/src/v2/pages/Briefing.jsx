import { useEffect, useState } from 'react'
import { getBriefingGovernance, getRevenuePace, refreshBriefingGovernance, formatApiError } from '../api.js'
import { IconAlertTriangle, IconRefreshCw } from '../icons.jsx'
import { KpiTile, MiniCard, MiniItem, SystemBadge, formatUsd, timeAgo } from '../briefingHelpers.jsx'

const PREVIEW_LIMIT = 3

// V2 UI audit redesign (2026-08-18) -- replaces the earlier full-width-row layout with an
// executive KPI strip + 2-column category cards + a prominent bottleneck insight, per the
// lead-reviewed design direction. No new scores/priorities/forecasts are computed here: every
// number still comes straight from evaluate_gtm_governance()'s real output (now read from a
// cached GovernanceSnapshot, see api.js) plus GET /gtm-os/revenue-pace (already real, existing).
// `overallLabel` below is the same plain-English restatement of empty/non-empty real lists this
// page always used -- counting, never scoring.
export default function Briefing() {
  const [gov, setGov] = useState(null)
  const [error, setError] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    getBriefingGovernance().then(setGov).catch(err => setError(formatApiError(err)))
    getRevenuePace().then(setRevenue).catch(() => setRevenue(false)) // false = "couldn't load", distinct from null = "still loading"
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    refreshBriefingGovernance()
      .then(setGov)
      .catch(err => setError(formatApiError(err)))
      .finally(() => setRefreshing(false))
  }

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load governance: {error}</div>
        </div>
      </div>
    )
  }

  if (gov === null) {
    return (
      <div>
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 110, marginBottom: '1.5rem' }} />
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 300 }} />
      </div>
    )
  }

  const configGaps = gov.configuration_gaps || []
  const dataGaps = gov.data_gaps || []
  const opsIssues = gov.operational_issues || []
  const humanAttention = gov.human_attention || []
  const bottleneck = gov.bottlenecks?.[0]
  const execution = gov.execution_readiness || {}

  const revenueLoaded = revenue && revenue !== false
  const revenueValue = revenueLoaded && revenue.target_configured
    ? `${formatUsd(revenue.actual_usd)} / ${formatUsd(revenue.target_usd)}`
    : revenueLoaded ? formatUsd(revenue.actual_usd) : '—'
  const revenueContext = revenueLoaded
    ? (revenue.target_configured ? `${revenue.pace_percent}% of target this month` : 'No target set -- see Revenue Pace')
    : (revenue === false ? 'Unavailable' : 'Loading…')

  return (
    <div>
      <div className="v2-exec-header">
        <div className="v2-exec-header-text">
          <h2 className="v2-page-title" style={{ fontSize: '1.3rem' }}>Executive Briefing</h2>
          <div className="v2-exec-header-sub">Your GTM system at a glance</div>
        </div>
        <div className="v2-exec-refresh">
          {gov.computed_at && <span className="v2-exec-refresh-note">as of {timeAgo(gov.computed_at)}</span>}
          <button type="button" className="v2-btn" onClick={handleRefresh} disabled={refreshing}>
            <IconRefreshCw width={14} height={14} style={{ marginRight: 6, animation: refreshing ? 'v2-spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>

      <div className="v2-kpi-strip">
        <KpiTile label="Revenue" value={revenueValue} context={revenueContext} />
        <KpiTile label="Pipeline" value={execution.evaluated ?? 0} context="opportunities evaluated" />
        <KpiTile label="Companies" value={gov.overview?.total_companies ?? 0} context="in your account database" />
        <KpiTile label="Needs attention" value={humanAttention.length} context="items requiring action" tone={humanAttention.length > 0 ? 'attention' : undefined} />
      </div>

      <div className="v2-card-grid-2">
        <MiniCard
          title="Needs your attention"
          items={humanAttention}
          limit={PREVIEW_LIMIT}
          emptyText="Nothing currently needs attention."
          viewAllTo="/v2/briefing/attention"
          renderItem={(item, i) => (
            <MiniItem key={i} severity={item.category === 'operational' ? 'danger' : 'warning'} title={item.title || item.description} subtitle={item.subtitle} />
          )}
        />
        <MiniCard
          title="Configuration gaps"
          items={configGaps}
          limit={PREVIEW_LIMIT}
          emptyText="No configuration gaps -- every offering/motion this evaluator checks has at least one applicable_icps/applicable_offerings rule set."
          viewAllTo="/v2/briefing/configuration"
          renderItem={(gap, i) => <MiniItem key={i} title={gap.title} subtitle={gap.short_description} />}
        />
        <MiniCard
          title="Data gaps"
          items={dataGaps}
          limit={PREVIEW_LIMIT}
          emptyText="No data gaps found on the fields this evaluator checks."
          viewAllTo="/v2/briefing/data"
          renderItem={(gap, i) => <MiniItem key={i} title={gap.title} subtitle={gap.short_description} />}
        />
        <MiniCard
          title="System health"
          items={opsIssues}
          limit={PREVIEW_LIMIT}
          emptyText="No recorded run failures -- V1 discovery and GTM-OS are both operating normally."
          viewAllTo="/v2/briefing/operational"
          renderItem={(issue, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--v2-space-2)', width: '100%' }}>
              <MiniItem severity="danger" title={issue.title} subtitle={issue.started_at ? new Date(issue.started_at).toLocaleDateString() : null} />
              <div style={{ marginLeft: 'auto' }}><SystemBadge system={issue.system} /></div>
            </div>
          )}
        />
      </div>

      {bottleneck && (
        <div className="v2-insight-card">
          <div className="v2-insight-card-eyebrow">Largest observed bottleneck</div>
          <div className="v2-insight-card-title">{bottleneck.from_label} → {bottleneck.to_label}</div>
          <p className="v2-insight-card-body">
            {bottleneck.drop_count} account{bottleneck.drop_count === 1 ? '' : 's'} currently drop off between these stages.
            {' '}{bottleneck.reason_short || bottleneck.reason}
          </p>
        </div>
      )}
    </div>
  )
}
