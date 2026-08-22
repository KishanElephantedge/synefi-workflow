import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import client from '../api/client'

function formatPercent(v) {
  if (v == null) return '-'
  return `${(v * 100).toFixed(1)}%`
}

function sum(rows, key) {
  return rows.reduce((total, r) => total + (r[key] || 0), 0)
}

// Elephant Edge only -- backed by Google Analytics (GA4) + Search Console, both wired via
// app/google_analytics_client.py / app/google_search_console_client.py (deliberately separate
// from the Google Calendar integration). Live-queried on load, no snapshot storage yet. A third
// inbound source (leads/forms) is still being scoped and isn't wired up here yet.
export default function Inbound() {
  const { tenantSlug } = useParams()

  const [overview, setOverview] = useState(null)
  const [overviewError, setOverviewError] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [trend, setTrend] = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const [visitors, setVisitors] = useState([])
  const [visitorsError, setVisitorsError] = useState(null)
  const [visitorsLoading, setVisitorsLoading] = useState(true)

  const [scQueries, setScQueries] = useState([])
  const [scPages, setScPages] = useState([])
  const [scError, setScError] = useState(null)
  const [scLoading, setScLoading] = useState(true)

  const loadAnalytics = () => {
    setAnalyticsLoading(true)
    setOverviewError(null)
    Promise.all([
      client.get('/inbound/analytics/overview'),
      client.get('/inbound/analytics/top-pages', { params: { limit: 10 } }),
      client.get('/inbound/analytics/trend'),
    ])
      .then(([overviewRes, pagesRes, trendRes]) => {
        setOverview(overviewRes.data)
        setTopPages(pagesRes.data.pages)
        setTrend(trendRes.data.days)
      })
      .catch(err => setOverviewError(err.response?.data?.detail || err.message))
      .finally(() => setAnalyticsLoading(false))
  }

  const loadSearchConsole = () => {
    setScLoading(true)
    setScError(null)
    Promise.all([
      client.get('/inbound/search-console/top-queries', { params: { limit: 15 } }),
      client.get('/inbound/search-console/top-pages', { params: { limit: 10 } }),
    ])
      .then(([queriesRes, pagesRes]) => {
        setScQueries(queriesRes.data.queries)
        setScPages(pagesRes.data.pages)
      })
      .catch(err => setScError(err.response?.data?.detail || err.message))
      .finally(() => setScLoading(false))
  }

  const loadVisitors = () => {
    setVisitorsLoading(true)
    setVisitorsError(null)
    client.get('/inbound/visitors', { params: { limit: 50 } })
      .then(res => setVisitors(res.data))
      .catch(err => setVisitorsError(err.response?.data?.detail || err.message))
      .finally(() => setVisitorsLoading(false))
  }

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    loadAnalytics()
    loadVisitors()
    loadSearchConsole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Inbound</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  const channels = overview?.channels || []
  const totalSessions = sum(channels, 'sessions')
  const totalUsers = sum(channels, 'activeUsers')
  const totalScClicks = sum(scQueries, 'clicks')
  const totalScImpressions = sum(scQueries, 'impressions')

  return (
    <div className="page page-wide">
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Sessions (7d)</div>
          <div className="stat-value">{analyticsLoading ? '...' : totalSessions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Users (7d)</div>
          <div className="stat-value">{analyticsLoading ? '...' : totalUsers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Search Clicks (28d)</div>
          <div className="stat-value">{scLoading ? '...' : totalScClicks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Search Impressions (28d)</div>
          <div className="stat-value">{scLoading ? '...' : totalScImpressions}</div>
        </div>
      </div>

      <div className="overview-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 className="overview-card-title" style={{ margin: 0 }}>Website Traffic (Google Analytics)</h3>
          <button type="button" className="secondary btn-small" onClick={loadAnalytics} disabled={analyticsLoading}>
            {analyticsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {overviewError && <p className="error">{overviewError}</p>}

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="inboundSessionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} tickFormatter={d => d?.slice(4, 6) + '/' + d?.slice(6, 8)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} width={32} />
            <Tooltip labelFormatter={d => d} />
            <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#6366f1" fill="url(#inboundSessionsGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
          <div>
            <h5 style={{ marginBottom: '0.5rem' }}>Traffic by channel (7d)</h5>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Channel</th><th>Sessions</th><th>Users</th></tr></thead>
                <tbody>
                  {channels.map(c => (
                    <tr key={c.sessionDefaultChannelGroup}>
                      <td>{c.sessionDefaultChannelGroup}</td>
                      <td>{c.sessions}</td>
                      <td>{c.activeUsers}</td>
                    </tr>
                  ))}
                  {channels.length === 0 && !analyticsLoading && (
                    <tr><td colSpan={3} className="empty-state">No traffic data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h5 style={{ marginBottom: '0.5rem' }}>Top pages (7d)</h5>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Page</th><th>Views</th><th>Users</th></tr></thead>
                <tbody>
                  {topPages.map(p => (
                    <tr key={p.pagePath}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pagePath}</td>
                      <td>{p.screenPageViews}</td>
                      <td>{p.activeUsers}</td>
                    </tr>
                  ))}
                  {topPages.length === 0 && !analyticsLoading && (
                    <tr><td colSpan={3} className="empty-state">No page data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="overview-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 className="overview-card-title" style={{ margin: 0 }}>Website Visitors (company-level)</h3>
          <button type="button" className="secondary btn-small" onClick={loadVisitors} disabled={visitorsLoading}>
            {visitorsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Identifies the COMPANY behind a visit (via IP lookup), never the individual person -- an IP is a network, not a person.
          Only shows visits successfully resolved to a real company.
        </p>
        {visitorsError && <p className="error">{visitorsError}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Page</th><th>Match</th><th>When</th></tr></thead>
            <tbody>
              {visitors.map(v => (
                <tr key={v.id}>
                  <td>
                    {v.company_website ? (
                      <a href={v.company_website} target="_blank" rel="noopener noreferrer">{v.company_name}</a>
                    ) : v.company_name}
                  </td>
                  <td>{v.company_industry || '-'}</td>
                  <td>{[v.company_city, v.company_state, v.company_country].filter(Boolean).join(', ') || '-'}</td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.page_path || '-'}</td>
                  <td><span className={`status-pill status-pill-sm ${v.is_fuzzy_match ? 'warn' : 'on'}`}>{v.is_fuzzy_match ? 'fuzzy' : 'confirmed'}</span></td>
                  <td>{new Date(v.created_at + 'Z').toLocaleString()}</td>
                </tr>
              ))}
              {visitors.length === 0 && !visitorsLoading && (
                <tr><td colSpan={6} className="empty-state">No identified visitors yet -- make sure the tracking snippet is installed on the site.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overview-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 className="overview-card-title" style={{ margin: 0 }}>Search Performance (Search Console)</h3>
          <button type="button" className="secondary btn-small" onClick={loadSearchConsole} disabled={scLoading}>
            {scLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>Last 28 days, ending 3 days ago (Search Console's own reporting lag).</p>
        {scError && <p className="error">{scError}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <h5 style={{ marginBottom: '0.5rem' }}>Top queries</h5>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Query</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th></tr></thead>
                <tbody>
                  {scQueries.map(q => (
                    <tr key={q.query}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</td>
                      <td>{q.clicks}</td>
                      <td>{q.impressions}</td>
                      <td>{formatPercent(q.ctr)}</td>
                      <td>{q.position?.toFixed(1)}</td>
                    </tr>
                  ))}
                  {scQueries.length === 0 && !scLoading && (
                    <tr><td colSpan={5} className="empty-state">No query data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h5 style={{ marginBottom: '0.5rem' }}>Top pages by clicks</h5>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Page</th><th>Clicks</th><th>Impr.</th><th>CTR</th></tr></thead>
                <tbody>
                  {scPages.map(p => (
                    <tr key={p.page}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.page || '').replace('https://elephantedge.ai', '')}</td>
                      <td>{p.clicks}</td>
                      <td>{p.impressions}</td>
                      <td>{formatPercent(p.ctr)}</td>
                    </tr>
                  ))}
                  {scPages.length === 0 && !scLoading && (
                    <tr><td colSpan={4} className="empty-state">No page data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
