import { useCallback, useEffect, useState } from 'react'
import { getUsageSummary } from '../../api/usage'
import { formatApiError } from '../api.js'
import { formatRecency } from '../format.js'
import { IconAlertTriangle } from '../icons.jsx'

// Who is actually using the platform, from where, and which pages they use. Every number here
// is a real count from the gateway's own usage_sessions/usage_events tables (see
// gateway/app/main.py: usage_summary) -- there are no sampled, modelled or estimated figures on
// this page, and a metric with no data reads as empty rather than as zero-with-confidence.
//
// Internal-only: /api/usage/summary is gated by require_internal server-side, so a partner
// hitting this route gets a real 403 rather than a partially-populated page.

const WINDOWS = [
  [1, '24 hours'],
  [7, '7 days'],
  [30, '30 days'],
]

// The live tiles are only meaningful if they keep up with reality -- a "who is on right now"
// number that is ten minutes stale is worse than not showing one. Matches the client heartbeat
// interval so a newly-active session appears within about one refresh.
const REFRESH_MS = 30_000

function Stat({ value, label, hint }) {
  return (
    <div className="v2-card" style={{ flex: '1 1 160px', minWidth: 0 }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div className="v2-stat-label">{label}</div>
      {hint && <div className="v2-table-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Panel({ title, subtitle, children, full }) {
  return (
    <div className="v2-card" style={{ flex: full ? '1 1 100%' : '1 1 420px', minWidth: 0 }}>
      <div className="v2-section-title">{title}</div>
      {subtitle && (
        <div className="v2-table-muted" style={{ fontSize: '0.78rem', marginTop: -4, marginBottom: 10 }}>{subtitle}</div>
      )}
      {children}
    </div>
  )
}

// Tables here are unbounded by nature -- "every page anyone visited" grows forever. Capping the
// visible height keeps one long list from stretching the page and leaving its neighbour panel
// as dead space, without hiding rows: the wrap scrolls.
const SCROLL_TABLE = { maxHeight: 340, overflowY: 'auto' }

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="v2-table-muted" style={{ textAlign: 'center', padding: '1.2rem' }}>
        {children}
      </td>
    </tr>
  )
}

function personLabel(row) {
  return row.name || row.email || 'Unknown user'
}

export default function PlatformUsage() {
  const [windowDays, setWindowDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (showSpinner) => {
      if (showSpinner) setLoading(true)
      return getUsageSummary(windowDays)
        .then((res) => {
          setData(res)
          setError(null)
        })
        .catch((err) => setError(formatApiError(err)))
        .finally(() => setLoading(false))
    },
    [windowDays],
  )

  useEffect(() => {
    load(true)
  }, [load])

  useEffect(() => {
    // Background refresh only -- never re-triggers the spinner, so the page doesn't flash
    // every 30 seconds while someone is reading it.
    const timer = setInterval(() => load(false), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load usage: {error}</div>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return <div className="v2-card"><div className="v2-state">Loading usage…</div></div>
  }

  const live = data.live
  const totals = data.totals

  return (
    <div>
      <p className="v2-accounts-subtitle">
        Who is using the platform right now, and how it's been used over time.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {WINDOWS.map(([days, label]) => (
          <button
            key={days}
            type="button"
            className="v2-btn"
            onClick={() => setWindowDays(days)}
            style={days === windowDays ? { fontWeight: 700, borderColor: 'var(--v2-accent)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat value={live.active_users} label="On right now" hint={`active in the last ${live.window_minutes} min`} />
        <Stat value={live.active_sessions} label="Open sessions" hint="one per browser tab/session" />
        <Stat value={totals.users} label="People" hint={`in the last ${data.window_days}d`} />
        <Stat value={totals.sessions} label="Sessions" hint={`in the last ${data.window_days}d`} />
        <Stat value={totals.pageviews} label="Page views" hint={`in the last ${data.window_days}d`} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Panel full title="On right now" subtitle={`Anyone active in the last ${live.window_minutes} minutes`}>
          <div className="v2-table-wrap" style={SCROLL_TABLE}>
            <table className="v2-table">
              <thead>
                <tr><th>Person</th><th>Workspace</th><th>On page</th><th>From</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                {live.now.length === 0 ? (
                  <EmptyRow colSpan={5}>Nobody is on the platform right now.</EmptyRow>
                ) : (
                  live.now.map((row, i) => {
                    const seen = formatRecency(row.last_seen_at)
                    return (
                      <tr key={`${row.email}-${i}`}>
                        <td>
                          <div className="v2-account-name">{personLabel(row)}</div>
                          <div className="v2-table-muted">{row.role}</div>
                        </td>
                        <td className={row.tenant ? '' : 'v2-table-muted'}>{row.tenant || '—'}</td>
                        <td className={row.path ? '' : 'v2-table-muted'}>{row.path || '—'}</td>
                        <td className={row.country ? '' : 'v2-table-muted'}>{row.country || '—'}</td>
                        <td className="v2-table-muted" title={seen?.exact}>{seen ? seen.label : '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Panel title="Most used pages" subtitle={`Page views over the last ${data.window_days} days`}>
          <div className="v2-table-wrap" style={SCROLL_TABLE}>
            <table className="v2-table">
              <thead><tr><th>Page</th><th>Views</th><th>People</th></tr></thead>
              <tbody>
                {data.top_pages.length === 0 ? (
                  <EmptyRow colSpan={3}>No page views recorded yet.</EmptyRow>
                ) : (
                  data.top_pages.map((row) => (
                    <tr key={row.path}>
                      <td>{row.path}</td>
                      <td>{row.views}</td>
                      <td>{row.users}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Panel title="People" subtitle={`Activity over the last ${data.window_days} days`}>
          <div className="v2-table-wrap" style={SCROLL_TABLE}>
            <table className="v2-table">
              <thead><tr><th>Person</th><th>Views</th><th>Sessions</th><th>Last seen</th></tr></thead>
              <tbody>
                {data.top_users.length === 0 ? (
                  <EmptyRow colSpan={4}>No activity recorded yet.</EmptyRow>
                ) : (
                  data.top_users.map((row) => {
                    const seen = formatRecency(row.last_seen_at)
                    return (
                      <tr key={row.email}>
                        <td>
                          <div className="v2-account-name">{personLabel(row)}</div>
                          <div className="v2-table-muted">{row.role}</div>
                        </td>
                        <td>{row.pageviews}</td>
                        <td>{row.sessions}</td>
                        <td className="v2-table-muted" title={seen?.exact}>{seen ? seen.label : '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Workspaces & locations" subtitle={`Last ${data.window_days} days`}>
          <div className="v2-table-wrap" style={{ ...SCROLL_TABLE, maxHeight: 200, marginBottom: 12 }}>
            <table className="v2-table">
              <thead><tr><th>Workspace</th><th>Views</th><th>People</th></tr></thead>
              <tbody>
                {data.by_tenant.length === 0 ? (
                  <EmptyRow colSpan={3}>No workspace activity yet.</EmptyRow>
                ) : (
                  data.by_tenant.map((row) => (
                    <tr key={row.tenant}>
                      <td>{row.tenant}</td>
                      <td>{row.pageviews}</td>
                      <td>{row.users}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="v2-table-wrap" style={{ ...SCROLL_TABLE, maxHeight: 200 }}>
            <table className="v2-table">
              <thead><tr><th>Country</th><th>Sessions</th></tr></thead>
              <tbody>
                {data.by_country.length === 0 ? (
                  <EmptyRow colSpan={2}>No sessions recorded yet.</EmptyRow>
                ) : (
                  data.by_country.map((row) => (
                    <tr key={row.country}>
                      <td>{row.country}</td>
                      <td>{row.sessions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
