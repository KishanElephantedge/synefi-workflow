import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import client from '../api/client'

const TIER_COLORS = { hot: '#e63946', warm: '#f4a261', cool: '#457b9d', excluded: '#adb5bd' }

const PHASES = [
  {
    key: 'signal-discovery',
    label: 'Phase 1: Signal Discovery',
    warning: 'Calls real Deepline APIs (CrustData, Bloomberry, PredictLeads) and spends real credits.',
    hasLimit: true,
  },
  {
    key: 'scoring',
    label: 'Phase 2: Scoring',
    warning: 'Local computation only, no external calls, no cost.',
    hasLimit: false,
  },
  {
    key: 'decision-maker',
    label: 'Phase 3: Decision-Maker ID',
    warning: 'Calls real Deepline search_contact API and spends real credits per contact found.',
    hasLimit: false,
  },
  {
    key: 'outreach',
    label: 'Phase 5: Push to HeyReach',
    warning: 'Sends REAL LinkedIn connection requests via HeyReach. This cannot be undone.',
    hasLimit: false,
  },
]

export default function BatchDetail() {
  const { batchId } = useParams()
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState(null)
  const [runningPhase, setRunningPhase] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [target, setTarget] = useState(5)

  const load = () => {
    client.get(`/batches/${batchId}`)
      .then(res => setBatch(res.data))
      .catch(err => setError(err.message))
  }

  useEffect(load, [batchId])

  const runPhase = async (phase) => {
    const confirmed = window.confirm(
      `Run "${phase.label}"?\n\n${phase.warning}\n\nProceed?`
    )
    if (!confirmed) return

    setRunningPhase(phase.key)
    setError(null)
    setLastResult(null)
    try {
      const params = phase.hasLimit ? { target } : {}
      const res = await client.post(`/batches/${batchId}/phases/${phase.key}`, null, { params })
      setLastResult({ phase: phase.label, data: res.data })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setRunningPhase(null)
    }
  }

  if (error && !batch) return <div className="page"><p className="error">{error}</p></div>
  if (!batch) return <div className="page"><p className="hint">Loading...</p></div>

  const tierCounts = { hot: 0, warm: 0, cool: 0, excluded: 0 }
  batch.companies.forEach(c => {
    if (c.tier) tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1
  })
  const chartData = Object.entries(tierCounts)
    .filter(([, count]) => count > 0)
    .map(([tier, count]) => ({ name: tier, value: count }))

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="breadcrumb">&larr; Back to batches</Link>
        <h1>{batch.name}</h1>
        <p className="meta">Phase: <strong>{batch.current_phase}</strong> &middot; Status: {batch.status}</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Run a phase</h2>
        {PHASES.map(phase => (
          <div key={phase.key} className="inline-form">
            <button
              type="button"
              disabled={runningPhase !== null}
              onClick={() => runPhase(phase)}
            >
              {runningPhase === phase.key ? 'Running...' : phase.label}
            </button>
            {phase.hasLimit && (
              <input
                type="number"
                value={target}
                min={1}
                max={20}
                onChange={e => setTarget(Number(e.target.value))}
                title="Target number of companies with a hiring signal to find (keeps paging until reached)"
                style={{ width: '4.5rem' }}
              />
            )}
            <span className="hint">{phase.warning}</span>
          </div>
        ))}
      </div>

      {lastResult && (
        <div className="card">
          <h2>Last result: {lastResult.phase}</h2>
          <pre>{JSON.stringify(lastResult.data, null, 2)}</pre>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="card">
          <h2>Tier breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} label>
                {chartData.map(entry => (
                  <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({batch.companies.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Signals</th>
              <th>Score</th>
              <th>Tier</th>
              <th>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {batch.companies.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.domain}</td>
                <td>{c.signal_count}</td>
                <td>{c.score ?? '-'}</td>
                <td>
                  {c.tier && <span className={`tier-badge tier-${c.tier}`}>{c.tier}</span>}
                </td>
                <td>{c.contact_count}</td>
              </tr>
            ))}
            {batch.companies.length === 0 && (
              <tr><td colSpan={6} className="empty-state">No companies yet - run Phase 1.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
