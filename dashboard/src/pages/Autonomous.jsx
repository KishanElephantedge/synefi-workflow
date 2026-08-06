import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'

// Schedule input/display timezone options -- the backend only ever stores/fires on UTC (see
// autonomous_orchestrator.py), this is purely a display convenience so hour/minute don't have
// to be mentally converted from IST/US by hand every time.
const SCHEDULE_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Chicago', label: 'US Central' },
  { value: 'America/Denver', label: 'US Mountain' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'UTC', label: 'UTC' },
]

// Uses the current real UTC offset for the given IANA zone (correctly follows DST, unlike a
// hardcoded fixed offset) -- good enough for a daily schedule display, not meant to be exact
// across a DST transition boundary day.
function tzOffsetMinutes(timeZone) {
  const now = new Date()
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tz = new Date(now.toLocaleString('en-US', { timeZone }))
  return Math.round((tz - utc) / 60000)
}

function utcToLocal(hourUtc, minuteUtc, timeZone) {
  const offset = tzOffsetMinutes(timeZone)
  const total = (((hourUtc * 60 + minuteUtc + offset) % 1440) + 1440) % 1440
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

function localToUtc(hourLocal, minuteLocal, timeZone) {
  const offset = tzOffsetMinutes(timeZone)
  const total = (((hourLocal * 60 + minuteLocal - offset) % 1440) + 1440) % 1440
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

const RUN_HISTORY_PAGE_SIZE = 10

export default function Autonomous() {
  const { tenantSlug } = useParams()
  const [tab, setTab] = useState('control') // 'control' | 'schedule'
  const [status, setStatus] = useState(null)
  const [runs, setRuns] = useState([])
  const [runsPage, setRunsPage] = useState(1)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [expandedRuns, setExpandedRuns] = useState({})
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Kolkata')
  const [scheduleHour, setScheduleHour] = useState('')
  const [scheduleMinute, setScheduleMinute] = useState('')

  const load = () => {
    client.get('/autonomous/status').then(res => setStatus(res.data)).catch(err => setError(err.message))
    client.get('/autonomous/runs').then(res => setRuns(res.data)).catch(err => setError(err.message))
    client.get('/autonomous/weekly-report').then(res => setReport(res.data)).catch(err => setError(err.message))
  }

  useEffect(load, [])

  useEffect(() => {
    if (status?.schedule_utc) {
      const local = utcToLocal(status.schedule_utc.hour, status.schedule_utc.minute, scheduleTimezone)
      setScheduleHour(String(local.hour))
      setScheduleMinute(String(local.minute).padStart(2, '0'))
    }
  }, [status?.schedule_utc?.hour, status?.schedule_utc?.minute, scheduleTimezone])

  const toggle = async (enabled) => {
    setBusy(true)
    try {
      await client.post('/autonomous/toggle', null, { params: { enabled } })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const triggerNow = async () => {
    if (!window.confirm('Run today\'s autonomous cycle right now?')) return
    setBusy(true)
    try {
      const res = await client.post('/autonomous/trigger-now')
      if (res.data.status === 'skipped' && res.data.reason === 'a cycle is already running') {
        window.alert(`Nothing ran: a cycle is already in progress (started ${new Date(res.data.running_since).toLocaleTimeString()}). Wait for it to finish before triggering another.`)
      } else if (res.data.status === 'skipped') {
        window.alert('Nothing ran: the autonomous system is currently paused. Click "Start" first, then "Run now".')
      } else if (res.data.status === 'failed') {
        window.alert(`Run failed: ${res.data.error}`)
      } else if (res.data.status === 'awaiting_approval') {
        window.alert(
          `Run paused for approval. Companies discovered: ${res.data.companies_discovered}, ` +
          `decision-makers found: ${res.data.decision_maker_result?.decision_makers_found ?? 0}. ` +
          `A review email has been sent -- outreach will proceed automatically after the approval window, unless cancelled.`
        )
      } else {
        window.alert(
          `Run complete. Companies discovered: ${res.data.companies_discovered}, ` +
          `selected: ${res.data.companies_selected}, contacts pushed: ${res.data.outreach_result?.pushed ?? 0}.`
        )
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setDiscoverySource = async (source) => {
    if (status?.enabled) {
      window.alert('Pause the autonomous system first before changing the discovery source -- switching it mid-cycle risks the wrong pipeline running.')
      return
    }
    setBusy(true)
    try {
      await client.post('/autonomous/discovery-source', null, { params: { source } })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveSchedule = async () => {
    const hourLocal = parseInt(scheduleHour, 10)
    const minuteLocal = parseInt(scheduleMinute, 10)
    if (isNaN(hourLocal) || hourLocal < 0 || hourLocal > 23 || isNaN(minuteLocal) || minuteLocal < 0 || minuteLocal > 59) {
      setError('Hour must be 0-23 and minute 0-59')
      return
    }
    const { hour, minute } = localToUtc(hourLocal, minuteLocal, scheduleTimezone)
    setBusy(true)
    try {
      await client.post('/autonomous/schedule', null, { params: { hour, minute } })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelRun = async (runId) => {
    if (!window.confirm('Cancel this run? Nothing will be pushed to the outreach channel for it.')) return
    setBusy(true)
    try {
      await client.post(`/autonomous/runs/${runId}/cancel`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setBusy(false)
    }
  }

  const runsTotalPages = Math.ceil((runs?.length || 0) / RUN_HISTORY_PAGE_SIZE)
  const visibleRuns = (runs || []).slice((runsPage - 1) * RUN_HISTORY_PAGE_SIZE, runsPage * RUN_HISTORY_PAGE_SIZE)

  return (
    <div className="page">
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={tab === 'control' ? '' : 'secondary'} onClick={() => setTab('control')}>Control</button>
        <button type="button" className={tab === 'schedule' ? '' : 'secondary'} onClick={() => setTab('schedule')}>Schedule</button>
      </div>

      {tab === 'schedule' && status && (
        <div className="card">
          <h2>Daily schedule</h2>
          <div className="inline-form">
            <label style={{ minWidth: 'auto' }}>Runs daily at:</label>
            <input
              type="number"
              min={0}
              max={23}
              value={scheduleHour}
              onChange={e => setScheduleHour(e.target.value)}
              style={{ width: '4rem' }}
              disabled={busy}
            />
            <span>:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={scheduleMinute}
              onChange={e => setScheduleMinute(e.target.value)}
              style={{ width: '4rem' }}
              disabled={busy}
            />
            <select value={scheduleTimezone} onChange={e => setScheduleTimezone(e.target.value)} disabled={busy}>
              {SCHEDULE_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={busy} onClick={saveSchedule}>
              Save time
            </button>
          </div>
          <p className="hint">
            A fixed daily time, not a countdown -- takes effect immediately and isn't
            affected by deploys or restarts, unlike a simple "every 24h" timer. Stored as UTC
            internally; the timezone dropdown is just for entering/reading the time without
            converting by hand.
          </p>
        </div>
      )}

      {tab === 'control' && (
        <>
          <div className="card">
            <h2>Control</h2>
            {status && (
              <>
                <p style={{ marginBottom: '1rem' }}>
                  <span className={`status-pill ${status.enabled ? 'on' : 'off'}`}>
                    {status.enabled ? 'Running' : 'Paused'}
                  </span>
                </p>
                <div className="inline-form">
                  <button type="button" disabled={busy || status.enabled} onClick={() => toggle(true)}>
                    Start
                  </button>
                  <button type="button" className="secondary" disabled={busy || !status.enabled} onClick={() => toggle(false)}>
                    Pause
                  </button>
                  <button type="button" className="secondary" disabled={busy} onClick={triggerNow}>
                    Run now (manual trigger)
                  </button>
                </div>
                <p className="hint">
                  This cycle no-ops whenever the toggle is off, so "Pause" is a safe kill switch
                  without restarting the server.
                </p>

                <div className="inline-form" style={{ marginTop: '0.75rem' }}>
                  <label style={{ minWidth: 'auto' }}>Discovery source:</label>
                  <select
                    value={status.discovery_source}
                    disabled={busy || status.enabled}
                    onChange={e => setDiscoverySource(e.target.value)}
                  >
                    <option value="deepline">Deepline</option>
                    <option value="jobo">Jobo</option>
                    <option value="apify">Apify</option>
                  </select>
                </div>

                {status.last_run ? (
                  <div className="stat-grid" style={{ marginTop: '1rem' }}>
                    <div className="stat-card">
                      <div className="stat-label">Last run</div>
                      <div className="stat-value" style={{ fontSize: '0.95rem' }}>{new Date(status.last_run.run_date).toLocaleDateString()}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Status</div>
                      <div className="stat-value" style={{ fontSize: '0.95rem' }}>{status.last_run.status}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Companies selected</div>
                      <div className="stat-value">{status.last_run.companies_selected}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Contacts pushed</div>
                      <div className="stat-value">{status.last_run.contacts_pushed}</div>
                    </div>
                  </div>
                ) : (
                  <p className="hint">No runs yet.</p>
                )}

                {status.last_run?.status === 'awaiting_approval' && (
                  <div className="card" style={{ marginTop: '1rem', background: 'var(--surface-alt)' }}>
                    <p style={{ margin: '0 0 0.75rem' }}>
                      <span className="status-pill warn">Awaiting approval</span>{' '}
                      A review email with the decision-makers found has been sent. This run will push to the
                      outreach channel at{' '}
                      <strong>{status.last_run.awaiting_approval_until ? new Date(status.last_run.awaiting_approval_until).toLocaleTimeString() : '-'}</strong>{' '}
                      unless cancelled first.
                    </p>
                    <button type="button" className="secondary" disabled={busy} onClick={() => cancelRun(status.last_run.id)}>
                      Cancel this run
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h2>Weekly rollup</h2>
            {report && (
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Days run</div>
                  <div className="stat-value">{report.days_run}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Discovered</div>
                  <div className="stat-value">{report.total_companies_discovered}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Selected</div>
                  <div className="stat-value">{report.total_companies_selected}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Contacts found</div>
                  <div className="stat-value">{report.total_contacts_found}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Contacts pushed</div>
                  <div className="stat-value">{report.total_contacts_pushed}</div>
                </div>
              </div>
            )}
          </div>

          <h2 style={{ margin: '0 0 0.75rem' }}>Run History</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th>Discovered</th>
                  <th>Selected</th>
                  <th>Contacts found</th>
                  <th>Contacts pushed</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.run_date).toLocaleString()}</td>
                    <td>{r.batch_id ? <Link to={`/${tenantSlug}/batches/${r.batch_id}`}>#{r.batch_id}</Link> : '-'}</td>
                    <td>{r.status}</td>
                    <td>{r.companies_discovered}</td>
                    <td>{r.companies_selected}</td>
                    <td>{r.contacts_found}</td>
                    <td>{r.contacts_pushed}</td>
                    <td style={{ maxWidth: '320px' }}>
                      {r.error_message ? (
                        <div>
                          <div
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                              color: 'var(--danger)',
                              fontSize: '0.82rem',
                              fontWeight: '500'
                            }}
                            onClick={() => setExpandedRuns(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            title="Click to toggle full error message"
                          >
                            {r.error_message}
                          </div>
                          {expandedRuns[r.id] && (
                            <pre style={{
                              whiteSpace: 'pre-wrap',
                              marginTop: '0.5rem',
                              fontSize: '0.78rem',
                              maxHeight: '160px',
                              overflowY: 'auto',
                              background: 'var(--danger-soft)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--danger)',
                              padding: '0.6rem 0.8rem'
                            }}>
                              {r.error_message}
                            </pre>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {visibleRuns.length === 0 && (
                  <tr><td colSpan={8} className="empty-state">No autonomous runs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {runsTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="button" className="secondary btn-small" disabled={runsPage <= 1} onClick={() => setRunsPage(p => p - 1)}>&larr; Prev</button>
              <span className="hint">Page {runsPage} of {runsTotalPages} ({runs.length} runs)</span>
              <button type="button" className="secondary btn-small" disabled={runsPage >= runsTotalPages} onClick={() => setRunsPage(p => p + 1)}>Next &rarr;</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
