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
  const { tenantSlug } = useParams()
  if (tenantSlug === 'elephant-edge') return <ElephantEdgeBatchDetail />
  return <SynefiBatchDetail />
}

function SynefiBatchDetail() {
  const { batchId, tenantSlug } = useParams()
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
  ;(batch.companies || []).forEach(c => {
    if (c.tier) tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1
  })
  const chartData = Object.entries(tierCounts)
    .filter(([, count]) => count > 0)
    .map(([tier, count]) => ({ name: tier, value: count }))

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to batches</Link>
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

      <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({(batch.companies || []).length})</h2>
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
            {(batch.companies || []).map(c => (
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
            {(batch.companies || []).length === 0 && (
              <tr><td colSpan={6} className="empty-state">No companies yet - run Phase 1.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Elephant Edge has no Discovery/Qualification/Scoring yet (Phase 1 ICP unconfirmed) --
// batches here are hand-picked lists run through Import -> Decision Maker -> Outreach only.
// Rendered as a step flow (click a step, its panel opens below, edit/execute inline) rather
// than Synefi's flat "run a phase" button list, per how this was asked to look.
const EE_STEPS = [
  {
    key: 'import',
    label: 'Import Companies',
    isDone: (batch) => (batch.companies || []).length > 0,
  },
  {
    key: 'decision-maker',
    label: 'Decision Maker',
    isDone: (batch) => (batch.companies || []).some(c => c.contact_count > 0) || batch.current_phase === 'decision_maker_done' || batch.current_phase === 'outreach_done',
  },
  {
    key: 'outreach',
    label: 'Push to HeyReach',
    isDone: (batch) => batch.current_phase === 'outreach_done',
  },
]

function ElephantEdgeBatchDetail() {
  const { batchId, tenantSlug } = useParams()
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState(null)
  const [activeStep, setActiveStep] = useState(null)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [importText, setImportText] = useState('')

  const load = () => {
    client.get(`/batches/${batchId}`)
      .then(res => setBatch(res.data))
      .catch(err => setError(err.message))
  }

  useEffect(load, [batchId])

  if (error && !batch) return <div className="page"><p className="error">{error}</p></div>
  if (!batch) return <div className="page"><p className="hint">Loading...</p></div>

  const toggleStep = (key) => setActiveStep(activeStep === key ? null : key)

  const runImport = async () => {
    const companies = importText
      .split('\n')
      .map(line => line.split(',').map(s => s.trim()))
      .filter(([name, domain]) => name && domain)
      .map(([name, domain]) => ({ name, domain }))

    if (companies.length === 0) {
      setError('Enter at least one line as "Company Name, domain.com"')
      return
    }

    setRunning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await client.post(`/batches/${batchId}/companies/import`, companies)
      setLastResult({ step: 'Import Companies', data: res.data })
      setImportText('')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setRunning(false)
    }
  }

  const runPhase = async (key, label, confirmMessage) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setRunning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await client.post(`/batches/${batchId}/phases/${key}`)
      setLastResult({ step: label, data: res.data })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to batches</Link>
        <h1>{batch.name}</h1>
        <p className="meta">Phase: <strong>{batch.current_phase || 'created'}</strong> &middot; Status: {batch.status}</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <div className="step-flow">
          {EE_STEPS.map((step, i) => (
            <div key={step.key} className="step-flow-item">
              {i > 0 && <span className="step-flow-arrow">&rarr;</span>}
              <button
                type="button"
                className={`step-pill ${activeStep === step.key ? 'active' : ''} ${step.isDone(batch) ? 'done' : ''}`}
                onClick={() => toggleStep(step.key)}
              >
                <span className="step-pill-dot" />
                {step.label}
              </button>
            </div>
          ))}
        </div>

        {activeStep === 'import' && (
          <div className="step-panel">
            <p className="hint">Paste one company per line: <code>Company Name, domain.com</code></p>
            <textarea
              rows={8}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={'Acme Inc, acme.com\nWidgetCo, widgetco.io'}
              style={{ width: '100%' }}
            />
            <div className="inline-form">
              <button type="button" disabled={running} onClick={runImport}>
                {running ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}

        {activeStep === 'decision-maker' && (
          <div className="step-panel">
            <p className="hint">
              Searches for the primary decision-maker at each company: CEO &rarr; Founder &rarr; Co-Founder waterfall.
              Calls real Deepline search_contact API and spends real credits per contact found.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running || (batch.companies || []).length === 0}
                onClick={() => runPhase('decision-maker', 'Decision Maker', 'Run decision-maker search for all companies in this batch?\n\nThis spends real Deepline credits.\n\nProceed?')}
              >
                {running ? 'Running...' : 'Execute'}
              </button>
              {(batch.companies || []).length === 0 && <span className="hint">Import companies first.</span>}
            </div>
          </div>
        )}

        {activeStep === 'outreach' && (
          <div className="step-panel">
            <p className="hint">
              Pushes every contact found so far to the HeyReach campaign configured in Settings.
              Sends REAL LinkedIn connection requests. This cannot be undone.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running}
                onClick={() => runPhase('outreach', 'Push to HeyReach', 'Push all found contacts in this batch to HeyReach?\n\nThis sends REAL LinkedIn connection requests and cannot be undone.\n\nProceed?')}
              >
                {running ? 'Pushing...' : 'Execute'}
              </button>
            </div>
          </div>
        )}
      </div>

      {lastResult && (
        <div className="card">
          <h2>Last result: {lastResult.step}</h2>
          <pre>{JSON.stringify(lastResult.data, null, 2)}</pre>
        </div>
      )}

      <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({(batch.companies || []).length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {(batch.companies || []).map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.domain}</td>
                <td>{c.contact_count}</td>
              </tr>
            ))}
            {(batch.companies || []).length === 0 && (
              <tr><td colSpan={3} className="empty-state">No companies yet - use Import Companies above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
