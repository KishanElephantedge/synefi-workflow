import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDemandGrid, getDemandGridCompanies, getIcpsOfferings, formatApiError } from '../api.js'
import {
  IconAlertTriangle, IconBarChart, IconBuilding, IconChevronRight, IconDatabase,
  IconInfo, IconTarget, IconTrendingUp, IconUsers, IconX,
} from '../icons.jsx'

// A cell's tier decides its dot color, label and how much attention it draws. Six real,
// distinct states -- never a numeric score: "sufficient"/"thin" come straight from the
// backend's own evidence_strength field, "configured" vs "no_accounts" is the real
// matched_account_count being zero or not, and unconfigured/excluded are the raw status.
const TIER = {
  unconfigured: { label: 'Unconfigured', dot: 'dot-unconfigured' },
  excluded: { label: 'Excluded', dot: 'dot-excluded' },
  no_accounts: { label: 'No accounts', dot: 'dot-no-accounts' },
  configured: { label: 'Configured', dot: 'dot-configured' },
  thin: { label: 'Some evidence', dot: 'dot-thin' },
  sufficient: { label: 'Strong evidence', dot: 'dot-sufficient' },
}

const LEGEND_ORDER = ['sufficient', 'thin', 'configured', 'no_accounts', 'unconfigured', 'excluded']

const PILL_TONE = {
  sufficient: 'success-solid',
  thin: 'info-soft',
  configured: 'warning-soft',
  no_accounts: 'neutral',
  unconfigured: 'neutral',
  excluded: 'neutral',
}

function tileTier(cell) {
  if (cell.status === 'unconfigured') return 'unconfigured'
  if (cell.status === 'excluded') return 'excluded'
  const strength = cell.evidence?.evidence_strength
  if (strength === 'sufficient') return 'sufficient'
  if (strength === 'thin') return 'thin'
  return cell.matched_account_count > 0 ? 'configured' : 'no_accounts'
}

const MARKET_STATE_LABEL = {
  accelerating: 'Accelerating',
  emerging: 'Emerging',
  persistent: 'Persistent',
  stable: 'Stable',
  declining: 'Declining',
  insufficient_evidence: 'Insufficient evidence',
  no_related_topic: 'No related market topic configured',
}

function Legend() {
  return (
    <div className="v2-dg-legend">
      {LEGEND_ORDER.map(key => (
        <span key={key} className="v2-dg-legend-item">
          <span className={`v2-dg-dot ${TIER[key].dot}`} />
          {TIER[key].label}
        </span>
      ))}
    </div>
  )
}

function InfoNote() {
  const [open, setOpen] = useState(false)
  return (
    <span className="v2-dg-info">
      <button type="button" className="v2-icon-btn" onClick={() => setOpen(o => !o)} aria-label="What do these states mean?">
        <IconInfo width={14} height={14} />
      </button>
      {open && (
        <span className="v2-dg-info-bubble">
          "Configured" means this offering is set up for that ICP -- it does not by itself mean demand exists.
          Select a configured combination for the real market, account, opportunity and commercial evidence behind it.
        </span>
      )}
    </span>
  )
}

// Compact by design: a dash (no dot, no number) for unconfigured/excluded reads as "nothing to
// see here" at a glance; a real cell shows dot + exact count on one line, with the tier word
// only when it adds meaning beyond the number itself (never repeated as "N accounts" -- the
// legend already establishes what the dot+number pairing means).
function GridCell({ cell, isSelected, onSelect }) {
  const tier = tileTier(cell)
  const meta = TIER[tier]
  const clickable = cell.status === 'applicable'

  return (
    <button
      type="button"
      className={`v2-dg-cell tier-${tier}${isSelected ? ' is-selected' : ''}`}
      onClick={clickable ? onSelect : undefined}
      disabled={!clickable}
      aria-label={`${cell.offering}: ${meta.label}${clickable ? `, ${cell.matched_account_count} matched accounts` : ''}`}
    >
      {clickable ? (
        <>
          <span className="v2-dg-cell-main">
            <span className={`v2-dg-dot ${meta.dot}`} />
            {cell.matched_account_count}
          </span>
          <span className="v2-dg-cell-sub">{meta.label}</span>
        </>
      ) : (
        <span className="v2-dg-cell-dash">—</span>
      )}
    </button>
  )
}

