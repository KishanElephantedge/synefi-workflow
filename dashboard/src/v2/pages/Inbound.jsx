import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import {
  getInboundAnalyticsOverview, getInboundAnalyticsTopPages, getInboundAnalyticsTrend,
  getInboundSearchConsoleTopQueries, getInboundSearchConsoleTopPages, getInboundVisitors,
  formatApiError,
} from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconRefreshCw } from '../icons.jsx'

function formatPercent(v) {
  if (v == null) return '–'
  return `${(v * 100).toFixed(1)}%`
}

function sum(rows, key) {
  return rows.reduce((total, r) => total + (r[key] || 0), 0)
}

// Same backend routes as V1's Inbound page (app/google_analytics_client.py,
// app/google_search_console_client.py, app/website_visitor_tracking.py) -- no second
// implementation, just a V2-styled read of the same data. Elephant Edge only, same as V1.
export default function Inbound() {
  const [overview, setOverview] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [trend, setTrend] = useState([])
  const [analyticsError, setAnalyticsError] = useState(null)
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
    setAnalyticsError(null)
    Promise.all([
      getInboundAnalyticsOverview(),
      getInboundAnalyticsTopPages({ limit: 10 }),
      getInboundAnalyticsTrend(),
    ])
      .then(([overviewData, pagesData, trendData]) => {
        setOverview(overviewData)
        setTopPages(pagesData.pages)
        setTrend(trendData.days)
      })
      .catch(err => setAnalyticsError(formatApiError(err)))
      .finally(() => setAnalyticsLoading(false))
  }

  const loadSearchConsole = () => {
    setScLoading(true)
    setScError(null)
    Promise.all([
      getInboundSearchConsoleTopQueries({ limit: 15 }),
      getInboundSearchConsoleTopPages({ limit: 10 }),
    ])
      .then(([queriesData, pagesData]) => {
        setScQueries(queriesData.queries)
        setScPages(pagesData.pages)
      })
      .catch(err => setScError(formatApiError(err)))
      .finally(() => setScLoading(false))
  }

  const loadVisitors = () => {
    setVisitorsLoading(true)
    setVisitorsError(null)
    getInboundVisitors({ limit: 50 })
      .then(setVisitors)
      .catch(err => setVisitorsError(formatApiError(err)))
      .finally(() => setVisitorsLoading(false))
  }

  useEffect(() => {
    loadAnalytics()
    loadSearchConsole()
    loadVisitors()
  }, [])

  const channels = overview?.channels || []
  const totalSessions = sum(channels, 'sessions')
  const totalUsers = sum(channels, 'activeUsers')
  const totalScClicks = sum(scQueries, 'clicks')
  const totalScImpressions = sum(scQueries, 'impressions')

  return (
    <div className="v2-inbound-page">
      <div className="v2-page-head">
        <div className="v2-page-eyebrow">Website traffic, search performance, and identified visitors</div>
        <h1 className="v2-page-title">Inbound</h1>
      </div>

      <div className="v2-stat-row">
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Sessions (7d)</div>
          <div className="v2-stat-value">{analyticsLoading ? '…' : totalSessions}</div>
        </div>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Active users (7d)</div>
          <div className="v2-stat-value">{analyticsLoading ? '…' : totalUsers}</div>
        </div>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Search clicks (28d)</div>
          <div className="v2-stat-value">{scLoading ? '…' : totalScClicks}</div>
        </div>
        <div className="v2-stat-tile">
          <div className="v2-stat-label">Search impressions (28d)</div>
          <div className="v2-stat-value">{scLoading ? '…' : totalScImpressions}</div>
        </div>
      </div>

      <div className="v2-card" style={{ marginBottom: 'var(--v2-space-5)' }}>
        <div className="v2-inbound-card-head">
          <h3 className="v2-inbound-card-title"><IconTrendingUp width={16} height={16} /> Website Traffic (Google Analytics)</h3>
          <button type="button" className="v2-btn" onClick={loadAnalytics} disabled={analyticsLoading}>
            <IconRefreshCw width={13} height={13} /> {analyticsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {analyticsError && (
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={18} height={18} style={{ marginBottom: 6 }} />
            <div>{analyticsError}</div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="v2InboundSessionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--v2-accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--v2-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--v2-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--v2-text-faint)' }} tickFormatter={d => d?.slice(4, 6) + '/' + d?.slice(6, 8)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--v2-text-faint)' }} width={32} />
            <Tooltip labelFormatter={d => d} />
            <Area type="monotone" dataKey="sessions" name="Sessions" stroke="var(--v2-accent)" fill="url(#v2InboundSessionsGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>

        <div className="v2-card-grid-2" style={{ marginTop: 'var(--v2-space-4)', marginBottom: 0 }}>
          <div>
            <div className="v2-inbound-list-title">Traffic by channel (7d)</div>
            {channels.map(c => (
              <div key={c.sessionDefaultChannelGroup} className="v2-inbound-row">
                <span className="v2-inbound-row-primary">{c.sessionDefaultChannelGroup}</span>
                <span className="v2-inbound-row-meta">{c.sessions} sessions · {c.activeUsers} users</span>
              </div>
            ))}
            {channels.length === 0 && !analyticsLoading && <div className="v2-state">No traffic data.</div>}
          </div>
          <div>
            <div className="v2-inbound-list-title">Top pages (7d)</div>
            {topPages.map(p => (
              <div key={p.pagePath} className="v2-inbound-row">
                <span className="v2-inbound-row-primary v2-inbound-truncate">{p.pagePath}</span>
                <span className="v2-inbound-row-meta">{p.screenPageViews} views · {p.activeUsers} users</span>
              </div>
            ))}
            {topPages.length === 0 && !analyticsLoading && <div className="v2-state">No page data.</div>}
          </div>
        </div>
      </div>

      <div className="v2-card" style={{ marginBottom: 'var(--v2-space-5)' }}>
        <div className="v2-inbound-card-head">
          <h3 className="v2-inbound-card-title">Website Visitors (company-level)</h3>
          <button type="button" className="v2-btn" onClick={loadVisitors} disabled={visitorsLoading}>
            <IconRefreshCw width={13} height={13} /> {visitorsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="v2-inbound-subtext">
          Identifies the COMPANY behind a visit via IP lookup — never the individual person. An IP is a network, not a person.
        </p>
        {visitorsError && (
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={18} height={18} style={{ marginBottom: 6 }} />
            <div>{visitorsError}</div>
          </div>
        )}
        {visitors.map(v => (
          <div key={v.id} className="v2-inbound-row">
            <span className="v2-inbound-row-primary">
              {v.company_website ? <a href={v.company_website} target="_blank" rel="noopener noreferrer">{v.company_name}</a> : v.company_name}
              {v.is_fuzzy_match && <span className="v2-status-pill tone-warning-soft" style={{ marginLeft: 8 }}>fuzzy</span>}
            </span>
            <span className="v2-inbound-row-meta">
              {v.company_industry || '–'} · {[v.company_city, v.company_state, v.company_country].filter(Boolean).join(', ') || '–'} · {v.page_path || '–'}
            </span>
          </div>
        ))}
        {visitors.length === 0 && !visitorsLoading && (
          <div className="v2-state">No identified visitors yet — make sure the tracking snippet is installed on the site.</div>
        )}
      </div>

      <div className="v2-card">
        <div className="v2-inbound-card-head">
          <h3 className="v2-inbound-card-title">Search Performance (Search Console)</h3>
          <button type="button" className="v2-btn" onClick={loadSearchConsole} disabled={scLoading}>
            <IconRefreshCw width={13} height={13} /> {scLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="v2-inbound-subtext">Last 28 days, ending 3 days ago (Search Console's own reporting lag).</p>
        {scError && (
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={18} height={18} style={{ marginBottom: 6 }} />
            <div>{scError}</div>
          </div>
        )}
        <div className="v2-card-grid-2" style={{ marginBottom: 0 }}>
          <div>
            <div className="v2-inbound-list-title">Top queries</div>
            {scQueries.map(q => (
              <div key={q.query} className="v2-inbound-row">
                <span className="v2-inbound-row-primary v2-inbound-truncate">{q.query}</span>
                <span className="v2-inbound-row-meta">{q.clicks} clicks · {q.impressions} impr · {formatPercent(q.ctr)} · pos {q.position?.toFixed(1)}</span>
              </div>
            ))}
            {scQueries.length === 0 && !scLoading && <div className="v2-state">No query data.</div>}
          </div>
          <div>
            <div className="v2-inbound-list-title">Top pages by clicks</div>
            {scPages.map(p => (
              <div key={p.page} className="v2-inbound-row">
                <span className="v2-inbound-row-primary v2-inbound-truncate">{(p.page || '').replace('https://elephantedge.ai', '')}</span>
                <span className="v2-inbound-row-meta">{p.clicks} clicks · {p.impressions} impr · {formatPercent(p.ctr)}</span>
              </div>
            ))}
            {scPages.length === 0 && !scLoading && <div className="v2-state">No page data.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
