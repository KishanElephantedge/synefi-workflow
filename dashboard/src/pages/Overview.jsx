import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import client from '../api/client'

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
  { key: 'connections_sent', label: 'Connections Sent', shortLabel: 'Sent', to: () => '/campaign?activity=SENT' },
  { key: 'connections_accepted', label: 'Connections Accepted', shortLabel: 'Accepted', to: () => '/campaign?activity=CONNECTED' },
  { key: 'replied', label: 'Replied', shortLabel: 'Replied', to: () => '/campaign?activity=REPLIED' },
  { key: 'meetings_booked', label: 'Meetings Booked', shortLabel: 'Meetings', to: () => '/meetings' },
]

// The four headline numbers shown up top -- a quick pulse, not a repeat of the full funnel
// below it.
const HEADLINE_KEYS = ['companies_researched', 'decision_makers_found', 'connections_sent', 'meetings_booked']

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

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setLoading(true)
    Promise.all([
      client.get('/overview/stats'),
      client.get('/overview/recent-activity'),
      client.get('/overview/trend', { params: { days: 14 } }),
    ])
      .then(([statsRes, activityRes, trendRes]) => {
        setStats(statsRes.data)
        setActivity(activityRes.data)
        setTrend(trendRes.data)
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
            <div className="stat-card overview-headline-card" key={key} onClick={() => goTo(stage.to())}>
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
    </div>
  )
}
