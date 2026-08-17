import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRevenuePace, getRevenuePaceDiagnosis, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

function formatUsd(value) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString()}`
}

const CONSTRAINT_LABEL = {
  no_revenue_goal_configured: 'No revenue goal configured',
  insufficient_opportunities: 'Insufficient opportunities',
  opportunities_blocked_on_human_review: 'Opportunities blocked on human review',
  missing_decision_makers: 'Missing decision-makers',
  meetings_not_yet_producing_recorded_revenue: 'Meetings not yet producing recorded revenue',
  revenue_gap_no_specific_blocker_identified: 'Revenue gap, no single blocker identified',
}

// Diagnosis section -- fetched independently of the base Revenue Pace numbers above (its own
// loading/error state), so a diagnosis-layer issue never breaks the base page. Every clause here
// comes directly from GET /gtm-os/revenue-pace/diagnosis, a pure composition over already-real
// data (Revenue Pace + Jobs to Be Done + Overrides & Evals' confirmed patterns only) -- nothing
// here is LLM-generated or invented.
function DiagnosisSection() {
  const [diagnosis, setDiagnosis] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRevenuePaceDiagnosis().then(setDiagnosis).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card" style={{ marginTop: '1rem' }}>
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load diagnosis: {error}</div>
        </div>
      </div>
    )
  }
  if (diagnosis === null) {
    return <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 160, marginTop: '1rem' }} />
  }

  const workingItems = [
    ...diagnosis.strongest_icps.items.slice(0, 1).map(i => `${i.icp_name} (${formatUsd(i.amount_usd)}, ${i.deal_count} deal${i.deal_count === 1 ? '' : 's'})`),
    ...diagnosis.strongest_offerings.items.slice(0, 1).map(i => `${i.offering_name} (${formatUsd(i.amount_usd)}, ${i.deal_count} deal${i.deal_count === 1 ? '' : 's'})`),
  ]

  return (
    <>
      <div className="v2-card" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <div className="v2-config-card-head">
          <span className="v2-config-card-title">Diagnosis</span>
        </div>
        <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 0 }}>{diagnosis.diagnosis_summary}</p>

        <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
          <div>
            <div className="v2-kv-label">Primary constraint</div>
            <div className="v2-kv-value">
              {diagnosis.primary_constraint.constraint
                ? (CONSTRAINT_LABEL[diagnosis.primary_constraint.constraint] || diagnosis.primary_constraint.constraint)
                : 'None identified'}
            </div>
          </div>
        </div>
        <p className="v2-placeholder-note" style={{ marginTop: 4, marginBottom: 0 }}>{diagnosis.primary_constraint.reason}</p>
      </div>

      <div className="v2-card" style={{ marginBottom: '1rem' }}>
        <div className="v2-config-card-head"><span className="v2-config-card-title">What's working</span></div>
        {workingItems.length === 0 ? (
          <div className="v2-state">No recorded revenue outcomes yet this month.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--v2-text)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            {workingItems.map((text, i) => <li key={i}>{text}</li>)}
          </ul>
        )}
      </div>

      <div className="v2-card" style={{ marginBottom: '1rem' }}>
        <div className="v2-config-card-head"><span className="v2-config-card-title">What needs attention</span></div>
        {diagnosis.blocked_opportunities.length === 0 && diagnosis.pipeline_gaps.contacts_to_find_count === 0 ? (
          <div className="v2-state">No blocked opportunities or missing decision-makers right now.</div>
        ) : (
          <>
            {diagnosis.blocked_opportunities.map(item => (
              <Link key={item.opportunity_id} to={item.action_route} className="v2-account-row" style={{ textDecoration: 'none' }}>
                <div className="v2-account-identity">
                  <div className="v2-account-name">{item.company_name || `Opportunity #${item.opportunity_id}`}</div>
                  <div className="v2-account-meta">{(item.blocker || '').toString()} — {item.reason}</div>
                </div>
              </Link>
            ))}
            {diagnosis.pipeline_gaps.contacts_to_find_count > 0 && (
              <p className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                {diagnosis.pipeline_gaps.contacts_to_find_count} account(s) need a decision-maker found -- see <Link to="/v2/jobs">Jobs to be done</Link>.
              </p>
            )}
          </>
        )}
      </div>

      {diagnosis.confirmed_patterns_referenced.length > 0 && (
        <div className="v2-card" style={{ marginBottom: '1rem' }}>
          <div className="v2-config-card-head"><span className="v2-config-card-title">Relevant confirmed patterns</span></div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--v2-text)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            {diagnosis.confirmed_patterns_referenced.map(p => <li key={p.id}>{p.pattern_description}</li>)}
          </ul>
          <p className="v2-placeholder-note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            Shown as context only -- confirming a pattern never changes strategy or recommendations automatically. See <Link to="/v2/overrides-evals">Overrides &amp; Evals</Link>.
          </p>
        </div>
      )}

      {diagnosis.priorities.length > 0 && (
        <div className="v2-card" style={{ marginBottom: '1rem' }}>
          <div className="v2-config-card-head"><span className="v2-config-card-title">Priorities</span></div>
          {diagnosis.priorities.map((p, i) => (
            <Link key={i} to={p.action_route} className="v2-account-row" style={{ textDecoration: 'none' }}>
              <div className="v2-account-identity">
                <div className="v2-account-name">{p.title}</div>
                <div className="v2-account-meta">{p.reason}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

// Target vs. actual, real month-to-date -- backed by GET /gtm-os/revenue-pace, itself a pure
// aggregation over meeting outcomes recorded on the Meetings page + business_context's own
// revenue_goal. No cost-per-meeting, no forecast (no data source exists for either anywhere in
// this backend), and no generated narrative -- any explanatory text below is a plain restatement
// of the real numbers, same discipline the Briefing/Governance page already follows.
export default function RevenuePace() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRevenuePace().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  return (
    <div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load revenue pace: {error}</div>
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
            {!data.target_configured ? (
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>
                No revenue target is set yet. <Link to="/v2/settings">Set one in Settings</Link> to see
                pace against it -- until then, this shows real closed-deal totals with no target to compare against.
              </p>
            ) : (
              <>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--v2-text)' }}>
                  {formatUsd(data.actual_usd)} <span style={{ color: 'var(--v2-text-muted)', fontWeight: 500, fontSize: '1rem' }}>of {formatUsd(data.target_usd)}</span>
                </div>
                <div style={{ background: 'var(--v2-surface-elevated)', borderRadius: 999, height: 10, marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--v2-accent)', height: '100%', width: `${Math.min(data.pace_percent || 0, 100)}%`, borderRadius: 999 }} />
                </div>
                <p className="v2-placeholder-note" style={{ marginTop: 8, marginBottom: 0 }}>
                  {data.pace_percent}% of target. Gap: {formatUsd(data.gap_usd)}.
                </p>
              </>
            )}
          </div>

          <div className="v2-stat-row" style={{ marginBottom: '1rem' }}>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Meetings this month</div>
              <div className="v2-stat-value">{data.meetings_this_month}</div>
            </div>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Won</div>
              <div className="v2-stat-value">{data.won_count}</div>
            </div>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Lost</div>
              <div className="v2-stat-value">{data.lost_count}</div>
            </div>
            <div className="v2-stat-tile">
              <div className="v2-stat-label">Pending outcome</div>
              <div className="v2-stat-value">{data.pending_count}</div>
            </div>
          </div>

          <div className="v2-card" style={{ marginBottom: '1rem' }}>
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">By ICP</span>
            </div>
            {data.by_icp.length === 0 ? (
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>No won deals recorded this month yet.</p>
            ) : (
              <div className="v2-kv-grid">
                {data.by_icp.map(row => (
                  <div key={row.icp_name}>
                    <div className="v2-kv-label">{row.icp_name}</div>
                    <div className="v2-kv-value">{formatUsd(row.amount_usd)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="v2-card">
            <div className="v2-config-card-head">
              <span className="v2-config-card-title">By offering</span>
            </div>
            {data.by_offering.length === 0 ? (
              <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>No won deals recorded this month yet.</p>
            ) : (
              <div className="v2-kv-grid">
                {data.by_offering.map(row => (
                  <div key={row.offering_name}>
                    <div className="v2-kv-label">{row.offering_name}</div>
                    <div className="v2-kv-value">{formatUsd(row.amount_usd)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="v2-placeholder-note" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Outcomes are recorded per meeting on the <Link to="/v2/meetings">Meetings</Link> page. This
            page only totals what's been recorded there -- it doesn't track cost-per-meeting or a
            forecast (no data source for either exists yet).
          </p>

          <DiagnosisSection />
        </>
      )}
    </div>
  )
}
