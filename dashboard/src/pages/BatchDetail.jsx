import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import client from '../api/client'

const TIER_COLORS = { hot: '#e63946', warm: '#f4a261', cool: '#457b9d', excluded: '#adb5bd' }

// Cost/credit figures are for DB auditing only, never shown in the frontend -- strips any
// key that looks like a dollar or credit figure before a result gets rendered, recursively
// so it also catches nested objects (e.g. decision_maker_result.credits_spent_usd).
const COST_FIELD_PATTERN = /usd|credit|budget/i
function stripCostFields(value) {
  if (Array.isArray(value)) return value.map(stripCostFields)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (COST_FIELD_PATTERN.test(key)) continue
      out[key] = stripCostFields(val)
    }
    return out
  }
  return value
}

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
    label: 'Phase 5: Push to LinkedIn Automation',
    warning: 'Sends REAL LinkedIn connection requests via LinkedIn Automation. This cannot be undone.',
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
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to Hot Accounts</Link>
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
          <pre>{JSON.stringify(stripCostFields(lastResult.data), null, 2)}</pre>
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

// Elephant Edge's full pipeline: Discovery (Phase 3, ICP-driven) or manual Import both feed the
// same batch; either path continues through Buying Signal -> Scoring -> Decision Maker -> Outreach.
// Rendered as a step flow (click a step, its panel opens below, edit/execute inline) rather than
// Synefi's flat "run a phase" button list, per how this was asked to look.
const EE_STEPS = [
  {
    key: 'discovery',
    label: 'Discovery',
    isDone: (batch) => (batch.companies || []).length > 0,
  },
  {
    key: 'import',
    label: 'Import Companies',
    isDone: (batch) => (batch.companies || []).length > 0,
  },
  {
    key: 'buying-signal',
    label: 'Buying Signal',
    isDone: (batch) => batch.current_phase === 'buying_signal_done' || batch.current_phase === 'scoring_done' || batch.current_phase === 'decision_maker_done' || batch.current_phase === 'outreach_done',
  },
  {
    key: 'tech-stack',
    label: 'Tech Stack',
    isDone: (batch) => batch.current_phase === 'tech_stack_done' || batch.current_phase === 'scoring_done' || batch.current_phase === 'decision_maker_done' || batch.current_phase === 'outreach_done',
  },
  {
    key: 'scoring',
    label: 'Scoring',
    isDone: (batch) => (batch.companies || []).some(c => c.tier != null),
  },
  {
    key: 'decision-maker',
    label: 'Decision Maker',
    isDone: (batch) => (batch.companies || []).some(c => c.contact_count > 0) || batch.current_phase === 'decision_maker_done' || batch.current_phase === 'outreach_done',
  },
  {
    key: 'outreach',
    label: 'Push to LinkedIn Automation',
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
  const [discoveryTarget, setDiscoveryTarget] = useState(10)
  const [expandedCompanyId, setExpandedCompanyId] = useState(null)

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

  const runPhase = async (key, label, confirmMessage, body) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setRunning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await client.post(`/batches/${batchId}/phases/${key}`, body)
      setLastResult({ step: label, data: res.data })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setRunning(false)
    }
  }

  const retryCompany = (companyName, companyId) => runPhase(
    'decision-maker',
    'Decision Maker',
    `Retry decision-maker search for ${companyName}?`,
    { retry_company_ids: [companyId] },
  )

  const runDiscovery = async () => {
    setRunning(true)
    setError(null)
    setLastResult(null)
    try {
      const res = await client.post(`/batches/${batchId}/phases/discovery`, null, { params: { target: discoveryTarget } })
      setLastResult({ step: 'Discovery', data: res.data })
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
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to Hot Accounts</Link>
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

        {activeStep === 'discovery' && (
          <div className="step-panel">
            <p className="hint">
              Automatically finds companies matching the confirmed ICP (11-50 employees, $2.5M-$5M revenue, US).
            </p>
            <div className="inline-form">
              <label>Target companies</label>
              <input
                type="number"
                value={discoveryTarget}
                min={1}
                max={50}
                onChange={e => setDiscoveryTarget(Number(e.target.value))}
                style={{ width: '4.5rem' }}
              />
              <button type="button" disabled={running} onClick={runDiscovery}>
                {running ? 'Discovering...' : 'Execute'}
              </button>
            </div>
          </div>
        )}

        {activeStep === 'import' && (
          <div className="step-panel">
            <p className="hint">Or paste hand-picked companies, one per line: <code>Company Name, domain.com</code></p>
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

        {activeStep === 'buying-signal' && (
          <div className="step-panel">
            <p className="hint">
              Checks each company for a recent funding event, headcount growth, or an active Head of Sales/VP Sales job posting.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running || (batch.companies || []).length === 0}
                onClick={() => runPhase('buying-signal', 'Buying Signal', 'Check buying signals for all companies in this batch?')}
              >
                {running ? 'Checking...' : 'Execute'}
              </button>
              {(batch.companies || []).length === 0 && <span className="hint">Add companies first.</span>}
            </div>
          </div>
        )}

        {activeStep === 'tech-stack' && (
          <div className="step-panel">
            <p className="hint">
              Checks each company's detected tech stack for outbound/CRM tooling (Apollo, Clay, HubSpot, Outreach, etc.) and AI SDR tools.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running || (batch.companies || []).length === 0}
                onClick={() => runPhase('tech-stack', 'Tech Stack', 'Check tech stack for all companies in this batch?')}
              >
                {running ? 'Checking...' : 'Execute'}
              </button>
              {(batch.companies || []).length === 0 && <span className="hint">Add companies first.</span>}
            </div>
          </div>
        )}

        {activeStep === 'scoring' && (
          <div className="step-panel">
            <p className="hint">
              Ranks companies using the 5-category ICP Fit Score (Need, Ability to Pay, Outbound Maturity, Product Fit, Buying Intent). Run after Buying Signal, Tech Stack, and Decision Maker.
              Companies scoring below 70 (Excluded) never proceed to Decision Maker or Outreach -- they stay visible here so it's always clear why.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running || (batch.companies || []).length === 0}
                onClick={() => runPhase('scoring', 'Scoring', null)}
              >
                {running ? 'Scoring...' : 'Execute'}
              </button>
            </div>

            {(batch.companies || []).some(c => c.score_breakdown) && (
              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Need</th>
                      <th>Ability to Pay</th>
                      <th>Outbound Maturity</th>
                      <th>Product Fit</th>
                      <th>Buying Intent</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batch.companies || []).filter(c => c.score_breakdown).map(c => {
                      const b = c.score_breakdown
                      const qualified = c.tier !== 'excluded'
                      const proceeded = c.decision_maker_searched || c.contact_count > 0
                      return (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{b.need}/30</td>
                          <td>{b.ability_to_pay}/20</td>
                          <td>{b.outbound_maturity}/20</td>
                          <td>{b.product_fit}/20</td>
                          <td>{b.buying_intent}/10</td>
                          <td><strong>{b.total}/100</strong> <span className={`tier-badge tier-${c.tier}`}>{c.tier}</span></td>
                          <td>
                            {qualified
                              ? (proceeded
                                  ? <span style={{ color: '#2a9d8f' }}>&#10003; Qualified — moved to Decision Maker</span>
                                  : <span style={{ color: '#457b9d' }}>Qualified — awaiting Decision Maker</span>)
                              : <span style={{ color: '#888' }}>Excluded — stays here (below 70)</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeStep === 'decision-maker' && (
          <div className="step-panel">
            <p className="hint">
              Finds the primary decision-maker at each company (Founder/CEO, or a sales/GTM leader if no founder record exists).
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running || (batch.companies || []).length === 0}
                onClick={() => runPhase('decision-maker', 'Decision Maker', 'Run decision-maker search for all companies in this batch?')}
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
              Pushes every contact found so far to the LinkedIn Automation campaign configured in Settings.
              Sends a LinkedIn connection request to each contact. This cannot be undone.
            </p>
            <div className="inline-form">
              <button
                type="button"
                disabled={running}
                onClick={() => runPhase('outreach', 'Push to LinkedIn Automation', 'Push all found contacts in this batch to LinkedIn Automation?\n\nThis sends LinkedIn connection requests and cannot be undone.\n\nProceed?')}
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
          <pre>{JSON.stringify(stripCostFields(lastResult.data), null, 2)}</pre>
        </div>
      )}

      <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({(batch.companies || []).length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Tier</th>
              <th>Score</th>
              <th>Sales HC%</th>
              <th>Geo</th>
              <th>Industry</th>
              <th>Hiring Signal</th>
              <th>Outbound Tools</th>
              <th>Contacts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(batch.companies || []).map(c => (
              <>
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.domain}</td>
                  <td>{c.tier && <span className={`tier-badge tier-${c.tier}`}>{c.tier}</span>}</td>
                  <td>
                    {c.score_breakdown ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setExpandedCompanyId(expandedCompanyId === c.id ? null : c.id)}
                        title="Click to see the full 5-category breakdown"
                      >
                        {c.score ?? '-'} {expandedCompanyId === c.id ? '▾' : '▸'}
                      </button>
                    ) : (c.score ?? '-')}
                  </td>
                  <td>{c.sales_headcount_percent != null ? `${c.sales_headcount_percent.toFixed(1)}%` : '-'}</td>
                  <td>{c.geography_tier === 'tier_1' ? 'T1' : (c.geography_tier === 'tier_2' ? 'T2' : '-')}</td>
                  <td>{c.industry_classification || '-'}</td>
                  <td title={c.hiring_signal_reasoning || ''}>
                    {c.hiring_signal_role ? `${c.hiring_signal_role} (${c.hiring_signal_strength})` : '-'}
                  </td>
                  <td>{c.has_outbound_tooling ? 'Yes' : (c.has_outbound_tooling === false ? 'No' : '-')}{c.has_ai_sdr_tool ? ' + AI SDR' : ''}</td>
                  <td>{c.contact_count}</td>
                  <td>
                    {c.contact_count === 0 && c.decision_maker_searched && (
                      <button type="button" disabled={running} onClick={() => retryCompany(c.name, c.id)}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
                {expandedCompanyId === c.id && c.score_breakdown && (
                  <tr key={`${c.id}-breakdown`}>
                    <td colSpan={11} style={{ background: '#f8f9fa', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div><strong>Need:</strong> {c.score_breakdown.need}/30 <span className="hint">(hiring signal: {c.hiring_signal_role ? `${c.hiring_signal_strength} match on "${c.hiring_signal_role}"` : 'none found'})</span></div>
                        <div><strong>Ability to Pay:</strong> {c.score_breakdown.ability_to_pay}/20 <span className="hint">(revenue band + funding on record)</span></div>
                        <div><strong>Outbound Maturity:</strong> {c.score_breakdown.outbound_maturity}/20 <span className="hint">(existing tooling: {c.has_outbound_tooling ? 'yes' : 'no'}{c.has_ai_sdr_tool ? ', AI SDR tool detected' : ''})</span></div>
                        <div><strong>Product Fit:</strong> {c.score_breakdown.product_fit}/20 <span className="hint">(industry: {c.industry_classification || '-'}, geo: {c.geography_tier || '-'})</span></div>
                        <div><strong>Buying Intent:</strong> {c.score_breakdown.buying_intent}/10 <span className="hint">(JD product-fit matches: {(c.product_fit_jd_categories || []).length > 0 ? c.product_fit_jd_categories.join(', ') : 'none'})</span></div>
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <strong>Total: {c.score_breakdown.total}/100 — {c.score_breakdown.tier_label}</strong>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {(batch.companies || []).length === 0 && (
              <tr><td colSpan={11} className="empty-state">No companies yet - use Discovery or Import Companies above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
