import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import client from '../api/client'

// Moved here from the Autonomous page -- a read-only visualization of the latest autonomous
// run's pipeline (which phase found what), since the cycle runs entirely on its own. Synefi's
// autonomous data shape doesn't match this step structure, so this only ever renders for
// Elephant Edge (same constraint the original had).
const PIPELINE_STEPS = [
  { key: 'discovery', label: 'Discovery', isDone: (b) => (b.companies || []).length > 0 },
  { key: 'buying-signal', label: 'Buying Signal', isDone: (b) => (b.companies || []).some(c => c.active_head_of_sales_posting !== null && c.active_head_of_sales_posting !== undefined) },
  { key: 'tech-stack', label: 'Tech Stack', isDone: (b) => (b.companies || []).some(c => c.has_outbound_tooling !== null && c.has_outbound_tooling !== undefined) },
  { key: 'scoring', label: 'Scoring', isDone: (b) => (b.companies || []).some(c => c.tier != null) },
  { key: 'decision-maker', label: 'Decision Maker', isDone: (b) => (b.companies || []).some(c => c.contact_count > 0) },
  { key: 'outreach', label: 'Outreach', isDone: (b) => b.current_phase === 'outreach_done' },
]

function LatestRunPipeline({ batchId, tenantSlug }) {
  const [batch, setBatch] = useState(null)
  const [activeStep, setActiveStep] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!batchId) return
    client.get(`/batches/${batchId}`).then(res => setBatch(res.data)).catch(err => setError(err.message))
  }, [batchId])

  if (!batchId) return null

  return (
    <div className="overview-card" style={{ marginTop: '1.25rem' }}>
      <h3 className="overview-card-title">
        Latest Run — Pipeline Flow <Link to={`/${tenantSlug}/batches/${batchId}`} style={{ fontSize: '0.78rem', fontWeight: 400 }}>(open batch #{batchId})</Link>
      </h3>
      {error && <p className="error">{error}</p>}
      {!batch && !error && <p className="hint">Loading...</p>}
      {batch && (
        <>
          <div className="step-flow">
            {PIPELINE_STEPS.map((step, i) => {
              const done = step.isDone(batch)
              return (
                <div key={step.key} className="step-flow-item">
                  {i > 0 && <span className="step-flow-arrow">&rarr;</span>}
                  <button
                    type="button"
                    className={`step-pill ${activeStep === step.key ? 'active' : ''} ${done ? 'done' : ''}`}
                    onClick={() => setActiveStep(activeStep === step.key ? null : step.key)}
                  >
                    <span className="step-pill-dot" />
                    {step.label} {done && '✓'}
                  </button>
                </div>
              )
            })}
          </div>

          {activeStep === 'discovery' && (
            <div className="step-panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Domain</th><th>Geo</th><th>Industry</th></tr></thead>
                  <tbody>
                    {(batch.companies || []).map(c => (
                      <tr key={c.id}><td>{c.name}</td><td>{c.domain}</td><td>{c.geography_tier || '-'}</td><td>{c.industry_classification || '-'}</td></tr>
                    ))}
                    {(batch.companies || []).length === 0 && <tr><td colSpan={4} className="empty-state">No companies discovered yet this run.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 'buying-signal' && (
            <div className="step-panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Hiring Signal</th><th>Sales HC%</th></tr></thead>
                  <tbody>
                    {(batch.companies || []).map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td title={c.hiring_signal_reasoning || ''}>{c.hiring_signal_role ? `${c.hiring_signal_role} (${c.hiring_signal_strength})` : (c.active_head_of_sales_posting === false ? 'None found' : '-')}</td>
                        <td>{c.sales_headcount_percent != null ? `${c.sales_headcount_percent.toFixed(1)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 'tech-stack' && (
            <div className="step-panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Outbound Tooling</th><th>AI SDR Tool</th></tr></thead>
                  <tbody>
                    {(batch.companies || []).map(c => (
                      <tr key={c.id}><td>{c.name}</td><td>{c.has_outbound_tooling ? 'Yes' : (c.has_outbound_tooling === false ? 'No' : '-')}</td><td>{c.has_ai_sdr_tool ? 'Yes' : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 'scoring' && (
            <div className="step-panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Tier</th><th>Score</th></tr></thead>
                  <tbody>
                    {(batch.companies || []).map(c => (
                      <tr key={c.id}><td>{c.name}</td><td>{c.tier && <span className={`tier-badge tier-${c.tier}`}>{c.tier}</span>}</td><td>{c.score ?? '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 'decision-maker' && (
            <div className="step-panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Company</th><th>Contacts Found</th></tr></thead>
                  <tbody>
                    {(batch.companies || []).map(c => (
                      <tr key={c.id}><td>{c.name}</td><td>{c.contact_count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 'outreach' && (
            <div className="step-panel">
              <p className="hint">Current phase: <strong>{batch.current_phase}</strong> &middot; Status: {batch.status}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Icon + accent color per funnel stage -- shared between the vertical funnel card and the
// horizontal pipeline strip so the two views read as one system, not two different palettes.
const STAGE_ICONS = {
  companies_researched: { color: '#6366f1', bg: '#eef2ff', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
  ) },
  companies_qualified: { color: '#0ea5e9', bg: '#e0f2fe', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
  ) },
  decision_makers_found: { color: '#8b5cf6', bg: '#f3e8ff', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
  ) },
  messages_approved: { color: '#ec4899', bg: '#fce7f3', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
  ) },
  emails_sent: { color: '#0891b2', bg: '#cffafe', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-10 5L2 7"></path></svg>
  ) },
  connections_sent: { color: '#4f46e5', bg: '#eef2ff', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
  ) },
  connections_accepted: { color: '#14b8a6', bg: '#ccfbf1', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
  ) },
  replied: { color: '#f59e0b', bg: '#fef3c7', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
  ) },
  meetings_booked: { color: '#10b981', bg: '#d1fae5', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>
  ) },
}

const STAGES = [
  { key: 'companies_researched', label: 'Companies Researched', shortLabel: 'Researched', to: () => '/companies' },
  { key: 'companies_qualified', label: 'Companies Qualified', shortLabel: 'Qualified', to: () => '/companies?qualified=true' },
  { key: 'decision_makers_found', label: 'Decision-Makers Found', shortLabel: 'Contacts', to: () => '/campaign?pipeline_only=false' },
  { key: 'messages_approved', label: 'Messages Approved', shortLabel: 'Approved', to: () => '/campaign?message_status=approved' },
  { key: 'emails_sent', label: 'Emails Sent', shortLabel: 'Emails', to: () => '/campaign?view=campaigns&campaign_source=smartlead' },
  { key: 'connections_sent', label: 'Connections Sent', shortLabel: 'Sent', to: () => '/campaign?activity=SENT' },
  { key: 'connections_accepted', label: 'Connections Accepted', shortLabel: 'Accepted', to: () => '/campaign?activity=CONNECTED' },
  { key: 'replied', label: 'Replied', shortLabel: 'Replied', to: () => '/campaign?activity=REPLIED' },
  { key: 'meetings_booked', label: 'Meetings Booked', shortLabel: 'Meetings', to: () => '/meetings' },
]

// The headline numbers shown up top -- a quick pulse, not a repeat of the full funnel below.
const HEADLINE_KEYS = ['companies_researched', 'decision_makers_found', 'connections_sent', 'emails_sent', 'meetings_booked']

const ACTIVITY_ICON = {
  discovery: { color: '#6366f1', bg: '#eef2ff', glyph: '🔍' },
  message: { color: '#ec4899', bg: '#fce7f3', glyph: '✏️' },
  outreach: { color: '#4f46e5', bg: '#eef2ff', glyph: '📤' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

// Small icon-button pair -- switches the one pipeline/funnel section between its vertical
// ("funnel") and horizontal ("pipeline") presentation. Lives inside whichever card is
// currently showing, so it travels with the section rather than staying in a fixed spot.
function ViewSwitcher({ mode, onChange }) {
  return (
    <div className="view-switcher">
      <button
        type="button"
        className={`view-switcher-btn ${mode === 'funnel' ? 'active' : ''}`}
        title="Funnel view"
        onClick={() => onChange('funnel')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path></svg>
      </button>
      <button
        type="button"
        className={`view-switcher-btn ${mode === 'pipeline' ? 'active' : ''}`}
        title="Pipeline view"
        onClick={() => onChange('pipeline')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><circle cx="6" cy="12" r="2.5"></circle><circle cx="12" cy="12" r="2.5"></circle><circle cx="18" cy="12" r="2.5"></circle></svg>
      </button>
    </div>
  )
}

export default function Overview() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [trend, setTrend] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('funnel') // 'funnel' | 'pipeline'
  const [lastRunBatchId, setLastRunBatchId] = useState(null)

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setLoading(true)
    Promise.all([
      client.get('/overview/stats'),
      client.get('/overview/recent-activity'),
      client.get('/overview/trend', { params: { days: 14 } }),
      client.get('/autonomous/status'),
    ])
      .then(([statsRes, activityRes, trendRes, statusRes]) => {
        setStats(statsRes.data)
        setActivity(activityRes.data)
        setTrend(trendRes.data)
        setLastRunBatchId(statusRes.data?.last_run?.batch_id ?? null)
      })
      .catch(err => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const goTo = (path) => navigate(`/${tenantSlug}${path}`)

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Overview</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="page page-wide">
        {error && <p className="error">{error}</p>}
        {loading && <p className="hint">Loading...</p>}
      </div>
    )
  }

  const funnelPipelineCard = (
    <div className="overview-card">
      <div className="overview-card-header">
        <h3 className="overview-card-title">{viewMode === 'funnel' ? 'Funnel Snapshot' : 'Outbound Pipeline'}</h3>
        <ViewSwitcher mode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === 'funnel' ? (
        <div className="vertical-funnel">
          {STAGES.map((stage, i) => {
            const value = stats[stage.key] ?? 0
            const meta = STAGE_ICONS[stage.key]
            return (
              <div
                className="vertical-funnel-row"
                key={stage.key}
                role="button"
                tabIndex={0}
                onClick={() => goTo(stage.to())}
                onKeyDown={e => { if (e.key === 'Enter') goTo(stage.to()) }}
              >
                <div className="vertical-funnel-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
                <div className="vertical-funnel-label">{stage.label}</div>
                <div className="vertical-funnel-value">{value}</div>
                {i < STAGES.length - 1 && <div className="vertical-funnel-line" />}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="pipeline-strip">
          {STAGES.map((stage, i) => {
            const meta = STAGE_ICONS[stage.key]
            return (
              <div className="pipeline-item" key={stage.key}>
                <div
                  className="pipeline-node"
                  role="button"
                  tabIndex={0}
                  onClick={() => goTo(stage.to())}
                  onKeyDown={e => { if (e.key === 'Enter') goTo(stage.to()) }}
                >
                  <div className="pipeline-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
                  <div className="pipeline-value">{stats[stage.key] ?? 0}</div>
                  <div className="pipeline-label">{stage.shortLabel}</div>
                </div>
                {i < STAGES.length - 1 && <div className="pipeline-connector" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="page page-wide">
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        {HEADLINE_KEYS.map(key => {
          const stage = STAGES.find(s => s.key === key)
          const meta = STAGE_ICONS[key]
          return (
            <div className="stat-card overview-headline-card compact" key={key} onClick={() => goTo(stage.to())}>
              <div className="overview-icon-badge" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
              <div>
                <div className="stat-value">{stats[key] ?? 0}</div>
                <div className="stat-label">{stage.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {funnelPipelineCard}

      <div className="overview-two-col" style={{ marginTop: '1.25rem' }}>
        <div className="overview-card">
          <h3 className="overview-card-title">Recent Activity</h3>
          {activity.length === 0 && <p className="hint">No activity yet.</p>}
          <div className="activity-timeline">
            {activity.map((a, i) => {
              const meta = ACTIVITY_ICON[a.type] || ACTIVITY_ICON.discovery
              return (
                <div className="activity-row" key={i}>
                  <div className="activity-icon" style={{ background: meta.bg, color: meta.color }}>{meta.glyph}</div>
                  <div>
                    <div className="activity-text">{a.text}</div>
                    <div className="activity-time">{timeAgo(a.timestamp)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="overview-card">
          <h3 className="overview-card-title">Email Performance</h3>
          {(stats.emails_sent ?? 0) === 0 ? (
            <p className="hint email-performance-empty">No emails sent yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { name: 'Sent', value: stats.emails_sent ?? 0, fill: '#0891b2' },
                  { name: 'Opened', value: stats.emails_opened ?? 0, fill: '#0ea5e9' },
                  { name: 'Replied', value: stats.emails_replied ?? 0, fill: '#f59e0b' },
                ]}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                barSize={48}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-faint)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} width={32} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {[{ fill: '#0891b2' }, { fill: '#0ea5e9' }, { fill: '#f59e0b' }].map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="overview-card">
          <h3 className="overview-card-title">Companies Found — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="companiesFoundGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} tickFormatter={d => d.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} width={32} />
              <Tooltip />
              <Area type="monotone" dataKey="companies_found" name="Companies found" stroke="#6366f1" fill="url(#companiesFoundGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <LatestRunPipeline batchId={lastRunBatchId} tenantSlug={tenantSlug} />
    </div>
  )
}
