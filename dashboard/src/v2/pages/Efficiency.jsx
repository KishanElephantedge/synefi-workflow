import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEfficiency, formatApiError } from '../api.js'
import { IconAlertTriangle, IconInfo } from '../icons.jsx'

function formatHours(value) {
  if (value == null) return '—'
  return `${value.toLocaleString()} hr${value === 1 ? '' : 's'}`
}

function formatMonthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const GAP_REASON = {
  not_automated: { label: 'Not automated', tone: 'tone-neutral' },
  not_instrumented: { label: 'Not instrumented', tone: 'tone-info-soft' },
}

// The five activity types autonomous_orchestrator.py's daily cycle records volume for -- the
// real "did the pipeline actually process anything" slice. signal_monitoring/message_drafting
// are excluded deliberately: they come from separate cycles (LinkedIn sweep, message drafting)
// and a zero there wouldn't mean "the autonomous run processed nothing."
const PIPELINE_ACTIVITY_TYPES = ['company_discovery', 'dedup_check', 'hiring_signal_check', 'contact_enrichment', 'decision_maker_research']

// "AUTOMATED RUN -> REAL ACTIVITY PERFORMED -> ACTIVITY LEDGER -> MANUAL-TIME BENCHMARK ->
// HUMAN-EQUIVALENT TIME -> NET TIME SAVED" -- every number on this page comes from that real
// chain (GET /gtm-os/efficiency -> get_monthly_efficiency()). Nothing here is derived from
// current-state record counts, and "equivalent SDRs"/"ran outside 9-5 %"/"admin time cut %" are
// deliberately shown as unavailable rather than invented -- see the backend module's docstring.
export default function Efficiency() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    getEfficiency().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load efficiency: {error}</div>
        </div>
      </div>
    )
  }
  if (data === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
  }

  // Real, data-driven observation -- only rendered when both facts are actually true this
  // month, never a static claim. Deliberately doesn't guess why volume is zero.
  const pipelineVolume = data.breakdown
    .filter(row => PIPELINE_ACTIVITY_TYPES.includes(row.activity_type))
    .reduce((sum, row) => sum + row.volume, 0)
  const showRunInsight = data.runs_counted > 0 && pipelineVolume === 0

  return (
    <div className="v2-eff-page">
      <div className="v2-eff-period">{formatMonthLabel(data.month)}</div>

      <div className="v2-eff-hero">
        <div className="v2-eff-hero-primary">
          <div className="v2-eff-hero-value">{formatHours(data.net_hours_saved)}</div>
          <div className="v2-eff-hero-label">
            Net time saved
            <span className="v2-eff-info">
              <button type="button" className="v2-icon-btn" onClick={() => setInfoOpen(o => !o)} aria-label="What do these three numbers mean?">
                <IconInfo width={13} height={13} />
              </button>
              {infoOpen && (
                <span className="v2-eff-info-bubble">
                  Automation time is real wall-clock run duration. Human-equivalent time is what the
                  same real activity volume would take a person, using configured benchmarks only.
                  Net time saved is the difference -- never automation time itself.
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="v2-eff-hero-support">
          <div className="v2-eff-hero-stat">
            <div className="v2-eff-hero-stat-value">{data.runs_counted}</div>
            <div className="v2-eff-hero-stat-label">Autonomous runs</div>
          </div>
          <div className="v2-eff-hero-stat">
            <div className="v2-eff-hero-stat-value">{formatHours(data.actual_automation_hours)}</div>
            <div className="v2-eff-hero-stat-label">Automation time</div>
          </div>
          <div className="v2-eff-hero-stat">
            <div className="v2-eff-hero-stat-value">{formatHours(data.human_equivalent_hours)}</div>
            <div className="v2-eff-hero-stat-label">Human-equivalent time</div>
          </div>
        </div>
      </div>

      {showRunInsight && (
        <div className="v2-eff-insight">
          <IconInfo width={14} height={14} />
          {data.runs_counted} autonomous run{data.runs_counted === 1 ? '' : 's'} recorded this month, but no new
          companies were processed through the measured enrichment activities.
        </div>
      )}

      <div className="v2-card v2-eff-card">
        <div className="v2-eff-section-title">Activity breakdown</div>
        <div className="v2-eff-ledger">
          <div className="v2-eff-ledger-head">
            <span>Activity</span>
            <span>Volume</span>
            <span>Manual benchmark</span>
            <span>Human equivalent</span>
          </div>
          {data.breakdown.map(row => (
            <div key={row.activity_type} className={`v2-eff-ledger-row${row.volume > 0 ? ' has-volume' : ''}`}>
              <span className="v2-eff-ledger-label">{row.label}</span>
              <span className="v2-eff-ledger-volume">{row.volume}</span>
              <span className="v2-eff-ledger-benchmark">
                {row.manual_minutes != null ? (
                  <>{row.manual_minutes} min{!row.benchmark_enabled && ' (disabled)'}</>
                ) : (
                  <span className="v2-eff-benchmark-missing">
                    <span className="v2-status-pill tone-neutral">Not configured</span>
                    {row.volume > 0 && (
                      <Link to="/v2/settings?tab=efficiency" className="v2-eff-configure-link">Configure benchmark →</Link>
                    )}
                  </span>
                )}
              </span>
              <span className="v2-eff-ledger-human">{row.human_equivalent_hours != null ? `${row.human_equivalent_hours} hr` : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="v2-card v2-eff-card">
        <div className="v2-eff-section-title">Not measurable yet</div>
        <div className="v2-eff-unavailable-row">
          <div className="v2-eff-unavailable-item">
            <div className="v2-eff-unavailable-label">Equivalent SDRs</div>
            <div className="v2-eff-unavailable-value">Not available</div>
          </div>
          <div className="v2-eff-unavailable-item">
            <div className="v2-eff-unavailable-label">Ran outside 9–5</div>
            <div className="v2-eff-unavailable-value">Not available</div>
          </div>
          <div className="v2-eff-unavailable-item">
            <div className="v2-eff-unavailable-label">Admin time cut</div>
            <div className="v2-eff-unavailable-value">Not available</div>
          </div>
        </div>
        <p className="v2-eff-caption">These require a defensible baseline that isn't available in the current data.</p>
      </div>

      <div className="v2-card v2-eff-card">
        <div className="v2-eff-section-title">What's still manual</div>
        <div className="v2-eff-manual-list">
          {data.still_manual.map((gap, i) => {
            const reason = GAP_REASON[gap.reason] || { label: gap.reason, tone: 'tone-neutral' }
            return (
              <div key={i} className="v2-eff-manual-row">
                <span className={`v2-status-pill ${reason.tone}`}>{reason.label}</span>
                <div className="v2-eff-manual-text">
                  <div className="v2-eff-manual-name">{gap.activity}</div>
                  <div className="v2-eff-manual-detail">{gap.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
