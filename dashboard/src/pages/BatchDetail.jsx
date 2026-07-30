import { Fragment, useEffect, useState } from 'react'
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

// Renders a Phase 13 research object (company_research / contact_research / fit_analysis)
// as readable labeled bullets instead of raw JSON -- e.g. { value_props: [...] } becomes a
// "Value Props" heading with a bullet per item. Handles the shapes those three actually
// produce: strings, arrays of strings, and one level of nested object (icp_hypothesis).
function humanizeLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function ResearchSection({ data }) {
  if (!data || typeof data !== 'object') return <p className="hint">No data.</p>
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
  if (entries.length === 0) return <p className="hint">No data.</p>
  return (
    <div>
      {entries.map(([key, value]) => (
        <div key={key} style={{ marginBottom: '0.6rem' }}>
          <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.2rem' }}>{humanizeLabel(key)}</strong>
          {Array.isArray(value) ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
              {value.map((item, i) => <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>)}
            </ul>
          ) : typeof value === 'object' ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
              {Object.entries(value).filter(([, v]) => v).map(([k, v]) => <li key={k}>{humanizeLabel(k)}: {v}</li>)}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{value}</p>
          )}
        </div>
      ))}
    </div>
  )
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

const PAGE_SIZE = 50

function SynefiBatchDetail() {
  const { batchId, tenantSlug } = useParams()
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState(null)
  const [runningPhase, setRunningPhase] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [target, setTarget] = useState(5)
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  const load = (targetPage = page, fresh = false) => {
    client.get(`/batches/${batchId}`, { params: { page: targetPage, page_size: PAGE_SIZE, fresh } })
      .then(res => setBatch(res.data))
      .catch(err => setError(err.message))
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await client.get(`/batches/${batchId}`, { params: { page, page_size: PAGE_SIZE, fresh: true } }).then(res => setBatch(res.data))
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => load(page), [batchId, page])

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

  const tierCounts = batch.summary?.tier_counts || {}
  const chartData = Object.entries(tierCounts)
    .filter(([, count]) => count > 0)
    .map(([tier, count]) => ({ name: tier, value: count }))
  const totalCompanies = batch.total_companies ?? (batch.companies || []).length
  const totalPages = Math.max(1, Math.ceil(totalCompanies / PAGE_SIZE))

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to Hot Accounts</Link>
        <h1>{batch.name}</h1>
        <p className="meta">Phase: <strong>{batch.current_phase}</strong> &middot; Status: {batch.status}</p>
        <button type="button" className="secondary" disabled={refreshing} onClick={refresh}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
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

      <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({totalCompanies})</h2>
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
      {totalPages > 1 && (
        <div className="inline-form" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span className="hint">Page {page} of {totalPages}</span>
          <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}
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
    isDone: (batch) => (batch.total_companies ?? (batch.companies || []).length) > 0,
  },
  {
    key: 'import',
    label: 'Import Companies',
    isDone: (batch) => (batch.total_companies ?? (batch.companies || []).length) > 0,
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
    isDone: (batch) => (batch.summary?.scored_count ?? 0) > 0,
  },
  {
    key: 'decision-maker',
    label: 'Decision Maker',
    isDone: (batch) => (batch.summary?.contacts_count ?? 0) > 0 || batch.current_phase === 'decision_maker_done' || batch.current_phase === 'outreach_done',
  },
  {
    key: 'outreach',
    label: 'Push to LinkedIn Automation',
    isDone: (batch) => batch.current_phase === 'outreach_done',
  },
]

