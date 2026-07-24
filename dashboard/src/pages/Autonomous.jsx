import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'

export default function Autonomous() {
  const { tenantSlug } = useParams()
  const [status, setStatus] = useState(null)
  const [runs, setRuns] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    client.get('/autonomous/status').then(res => setStatus(res.data)).catch(err => setError(err.message))
    client.get('/autonomous/runs').then(res => setRuns(res.data)).catch(err => setError(err.message))
    client.get('/autonomous/weekly-report').then(res => setReport(res.data)).catch(err => setError(err.message))
  }

  useEffect(load, [])

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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Autonomous System</h1>
        <p className="meta">Self-triggered daily discovery, scoring, decision-maker search, and HeyReach push.</p>
      </div>
      {error && <p className="error">{error}</p>}

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
              Scheduler ticks every 24h automatically; this cycle no-ops whenever the toggle is off,
              so "Pause" is a safe kill switch without restarting the server.
            </p>

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

      <h2 style={{ margin: '0 0 0.75rem' }}>Run history</h2>
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
              <th>Credits spent</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {(runs || []).map(r => (
              <tr key={r.id}>
                <td>{new Date(r.run_date).toLocaleString()}</td>
                <td>{r.batch_id ? <Link to={`/${tenantSlug}/batches/${r.batch_id}`}>#{r.batch_id}</Link> : '-'}</td>
                <td>{r.status}</td>
                <td>{r.companies_discovered}</td>
                <td>{r.companies_selected}</td>
                <td>{r.contacts_found}</td>
                <td>{r.contacts_pushed}</td>
                <td>
                  {r.credits_spent_usd != null ? `$${r.credits_spent_usd.toFixed(2)}` : '-'}
                  {r.budget_stopped_early && (
                    <span className="status-pill warn" style={{ marginLeft: '0.4rem' }} title="Budget cap hit -- decision-maker/outreach skipped">
                      cap hit
                    </span>
                  )}
                </td>
                <td>{r.error_message || '-'}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={9} className="empty-state">No autonomous runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
