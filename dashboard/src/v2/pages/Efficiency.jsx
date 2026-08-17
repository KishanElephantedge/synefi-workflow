import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEfficiency, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

function formatHours(value) {
  if (value == null) return 'Not available yet'
  return `${value.toLocaleString()} hr${value === 1 ? '' : 's'}`
}

function formatMinutes(value) {
  if (value == null) return '—'
  return `${value} min`
}

const GAP_REASON_LABEL = {
  not_automated: 'Not automated',
  not_instrumented: 'Not instrumented',
}

// "AUTOMATED RUN -> REAL ACTIVITY PERFORMED -> ACTIVITY LEDGER -> MANUAL-TIME BENCHMARK ->
// HUMAN-EQUIVALENT TIME -> NET TIME SAVED" -- every number on this page comes from that real
// chain (GET /gtm-os/efficiency -> get_monthly_efficiency()). Nothing here is derived from
// current-state record counts, and "equivalent SDRs"/"ran outside 9-5 %"/"admin time cut %" are
// deliberately shown as unavailable rather than invented -- see the backend module's docstring.
export default function Efficiency() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getEfficiency().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load efficiency: {error}</div>
          </div>
        </div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
      ) : (
        <>
          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">{data.month}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--v2-text)' }}>
              {formatHours(data.net_hours_saved)} <span style={{ color: 'var(--v2-text-muted)', fontWeight: 500, fontSize: '1rem' }}>saved this month</span>
            </div>
            <p className="v2-placeholder-note" style={{ marginTop: 6, marginBottom: 0 }}>
              Human-equivalent time and actual automation time are shown separately below -- net
              time saved is the difference between them, never the two conflated.
            </p>
          </div>

          <div className="v2-stat-row" style={{ marginBottom: '1rem' }}>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Human-equivalent time</div>
              <div className="v2-stat-value">{formatHours(data.human_equivalent_hours)}</div>
            </div>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Actual automation time</div>
              <div className="v2-stat-value">{formatHours(data.actual_automation_hours)}</div>
            </div>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Net time saved</div>
              <div className="v2-stat-value">{formatHours(data.net_hours_saved)}</div>
            </div>
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">Activity breakdown</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="v2-demand-grid">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Volume</th>
                    <th>Manual benchmark</th>
                    <th>Human equivalent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown.map(row => (
                    <tr key={row.activity_type}>
                      <th scope="row">{row.label}</th>
                      <td>{row.volume}</td>
                      <td>
                        {row.manual_minutes != null
                          ? `${formatMinutes(row.manual_minutes)}${row.benchmark_enabled ? '' : ' (disabled)'}`
                          : <span className="v2-badge v2-badge-neutral">Missing</span>}
                      </td>
                      <td>{row.human_equivalent_hours != null ? `${row.human_equivalent_hours} hr` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.missing_benchmarks.length > 0 && (
              <p className="v2-placeholder-note" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
                {data.missing_benchmarks.length} activit{data.missing_benchmarks.length === 1 ? 'y has' : 'ies have'} real
                recorded volume this month but no manual-time benchmark configured yet --
                set one in <Link to="/v2/settings?tab=efficiency">Settings</Link> to include it above.
              </p>
            )}
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">Not available yet</span>
            </div>
            <div className="v2-kv-grid">
              <div>
                <div className="v2-kv-label">Equivalent SDRs</div>
                <div className="v2-kv-value">Not available yet</div>
              </div>
              <div>
                <div className="v2-kv-label">Ran outside 9-5</div>
                <div className="v2-kv-value">Not available yet</div>
              </div>
              <div>
                <div className="v2-kv-label">Admin time cut</div>
                <div className="v2-kv-value">Not available yet</div>
              </div>
            </div>
            <p className="v2-placeholder-note" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              None of these are defensible from real data yet -- shown honestly rather than
              invented (see the Efficiency feature audit for exactly why).
            </p>
          </div>

          <div className="v2-card">
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">What's still manual</span>
            </div>
            {data.still_manual.map((gap, i) => (
              <div key={i} style={{ marginBottom: i === data.still_manual.length - 1 ? 0 : '0.7rem', paddingBottom: i === data.still_manual.length - 1 ? 0 : '0.7rem', borderBottom: i === data.still_manual.length - 1 ? 'none' : '1px solid var(--v2-border)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="v2-badge v2-badge-neutral">{GAP_REASON_LABEL[gap.reason] || gap.reason}</span>
                  <span style={{ fontWeight: 600, color: 'var(--v2-text)', fontSize: '0.88rem' }}>{gap.activity}</span>
                </div>
                <p className="v2-placeholder-note" style={{ marginTop: 4, marginBottom: 0 }}>{gap.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