const EE_PAGE_SIZE = 50

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
  const [messageContactId, setMessageContactId] = useState(null)
  const [messageData, setMessageData] = useState({})
  const [generatingContactId, setGeneratingContactId] = useState(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [showDrawerDetails, setShowDrawerDetails] = useState(false)

  const toggleMessagePanel = async (contactId) => {
    setShowDrawerDetails(false)
    if (messageContactId === contactId) {
      setMessageContactId(null)
      return
    }
    setMessageContactId(contactId)
    if (!messageData[contactId]) {
      try {
        const res = await client.get(`/contacts/${contactId}/message`)
        setMessageData(prev => ({ ...prev, [contactId]: res.data }))
        setEditedMessage(res.data.generated_message || '')
      } catch (err) {
        setError(err.response?.data?.detail || err.message)
      }
    } else {
      setEditedMessage(messageData[contactId].generated_message || '')
    }
  }

  const generateMessage = async (contactId) => {
    setGeneratingContactId(contactId)
    setError(null)
    try {
      const res = await client.post(`/contacts/${contactId}/generate-message`)
      setMessageData(prev => ({ ...prev, [contactId]: res.data }))
      setEditedMessage(res.data.generated_message || '')
      setMessageContactId(contactId)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setGeneratingContactId(null)
    }
  }

  const saveMessageEdit = async (contactId, status) => {
    try {
      const res = await client.post(`/contacts/${contactId}/message/edit`, { generated_message: editedMessage, status })
      setMessageData(prev => ({ ...prev, [contactId]: { ...prev[contactId], generated_message: res.data.generated_message, status: res.data.status } }))
      load()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
  }

  const load = (targetPage = page, fresh = false) => {
    client.get(`/batches/${batchId}`, { params: { page: targetPage, page_size: EE_PAGE_SIZE, fresh } })
      .then(res => setBatch(res.data))
      .catch(err => setError(err.message))
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await client.get(`/batches/${batchId}`, { params: { page, page_size: EE_PAGE_SIZE, fresh: true } }).then(res => setBatch(res.data))
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => load(page), [batchId, page])

  if (error && !batch) return <div className="page"><p className="error">{error}</p></div>
  if (!batch) return <div className="page"><p className="hint">Loading...</p></div>

  const totalCompanies = batch.total_companies ?? (batch.companies || []).length
  const totalPages = Math.max(1, Math.ceil(totalCompanies / EE_PAGE_SIZE))

  const toggleStep = (key) => setActiveStep(activeStep === key ? null : key)

  const activeDrawerContact = messageContactId
    ? (batch.companies || []).flatMap(c => (c.contacts || []).map(ct => ({ ...ct, companyName: c.name })))
        .find(ct => ct.id === messageContactId)
    : null

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
    <div className="page page-wide">
      <div className="page-header">
        <Link to={`/${tenantSlug}`} className="breadcrumb">&larr; Back to Hot Accounts</Link>
        <h1>{batch.name}</h1>
        <p className="meta">Phase: <strong>{batch.current_phase || 'created'}</strong> &middot; Status: {batch.status}</p>
        <button type="button" className="secondary" disabled={refreshing} onClick={refresh}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
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
                disabled={running || totalCompanies === 0}
                onClick={() => runPhase('buying-signal', 'Buying Signal', 'Check buying signals for all companies in this batch?')}
              >
                {running ? 'Checking...' : 'Execute'}
              </button>
              {totalCompanies === 0 && <span className="hint">Add companies first.</span>}
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
                disabled={running || totalCompanies === 0}
                onClick={() => runPhase('tech-stack', 'Tech Stack', 'Check tech stack for all companies in this batch?')}
              >
                {running ? 'Checking...' : 'Execute'}
              </button>
              {totalCompanies === 0 && <span className="hint">Add companies first.</span>}
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
                disabled={running || totalCompanies === 0}
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
                disabled={running || totalCompanies === 0}
                onClick={() => runPhase('decision-maker', 'Decision Maker', 'Run decision-maker search for all companies in this batch?')}
              >
                {running ? 'Running...' : 'Execute'}
              </button>
              {totalCompanies === 0 && <span className="hint">Import companies first.</span>}
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

      <div className="batch-layout">
        <div className="batch-layout-main">
          <h2 style={{ margin: '0 0 0.75rem' }}>Companies ({totalCompanies})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Contact</th>
                  <th>Message</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>Sales HC%</th>
                  <th>Geo</th>
                  <th>Industry</th>
                  <th>Hiring Signal</th>
                  <th>Outbound Tools</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(batch.companies || []).map(c => (
                  <Fragment key={c.id}>
                    <tr>
                      <td>{c.name}</td>
                      <td>{c.domain}</td>
                      <td>
                        {(c.contacts || []).map(ct => (
                          <div key={ct.id} style={{ marginBottom: '0.25rem' }}>
                            {ct.first_name} {ct.last_name}
                          </div>
                        ))}
                      </td>
                      <td>
                        {(c.contacts || []).map(ct => (
                          <div key={ct.id} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {ct.message_status && <span className={`status-pill ${ct.message_status === 'approved' ? 'on' : 'warn'}`} style={{ fontSize: '0.7rem' }}>{ct.message_status}</span>}
                            <button type="button" className="btn-small btn-approve" onClick={() => toggleMessagePanel(ct.id)}>Approve</button>
                            <button type="button" className="btn-small btn-reject" onClick={() => toggleMessagePanel(ct.id)}>Reject</button>
                          </div>
                        ))}
                      </td>
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
                      <td>
                        {c.contact_count === 0 && c.decision_maker_searched && (
                          <button type="button" disabled={running} onClick={() => retryCompany(c.name, c.id)}>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedCompanyId === c.id && c.score_breakdown && (
                      <tr>
                        <td colSpan={12} style={{ background: '#f8f9fa', padding: '0.75rem 1rem' }}>
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
                  </Fragment>
                ))}
                {(batch.companies || []).length === 0 && (
                  <tr><td colSpan={12} className="empty-state">No companies yet - use Discovery or Import Companies above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="inline-form" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </button>
              <span className="hint">Page {page} of {totalPages}</span>
              <button type="button" className="secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>

        {messageContactId && (
          <div className="message-drawer">
            <div className="message-drawer-header">
              <div>
                <h3>{activeDrawerContact ? `${activeDrawerContact.first_name} ${activeDrawerContact.last_name}` : 'Message'}</h3>
                {activeDrawerContact && <p className="meta">{activeDrawerContact.title} {activeDrawerContact.companyName ? `@ ${activeDrawerContact.companyName}` : ''}</p>}
              </div>
              <button type="button" className="message-drawer-close" onClick={() => setMessageContactId(null)} aria-label="Close">&times;</button>
            </div>
            <div className="message-drawer-body">
              {!messageData[messageContactId] ? (
                <p className="hint">Loading...</p>
              ) : messageData[messageContactId].status === 'not_generated' ? (
                <button type="button" disabled={generatingContactId === messageContactId} onClick={() => generateMessage(messageContactId)}>
                  {generatingContactId === messageContactId ? 'Generating...' : 'Generate personalized message'}
                </button>
              ) : (
                <>
                  {messageData[messageContactId].error_message && (
                    <p className="error">Generation error: {messageData[messageContactId].error_message}</p>
                  )}
                  <label style={{ display: 'block', marginBottom: '0.3rem' }}>Generated message (editable)</label>
                  <textarea rows={8} value={editedMessage} onChange={e => setEditedMessage(e.target.value)} style={{ width: '100%' }} />
                  <div className="inline-form" style={{ marginTop: '0.6rem', marginBottom: '1rem' }}>
                    <button type="button" className="btn-small" onClick={() => saveMessageEdit(messageContactId, messageData[messageContactId].status)}>Save edit</button>
                    <button type="button" className="btn-small btn-approve" onClick={() => saveMessageEdit(messageContactId, 'approved')}>Approve</button>
                    <button type="button" className="btn-small btn-reject" onClick={() => saveMessageEdit(messageContactId, 'rejected')}>Reject</button>
                    <button type="button" className="btn-small secondary" disabled={generatingContactId === messageContactId} onClick={() => generateMessage(messageContactId)}>
                      {generatingContactId === messageContactId ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>
                  <button type="button" className="link-button" onClick={() => setShowDrawerDetails(v => !v)}>
                    {showDrawerDetails ? 'Hide details ▾' : 'View details ▸'}
                  </button>
                  {showDrawerDetails && (
                    <>
                      <div className="message-drawer-section" style={{ marginTop: '0.75rem' }}>
                        <strong>Company research</strong>
                        <ResearchSection data={messageData[messageContactId].company_research} />
                      </div>
                      <div className="message-drawer-section">
                        <strong>Contact research</strong>
                        <ResearchSection data={messageData[messageContactId].contact_research} />
                      </div>
                      <div className="message-drawer-section">
                        <strong>Fit analysis</strong>
                        <ResearchSection data={messageData[messageContactId].fit_analysis} />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
