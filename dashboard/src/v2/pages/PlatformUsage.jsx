import { useCallback, useEffect, useState } from 'react'
import { getUsageSummary } from '../../api/usage'
import { formatApiError } from '../api.js'
import { formatRecency } from '../format.js'
import { IconAlertTriangle } from '../icons.jsx'

// Who is using the platform -- Elephant Edge AND every partner workspace -- from where, and which
// pages. Every number is a real count from the gateway's usage tables (gateway/app/main.py:
// usage_summary); nothing here is sampled or estimated.
//
// Leads with the workspace list, not the Elephant Edge view: this is the admin's view across the
// whole platform, and a partner who has a login but has never opened their dashboard is exactly
// what it needs to surface. Internal-only -- the summary route is require_internal server-side.

const WINDOWS = [
  [1, '24 hours'],
  [7, '7 days'],
  [30, '30 days'],
]

// Matches the client heartbeat, so someone who just arrived shows up within about one refresh.
const REFRESH_MS = 30_000

// Long lists scroll inside their panel rather than stretching the page.
const SCROLL_TABLE = { maxHeight: 340, overflowY: 'auto' }

function Stat({ value, label, hint }) {
  return (
    <div className="v2-card" style={{ flex: '1 1 150px', minWidth: 0 }}>
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

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="v2-table-muted" style={{ textAlign: 'center', padding: '1.2rem' }}>
        {children}
      </td>
    </tr>
  )
}

function Row({ cols }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>{cols}</div>
}

function personLabel(row) {
  return row.name || row.email || 'Unknown user'
}

function Seen({ at }) {
  const seen = formatRecency(at)
  return <span title={seen?.exact}>{seen ? seen.label : 'Never'}</span>
}

export default function PlatformUsage() {
  const [windowDays, setWindowDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(
    () =>
      getUsageSummary(windowDays)
        .then((res) => {
          setData(res)
          setError(null)
        })
        .catch((err) => setError(formatApiError(err))),
    [windowDays],
  )

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
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

  if (!data) {
    return <div className="v2-card"><div className="v2-state">Loading usage…</div></div>
  }

  const { live, totals } = data
  const partners = data.workspaces.filter((w) => w.is_partner)
  const partnersActive = partners.filter((w) => w.pageviews > 0).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {WINDOWS.map(([days, label]) => (
          <button
            key={days}
            type="button"
            className={`v2-config-tab${days === windowDays ? ' active' : ''}`}
            onClick={() => setWindowDays(days)}
          >
            {label}
          </button>
        ))}
      </div>

      <Row
        cols={[
          <Stat key="now" value={live.active_users} label="On right now" hint={`active in the last ${live.window_minutes} min`} />,
          <Stat key="partners" value={`${partnersActive}/${partners.length}`} label="Partners active" hint={`used their dashboard in ${data.window_days}d`} />,
          <Stat key="people" value={totals.users} label="People" hint={`last ${data.window_days}d`} />,
          <Stat key="sessions" value={totals.sessions} label="Sessions" hint={`last ${data.window_days}d`} />,
          <Stat key="views" value={totals.pageviews} label="Page views" hint={`last ${data.window_days}d`} />,
        ]}
      />

      <Row
        cols={
          <Panel
            full
            title="Every workspace"
            subtitle={`Elephant Edge and all partners, including any that haven't logged in. Activity over ${data.window_days} days.`}
          >
            <div className="v2-table-wrap" style={SCROLL_TABLE}>
              <table className="v2-table">
                <thead>
                  <tr><th>Workspace</th><th>Logins</th><th>On now</th><th>People</th><th>Page views</th><th>Last used</th></tr>
                </thead>
                <tbody>
                  {data.workspaces.map((w) => (
                    <tr key={w.slug}>
                      <td>
                        <div className="v2-account-name">{w.tenant}</div>
                        <div className="v2-table-muted">{w.is_partner ? 'Partner' : 'Workspace'}</div>
                      </td>
                      <td className={w.logins ? '' : 'v2-table-muted'}>{w.is_partner ? w.logins : '—'}</td>
                      <td>
                        {w.active_now > 0 ? (
                          <span className="v2-status-pill tone-success-solid">{w.active_now} online</span>
                        ) : (
                          <span className="v2-table-muted">—</span>
                        )}
                      </td>
                      <td className={w.users ? '' : 'v2-table-muted'}>{w.users}</td>
                      <td className={w.pageviews ? '' : 'v2-table-muted'}>{w.pageviews}</td>
                      <td className="v2-table-muted"><Seen at={w.last_seen_at} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        }
      />

      <Row
        cols={
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
                    live.now.map((row, i) => (
                      <tr key={`${row.email}-${i}`}>
                        <td>
                          <div className="v2-account-name">{personLabel(row)}</div>
                          <div className="v2-table-muted">
                            {row.role === 'partner' ? 'Partner' : 'Elephant Edge team'}
                            {row.open_sessions > 1 ? ` · ${row.open_sessions} tabs open` : ''}
                          </div>
                        </td>
                        <td className={row.tenant ? '' : 'v2-table-muted'}>{row.tenant || '—'}</td>
                        <td className={row.path ? '' : 'v2-table-muted'}>{row.path || '—'}</td>
                        <td className={row.country ? '' : 'v2-table-muted'}>{row.country || '—'}</td>
                        <td className="v2-table-muted"><Seen at={row.last_seen_at} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        }
      />

      <Row
        cols={[
          <Panel key="people" title="People" subtitle={`Activity over the last ${data.window_days} days`}>
            <div className="v2-table-wrap" style={SCROLL_TABLE}>
              <table className="v2-table">
                <thead><tr><th>Person</th><th>Views</th><th>Sessions</th><th>Last seen</th></tr></thead>
                <tbody>
                  {data.top_users.length === 0 ? (
                    <EmptyRow colSpan={4}>No activity recorded yet.</EmptyRow>
                  ) : (
                    data.top_users.map((row) => (
                      <tr key={row.email}>
                        <td>
                          <div className="v2-account-name">{personLabel(row)}</div>
                          <div className="v2-table-muted">
                            {row.role === 'partner' ? `Partner · ${row.home_workspace || 'no workspace'}` : 'Elephant Edge team'}
                          </div>
                        </td>
                        <td>{row.pageviews}</td>
                        <td>{row.sessions}</td>
                        <td className="v2-table-muted"><Seen at={row.last_seen_at} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>,
          <Panel key="pages" title="Most used pages" subtitle={`Page views over the last ${data.window_days} days`}>
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
          </Panel>,
        ]}
      />

      <Row
        cols={
          <Panel title="Where people are" subtitle={`Sessions by country, last ${data.window_days} days`}>
            <div className="v2-table-wrap" style={{ ...SCROLL_TABLE, maxHeight: 220 }}>
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
        }
      />
    </div>
  )
}
