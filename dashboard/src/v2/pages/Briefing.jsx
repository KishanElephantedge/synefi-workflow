import { useEffect, useState } from 'react'
import { getBriefingGovernance, getRevenuePace, refreshBriefingGovernance, formatApiError } from '../api.js'
import { IconAlertTriangle, IconRefreshCw, IconTrendingUp, IconBarChart, IconUsers, IconSettings, IconDatabase, IconZap } from '../icons.jsx'
import { KpiTile, MiniCard, MiniItem, SYSTEM_LABEL, formatUsd, timeAgo, shortDate } from '../briefingHelpers.jsx'

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
    ? (revenue.target_configured ? `${revenue.pace_percent}% of target this month` : 'No target set')
    : (revenue === false ? 'Unavailable' : 'Loading…')

  // Real stage counts for the bottleneck funnel bar below -- pulled from the SAME
  // pipeline.stages list the bottleneck itself was detected over (governance.py's
  // _detect_bottleneck), never a second computation. Falls back to no visual if either stage
  // is missing from the readout, rather than guessing.
  const stages = gov.pipeline?.stages || []
  const fromStage = bottleneck && stages.find(s => s.stage === bottleneck.from)
  const toStage = bottleneck && stages.find(s => s.stage === bottleneck.to)

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
        <KpiTile icon={<IconTrendingUp width={14} height={14} />} label="Revenue" value={revenueValue} context={revenueContext} />
        <KpiTile icon={<IconBarChart width={14} height={14} />} label="Pipeline" value={execution.evaluated ?? 0} context="opportunities evaluated" />
        <KpiTile icon={<IconUsers width={14} height={14} />} label="Companies" value={gov.overview?.total_companies ?? 0} context="in your account database" />
        <KpiTile
          icon={<IconAlertTriangle width={14} height={14} />}
          label="Needs attention"
          value={humanAttention.length}
          context={humanAttention.length > 0 ? 'items requiring action' : 'nothing needs action'}
          tone={humanAttention.length > 0 ? 'attention' : undefined}
        />
      </div>

      <div className="v2-card-grid-2">
        <MiniCard
          icon={<IconAlertTriangle width={15} height={15} />}
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
          icon={<IconSettings width={15} height={15} />}
          title="Configuration gaps"
          items={configGaps}
          limit={PREVIEW_LIMIT}
          emptyText="Every offering/motion this evaluator checks is fully configured."
          viewAllTo="/v2/briefing/configuration"
          renderItem={(gap, i) => <MiniItem key={i} title={gap.title} subtitle={gap.short_description} />}
        />
        <MiniCard
          icon={<IconDatabase width={15} height={15} />}
          title="Data gaps"
          items={dataGaps}
          limit={PREVIEW_LIMIT}
          emptyText="No data gaps found on the fields this evaluator checks."
          viewAllTo="/v2/briefing/data"
          renderItem={(gap, i) => <MiniItem key={i} title={gap.title} subtitle={gap.short_description} />}
        />
        <MiniCard
          icon={<IconZap width={15} height={15} />}
          title="System health"
          items={opsIssues}
          limit={PREVIEW_LIMIT}
          emptyText="V1 discovery and GTM-OS are both operating normally."
          viewAllTo="/v2/briefing/operational"
          renderItem={(issue, i) => (
            <MiniItem
              key={i}
              severity="danger"
              title={issue.title}
              subtitle={[SYSTEM_LABEL[issue.system] || issue.system, shortDate(issue.started_at)].filter(Boolean).join(' · ')}
            />
          )}
        />
      </div>

      {bottleneck && (
        <div className="v2-insight-card">
          <div className="v2-insight-card-eyebrow">Largest observed bottleneck</div>
          <div className="v2-insight-card-title">{bottleneck.from_label} → {bottleneck.to_label}</div>
          <div className="v2-insight-stat">
            {bottleneck.drop_count} account{bottleneck.drop_count === 1 ? '' : 's'}
            <span className="v2-insight-stat-sub">
              {fromStage?.count ? ` of ${fromStage.count.toLocaleString()} companies don't progress beyond this stage` : ' don’t progress beyond this stage'}
            </span>
          </div>

          {fromStage && toStage && fromStage.count > 0 && (
            <div className="v2-funnel">
              <div className="v2-funnel-bar">
                <div className="v2-funnel-bar-fill" style={{ width: `${Math.max((toStage.count / fromStage.count) * 100, 2)}%` }} />
              </div>
              <div className="v2-funnel-labels">
                <span>{fromStage.count.toLocaleString()} {fromStage.label || fromStage.stage}</span>
                <span className="v2-funnel-arrow">→</span>
                <span>{toStage.count.toLocaleString()} {toStage.label || toStage.stage}</span>
              </div>
            </div>
          )}

          {/* bottleneck.reason falls back to a generic "no specific gap traced..." internal
              sentence (governance.py's _detect_bottleneck) when no structured reason exists --
              that fallback conveys nothing actionable, so it's better omitted than shown as if
              it were a real explanation (no invented causal reasoning, per this page's own
              standing rule). Only ever renders a REAL, structured reason. */}
          {bottleneck.reason_short && (
            <p className="v2-insight-card-body">{bottleneck.reason_short}</p>
          )}
        </div>
      )}
    </div>
  )
}