function EvidenceBlock({ icon, label, value, note, empty }) {
  return (
    <div className={`v2-dg-evidence-block${empty ? ' is-empty' : ''}`}>
      <div className="v2-dg-evidence-block-head">
        <span className="v2-dg-evidence-block-label">{label}</span>
        <span className="v2-dg-evidence-block-icon">{icon}</span>
      </div>
      <div className="v2-dg-evidence-block-value">{value}</div>
      {note && <div className="v2-dg-evidence-block-note">{note}</div>}
    </div>
  )
}

// Reformats real numbers already present in a real ICPMatch reason string (e.g. "estimated
// revenue $3,750,000 within configured range" -> "$3.75M estimated revenue") for a compact
// headline. Never invents a number; falls back to null (raw reason renders as a chip instead)
// if the expected pattern isn't found.
function formatRevenue(raw) {
  const n = parseInt(raw.replace(/,/g, ''), 10)
  if (!Number.isFinite(n)) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}M estimated revenue`
  if (n >= 1_000) return `$${Math.round(n / 1000)}K estimated revenue`
  return `$${n} estimated revenue`
}

function companyFacts(reasons) {
  const revenueReason = reasons.find(r => /estimated revenue \$[\d,]+/.test(r))
  const teamReason = reasons.find(r => /estimated sales team size \([\d.]+\)/.test(r))
  const headline = []
  if (revenueReason) {
    const m = revenueReason.match(/estimated revenue \$([\d,]+)/)
    const formatted = m && formatRevenue(m[1])
    if (formatted) headline.push(formatted)
  }
  if (teamReason) {
    const m = teamReason.match(/estimated sales team size \(([\d.]+)\)/)
    if (m) headline.push(`${Math.round(parseFloat(m[1]))}-person sales team`)
  }
  const used = new Set([revenueReason, teamReason].filter(Boolean))
  const chips = reasons.filter(r => !used.has(r))
  return { headline: headline.join(' · '), chips }
}

// The full demand-intelligence readout for one ICP x Offering combination -- market_demand
// (ContentTopic trend), account_demand (ICPMatch + DemandHypothesis), opportunities (real,
// problem-aligned Opportunity rows), commercial (real CalendarBooking outcomes). Kept as four
// separate labeled facts, never collapsed into one score.
//
// `evidence` is optional: the currently-deployed GET /gtm-os/demand-grid does not return it yet
// (only the local backend does, undeployed as of 2026-08-20 -- confirmed live against
// production). `matchedAccountCount` is passed separately because it's present on both the old
// and new backend cell shape, so the real "view matched companies" drill-down keeps working
// regardless of backend deployment state -- a real, honest degraded state, not fallback fake data.
function EvidencePanel({ icpId, icpName, offering, cell, onClose }) {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState(null)
  const [showCompanies, setShowCompanies] = useState(false)
  const panelRef = useRef(null)
  const { evidence, matched_account_count: matchedAccountCount } = cell
  const tier = tileTier(cell)
  const meta = TIER[tier]

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setShowCompanies(false)
    setCompanies(null)
  }, [icpId, offering])

  useEffect(() => {
    if (!showCompanies) return
    let cancelled = false
    getDemandGridCompanies(icpId)
      .then(data => { if (!cancelled) setCompanies(data.companies) })
      .catch(err => { if (!cancelled) setError(formatApiError(err)) })
    return () => { cancelled = true }
  }, [icpId, showCompanies])

  return (
    <div className={`v2-spotlight v2-dg-panel accent-${tier}`} ref={panelRef}>
      <div className="v2-dg-panel-head">
        <div>
          <div className="v2-dg-panel-eyebrow">Real demand evidence</div>
          <div className="v2-dg-panel-title-row">
            <span className="v2-dg-panel-title">{icpName} <span className="v2-dg-panel-title-x">×</span> {offering}</span>
            <span className={`v2-status-pill v2-dg-panel-pill tone-${PILL_TONE[tier]}`}>{meta.label}</span>
          </div>
          <div className="v2-dg-panel-subtitle">{matchedAccountCount} matched account{matchedAccountCount === 1 ? '' : 's'}</div>
        </div>
        <button type="button" className="v2-icon-btn v2-spotlight-close" onClick={onClose} aria-label="Close">
          <IconX width={16} height={16} />
        </button>
      </div>

      <div className="v2-dg-evidence-row">
        {!evidence ? (
          <div className="v2-dg-evidence-block is-empty v2-dg-evidence-block-wide">
            <div className="v2-dg-evidence-block-icon-lead"><IconInfo width={16} height={16} /></div>
            <div>
              <div className="v2-dg-panel-empty-title">Detailed demand evidence isn't available yet</div>
              <div className="v2-dg-panel-empty-body">Account matching is live. Market, opportunity and commercial evidence will appear here when available.</div>
            </div>
          </div>
        ) : (
          <>
            <EvidenceBlock
              icon={<IconTrendingUp width={13} height={13} />}
              label="Market demand"
              value={MARKET_STATE_LABEL[evidence.market_demand.state] || evidence.market_demand.state}
              note={evidence.market_demand.related_topics.length > 0 ? `${evidence.market_demand.relevant_signals} recent signal(s) · ${evidence.market_demand.related_topics.join(', ')}` : null}
              empty={evidence.market_demand.state === 'no_related_topic'}
            />
            <EvidenceBlock
              icon={<IconUsers width={13} height={13} />}
              label="Account demand"
              value={evidence.account_demand.matched_account_count}
              note={`${evidence.account_demand.demand_hypothesis_count} with demand evidence`}
              empty={evidence.account_demand.matched_account_count === 0}
            />
            <EvidenceBlock
              icon={<IconTarget width={13} height={13} />}
              label="Opportunities"
              value={evidence.opportunities.count}
              note={evidence.opportunities.sample_statements[0] || null}
              empty={evidence.opportunities.count === 0}
            />
            <EvidenceBlock
              icon={<IconBarChart width={13} height={13} />}
              label="Commercial"
              value={`${evidence.commercial.meetings} / ${evidence.commercial.won}`}
              note={evidence.commercial.revenue_usd > 0 ? `$${evidence.commercial.revenue_usd.toLocaleString()} revenue` : 'meetings / won'}
              empty={evidence.commercial.meetings === 0}
            />
          </>
        )}
      </div>

      {matchedAccountCount > 0 && (
        <div className="v2-dg-companies">
          {showCompanies ? (
            error ? (
              <div className="v2-state v2-state-error">{error}</div>
            ) : companies === null ? (
              <div className="v2-skeleton-row" style={{ background: 'var(--v2-spot-surface)' }} />
            ) : (
              <>
                <div className="v2-dg-companies-head">Matched companies ({companies.length})</div>
                {companies.length === 0 ? (
                  <p className="v2-placeholder-note" style={{ color: 'var(--v2-spot-text-muted)' }}>No matched companies.</p>
                ) : (
                  <div className="v2-dg-company-list">
                    {companies.map(c => {
                      const { headline, chips } = companyFacts(c.reasons || [])
                      return (
                        <Link key={c.company_id} to={`/v2/accounts/${c.company_id}`} className="v2-dg-company-row">
                          <div className="v2-dg-company-avatar"><IconBuilding width={16} height={16} /></div>
                          <div className="v2-dg-company-main">
                            <div className="v2-dg-company-top">
                              <span className="v2-dg-company-name">{c.company_name || `Company #${c.company_id}`}</span>
                              <span className="v2-dg-company-cta">
                                Open Account Agent <IconChevronRight width={13} height={13} />
                              </span>
                            </div>
                            {headline && <div className="v2-dg-company-headline">{headline}</div>}
                            {chips.length > 0 && (
                              <div className="v2-dg-company-chips">
                                {chips.map((r, i) => <span key={i} className="v2-dg-company-chip">{r}</span>)}
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </>
            )
          ) : (
            <button type="button" className="v2-btn" onClick={() => setShowCompanies(true)}>
              View {matchedAccountCount} matched compan{matchedAccountCount === 1 ? 'y' : 'ies'} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Analytics view metrics -- four independent, real backend facts, never combined into a
// weighted "demand score" (there is no such business rule). "accounts" is always real (the
// deployed grid endpoint has always returned matched_account_count); the other three require
// the same undeployed `evidence` object the Matrix's EvidencePanel already degrades honestly
// without -- getValue returns null (not 0) when evidence is absent for a given cell, so a real
// zero is never confused with "not available".
const METRICS = [
  {
    key: 'accounts',
    tabLabel: 'Accounts',
    chartTitle: 'Matched Accounts',
    requiresEvidence: false,
    unit: n => `${n} account${n === 1 ? '' : 's'}`,
    getValue: cell => cell.matched_account_count,
  },
  {
    key: 'market',
    tabLabel: 'Market Signals',
    chartTitle: 'Market Signals',
    requiresEvidence: true,
    unit: n => `${n} signal${n === 1 ? '' : 's'}`,
    getValue: cell => (cell.evidence ? (cell.evidence.market_demand.relevant_signals ?? 0) : null),
  },
  {
    key: 'opportunities',
    tabLabel: 'Opportunities',
    chartTitle: 'Opportunities',
    requiresEvidence: true,
    unit: n => `${n} opportunit${n === 1 ? 'y' : 'ies'}`,
    getValue: cell => (cell.evidence ? cell.evidence.opportunities.count : null),
  },
  {
    key: 'commercial',
    tabLabel: 'Commercial Outcomes',
    chartTitle: 'Commercial Outcomes',
    requiresEvidence: true,
    unit: n => `${n} meeting${n === 1 ? '' : 's'}`,
    getValue: cell => (cell.evidence ? cell.evidence.commercial.meetings : null),
  },
]

// "Nice" axis scale (0..niceMax in `step`-sized increments) so the Y-axis reads like a real
// chart instead of an arbitrary max-of-the-data ceiling. Never used to inflate the bars
// themselves -- only to pick where the gridlines/ticks land.
function niceScale(max) {
  if (max <= 0) return { niceMax: 4, step: 1, ticks: [0, 1, 2, 3, 4] }
  const rawStep = max / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let step
  if (residual > 5) step = 10 * magnitude
  else if (residual > 2) step = 5 * magnitude
  else if (residual > 1) step = 2 * magnitude
  else step = magnitude
  step = Math.max(1, Math.round(step))
  const niceMax = Math.ceil(max / step) * step
  const ticks = []
  for (let t = 0; t <= niceMax; t += step) ticks.push(t)
  return { niceMax, step, ticks }
}

const CHART_HEIGHT = 200

// A genuine vertical bar chart -- real Y-axis (count), real X-axis (ICP names), gridlines, a
// hover tooltip, and zero rendered as literally zero height. This is current accumulated real
// data, not a timeseries -- there is deliberately no date/time axis anywhere.
function BarChart({ title, data, unit }) {
  const [hoverId, setHoverId] = useState(null)
  const { niceMax, ticks } = niceScale(Math.max(0, ...data.map(d => d.value || 0)))

  return (
    <div className="v2-da-chart">
      <div className="v2-da-chart-title">{title}</div>
      <div className="v2-da-chart-body">
        <div className="v2-da-chart-yaxis" style={{ height: CHART_HEIGHT }}>
          {[...ticks].reverse().map(t => (
            <div key={t} className="v2-da-chart-ytick" style={{ top: CHART_HEIGHT - (t / niceMax) * CHART_HEIGHT }}>
              {t}
            </div>
          ))}
        </div>
        <div className="v2-da-chart-plot" style={{ height: CHART_HEIGHT }}>
          {ticks.map(t => (
            <div key={t} className="v2-da-chart-gridline" style={{ bottom: (t / niceMax) * CHART_HEIGHT }} />
          ))}
          <div className="v2-da-chart-bars">
            {data.map(d => (
              <div
                key={d.id}
                className="v2-da-chart-col"
                onMouseEnter={() => setHoverId(d.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <div className="v2-da-chart-bar-wrap" style={{ height: CHART_HEIGHT }}>
                  {hoverId === d.id && (
                    <div
                      className="v2-da-chart-tooltip"
                      style={{ bottom: (d.value != null ? (d.value / niceMax) * CHART_HEIGHT : 0) + 8 }}
                    >
                      <div className="v2-da-chart-tooltip-name">{d.name}</div>
                      <div className="v2-da-chart-tooltip-value">{d.value == null ? 'Not available yet' : unit(d.value)}</div>
                    </div>
                  )}
                  {d.value != null && d.value > 0 && (
                    <button
                      type="button"
                      className={`v2-da-chart-bar${d.tier ? ` tier-${d.tier}` : ''}${d.clickable ? '' : ' not-clickable'}`}
                      style={{ height: (d.value / niceMax) * CHART_HEIGHT }}
                      onClick={d.clickable ? d.onClick : undefined}
                      disabled={!d.clickable}
                      aria-label={`${d.name}: ${unit(d.value)}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="v2-da-chart-xaxis" style={{ paddingLeft: 28 }}>
        {data.map(d => (
          <div key={d.id} className="v2-da-chart-xlabel">{d.name}</div>
        ))}
      </div>
    </div>
  )
}

// "Across all ICPs, where is demand/evidence concentrated?" -- one real vertical bar chart, X
// axis = ICP, Y axis = the selected metric's real count. `accounts` takes the ICP's own
// matched_account_count (an ICP-level fact, identical on every applicable cell in that row --
// summing across offerings would double-count the same accounts); market/opportunities/
// commercial are genuinely computed per (ICP, offering) by the backend, so summing across an
// ICP's applicable offerings is a real, non-duplicative total. Clicking a bar hands off to the
// existing Matrix + EvidencePanel -- this view never re-implements evidence display itself.
function DemandAnalytics({ grid, onSelectBar }) {
  const [metricKey, setMetricKey] = useState('accounts')
  const metric = METRICS.find(m => m.key === metricKey)

  const evidenceDeployed = useMemo(
    () => grid.rows.some(row => row.cells.some(c => c.status === 'applicable' && c.evidence != null)),
    [grid]
  )
  const showUnavailable = metric.requiresEvidence && !evidenceDeployed

  const data = useMemo(() => grid.rows.map(row => {
    const applicable = row.cells.filter(c => c.status === 'applicable')
    if (applicable.length === 0) {
      return { id: row.icp_id, name: row.icp_name, value: 0, tier: null, clickable: false }
    }
    const values = applicable.map(c => metric.getValue(c))
    const anyUnavailable = values.some(v => v == null)
    const value = metric.key === 'accounts'
      ? Math.max(0, ...values.map(v => v || 0)) // ICP-level fact, same on every applicable cell -- max, never sum
      : (anyUnavailable ? null : values.reduce((a, b) => a + b, 0))
    const strongest = applicable.reduce((best, c) => {
      const s = c.evidence?.evidence_strength
      if (s === 'sufficient') return c
      if (s === 'thin' && best?.evidence?.evidence_strength !== 'sufficient') return c
      return best
    }, null)
    const tier = strongest?.evidence?.evidence_strength === 'sufficient' ? 'sufficient'
      : strongest?.evidence?.evidence_strength === 'thin' ? 'thin' : null
    return {
      id: row.icp_id,
      name: row.icp_name,
      value,
      tier,
      clickable: true,
      onClick: () => {
        // A bar is an ICP-level aggregate -- only hand off a specific cell selection when the
        // ICP has exactly one applicable offering (unambiguous); otherwise just surface the
        // Matrix so the user picks the offering themselves, rather than guessing one.
        if (applicable.length === 1) onSelectBar(row.icp_id, row.icp_name, applicable[0].offering, applicable[0])
        else onSelectBar(row.icp_id, row.icp_name, null, null)
      },
    }
  }), [grid, metric])

  return (
    <div className="v2-da">
      <div className="v2-da-head">
        <div>
          <div className="v2-da-title">Demand Analytics</div>
          <div className="v2-da-subtitle">Current total real demand evidence by ICP</div>
        </div>
        <div className="v2-config-tabs v2-da-metric-tabs">
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              className={`v2-config-tab${metricKey === m.key ? ' active' : ''}`}
              onClick={() => setMetricKey(m.key)}
            >
              {m.tabLabel}
            </button>
          ))}
        </div>
      </div>

      {showUnavailable ? (
        <div className="v2-card">
          <div className="v2-state">
            <IconAlertTriangle width={18} height={18} style={{ marginBottom: 8 }} />
            This demand signal isn't available from the current backend yet.
          </div>
        </div>
      ) : (
        <div className="v2-card v2-da-chart-card">
          <BarChart title={`${metric.chartTitle} by ICP`} data={data} unit={metric.unit} />
        </div>
      )}
    </div>
  )
}

// "Where is demand highest right now?" -- an ICP x Offering coverage matrix with a real
// demand-intelligence layer underneath. `status` (applicable/excluded/unconfigured) is the pure
// configuration fact; every applicable combination also carries real, distinguished evidence
// (market/account/opportunity/commercial demand) from the backend's own composition over
// ICPMatch, DemandHypothesis, Opportunity, CalendarBooking outcomes and ContentTopic trend --
// never a single fabricated score.
export default function DemandGrid() {
  const [grid, setGrid] = useState(null)
  const [offeringMeta, setOfferingMeta] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // { icpId, icpName, offering, cell }
  const [view, setView] = useState('matrix') // 'matrix' | 'analytics'

  useEffect(() => {
    getDemandGrid().then(setGrid).catch(err => setError(formatApiError(err)))
    // Offering `description` is real, human-entered config (currently unset for every offering
    // in production) -- read separately so an unset description just means "no subtitle", never
    // an invented one.
    getIcpsOfferings().then(d => setOfferingMeta(d.offerings)).catch(() => {})
  }, [])

  const descriptionByOffering = useMemo(() => {
    const map = {}
    ;(offeringMeta || []).forEach(o => { if (o.description) map[o.name] = o.description })
    return map
  }, [offeringMeta])

  const select = (icpId, icpName, offering, cell) => setSelected({ icpId, icpName, offering, cell })
  // Analytics -> Matrix handoff. A chart bar is an ICP-level aggregate, so it can only hand off
  // a specific cell selection when that's unambiguous (offering/cell non-null); otherwise this
  // just switches to the Matrix so the user picks the offering themselves. The existing
  // EvidencePanel (rendered once, shared by both views) still scrolls itself into view when a
  // cell IS selected -- no second evidence implementation either way.
  const selectFromAnalytics = (icpId, icpName, offering, cell) => {
    setView('matrix')
    if (offering && cell) select(icpId, icpName, offering, cell)
  }

  const configuredCount = grid ? grid.rows.reduce((n, row) => n + row.cells.filter(c => c.status === 'applicable').length, 0) : 0
  const totalCount = grid ? grid.rows.length * grid.offerings.length : 0

  return (
    <div className="v2-dg-page">
      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load the demand grid: {error}</div>
          </div>
        </div>
      ) : grid === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : grid.icps.length === 0 || grid.offerings.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">No ICPs or offerings are configured yet for this tenant.</div>
        </div>
      ) : (
        <>
          <div className="v2-config-tabs v2-dg-view-tabs">
            <button type="button" className={`v2-config-tab${view === 'matrix' ? ' active' : ''}`} onClick={() => setView('matrix')}>
              Matrix
            </button>
            <button type="button" className={`v2-config-tab${view === 'analytics' ? ' active' : ''}`} onClick={() => setView('analytics')}>
              Analytics
            </button>
          </div>

          {view === 'analytics' && <DemandAnalytics grid={grid} onSelectBar={selectFromAnalytics} />}

          <div style={{ display: view === 'matrix' ? 'contents' : 'none' }}>
          <div className="v2-dg-summary-row">
            <div className="v2-stat-tile v2-dg-summary-tile">
              <div className="v2-stat-label">Coverage</div>
              <div className="v2-stat-value">{configuredCount}<span className="v2-dg-summary-total"> / {totalCount}</span></div>
              <div className="v2-dg-summary-caption">ICP × Offering combinations configured</div>
            </div>
            <InfoNote />
            <Legend />
          </div>

          <div className="v2-dg-table-wrap">
            <div className="v2-dg-table" style={{ gridTemplateColumns: `240px repeat(${grid.offerings.length}, minmax(200px, 1fr))` }}>
              <div className="v2-dg-th v2-dg-th-corner">ICP</div>
              {grid.offerings.map(o => (
                <div key={o} className="v2-dg-th">
                  <div>{o}</div>
                  {descriptionByOffering[o] && <div className="v2-dg-th-sub">{descriptionByOffering[o]}</div>}
                </div>
              ))}

              {grid.rows.map(row => {
                const configured = row.cells.some(c => c.status !== 'unconfigured')
                const matched = Math.max(0, ...row.cells.map(c => c.matched_account_count))
                return (
                  <RowFragment key={row.icp_id}>
                    <div className="v2-dg-row-head">
                      <div className="v2-dg-row-name">{row.icp_name}</div>
                      <div className="v2-dg-row-count">
                        <IconUsers width={12} height={12} />
                        {matched > 0 ? `${matched} account${matched === 1 ? '' : 's'}` : '—'}
                      </div>
                    </div>
                    {!configured ? (
                      <div className="v2-dg-row-empty" style={{ gridColumn: `span ${grid.offerings.length}` }}>
                        <IconDatabase width={12} height={12} />
                        No offerings configured
                      </div>
                    ) : (
                      row.cells.map(cell => (
                        <GridCell
                          key={cell.offering}
                          cell={cell}
                          isSelected={selected?.icpId === row.icp_id && selected?.offering === cell.offering}
                          onSelect={() => select(row.icp_id, row.icp_name, cell.offering, cell)}
                        />
                      ))
                    )}
                  </RowFragment>
                )
              })}
            </div>
          </div>

          {/* Mobile (<720px): a genuinely stacked per-ICP list, not horizontal scroll -- the
              table above is hidden below that breakpoint (see .v2-dg-table-wrap media query). */}
          <div className="v2-dg-mobile-list">
            {grid.rows.map(row => {
              const configured = row.cells.some(c => c.status !== 'unconfigured')
              return (
                <div key={row.icp_id} className="v2-dg-mobile-card">
                  <div className="v2-dg-row-name">{row.icp_name}</div>
                  {!configured ? (
                    <div className="v2-dg-row-empty v2-dg-mobile-empty">
                      <IconDatabase width={12} height={12} />
                      No offerings configured
                    </div>
                  ) : (
                    <div className="v2-dg-mobile-cells">
                      {row.cells.map(cell => {
                        const tier = tileTier(cell)
                        const meta = TIER[tier]
                        const clickable = cell.status === 'applicable'
                        return (
                          <button
                            key={cell.offering}
                            type="button"
                            className={`v2-dg-mobile-cell tier-${tier}`}
                            disabled={!clickable}
                            onClick={clickable ? () => select(row.icp_id, row.icp_name, cell.offering, cell) : undefined}
                          >
                            <span className="v2-dg-mobile-cell-name">{cell.offering}</span>
                            {clickable ? (
                              <span className="v2-dg-cell-main">
                                <span className={`v2-dg-dot ${meta.dot}`} />
                                {cell.matched_account_count}
                                <span className="v2-dg-cell-sub">{meta.label}</span>
                              </span>
                            ) : (
                              <span className="v2-dg-cell-dash">—</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>

          {selected && (
            <EvidencePanel
              icpId={selected.icpId}
              icpName={selected.icpName}
              offering={selected.offering}
              cell={selected.cell}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

// CSS Grid needs each row's cells as direct children of the grid container (no wrapping <tr>),
// so this is a plain passthrough, not a real component -- keeps the JSX above readable without
// giving up the single flat grid this layout depends on for column alignment.
function RowFragment({ children }) {
  return children
}
