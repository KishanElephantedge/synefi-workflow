import { useState } from 'react'
import './SelfServe.css'

// Public, unauthenticated page (app.elephantedge.ai/home) -- Majji shares this link directly
// with people he's showing the product to. It talks straight to the Elephant Edge backend's
// own public /self-serve/* routes (wildcard CORS, no session cookie, no X-Tenant-Id), not
// through the gateway proxy every other page in this app uses -- those routes are deliberately
// outside the gateway's auth layer. See app/routes/api.py's "Self-serve landing page" section.
const API_BASE = 'https://elephantedge-workflow-1-7k9d.onrender.com/api'
// TODO(majji): replace with the real booking link before sharing this page externally.
const BOOKING_URL = 'https://calendly.com/elephantedge/intro'

const STEP = { INPUT: 'input', CONFIRM: 'confirm', EMAIL: 'email', RESULTS: 'results' }

export default function SelfServe() {
  const [step, setStep] = useState(STEP.INPUT)
  const [source, setSource] = useState('website')

  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteBusy, setWebsiteBusy] = useState(false)
  const [websiteError, setWebsiteError] = useState(null)

  const [templateFile, setTemplateFile] = useState(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [templateError, setTemplateError] = useState(null)

  const [icp, setIcp] = useState(null)
  const [companySummary, setCompanySummary] = useState('')
  const [confidence, setConfidence] = useState('medium')
  const [evidence, setEvidence] = useState(null)

  const [email, setEmail] = useState('')
  const [discoverBusy, setDiscoverBusy] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  const [results, setResults] = useState(null)

  function applyInferredIcp(inferred) {
    setIcp({
      industries: inferred.industries || inferred.their_customer_industries || [],
      employee_min: inferred.employee_min ?? null,
      employee_max: inferred.employee_max ?? null,
      geographies: inferred.geographies || [],
    })
    setCompanySummary(inferred.company_summary || '')
    setConfidence((inferred.confidence || 'medium').toLowerCase())
    setEvidence(inferred.evidence || null)
    setStep(STEP.CONFIRM)
  }

  async function handleInferFromWebsite() {
    const url = websiteUrl.trim()
    setWebsiteError(null)
    if (!url) { setWebsiteError('Enter your website first.'); return }
    setWebsiteBusy(true)
    try {
      const res = await fetch(`${API_BASE}/self-serve/infer-icp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: url }),
      })
      const data = await res.json()
      if (!data.ok) {
        setWebsiteError((data.reason || "Couldn't read that site automatically.") + ' Try the template upload instead.')
        setSource('template')
        return
      }
      applyInferredIcp(data.inferred)
    } catch {
      setWebsiteError('Something went wrong reaching our server. Try again in a moment.')
    } finally {
      setWebsiteBusy(false)
    }
  }

  async function handleParseTemplate() {
    setTemplateError(null)
    if (!templateFile) { setTemplateError('Choose your filled-in template file first.'); return }
    setTemplateBusy(true)
    try {
      const form = new FormData()
      form.append('file', templateFile)
      const res = await fetch(`${API_BASE}/self-serve/template/parse`, { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) { setTemplateError(data.reason || "Couldn't read that file."); return }
      applyInferredIcp(data.icp)
    } catch {
      setTemplateError('Something went wrong reaching our server. Try again in a moment.')
    } finally {
      setTemplateBusy(false)
    }
  }

  function updateIcpField(field, value) {
    setIcp((prev) => ({ ...prev, [field]: value }))
  }

  async function handleDiscover() {
    setDiscoverError(null)
    if (!email.trim() || !email.includes('@')) { setDiscoverError('Enter a real email address.'); return }
    setDiscoverBusy(true)
    try {
      const res = await fetch(`${API_BASE}/self-serve/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), icp, source, website_url: websiteUrl || null }),
      })
      const data = await res.json()
      if (!data.ok) { setDiscoverError(data.reason || 'Something went wrong running your search.'); return }
      setResults(data)
      setStep(STEP.RESULTS)
    } catch {
      setDiscoverError('Something went wrong reaching our server. Try again in a moment.')
    } finally {
      setDiscoverBusy(false)
    }
  }

  return (
    <div className="self-serve">
      <div className="self-serve-wrap">
        <header className="self-serve-header">
          <h1>See who you could be reaching out to today</h1>
          <p>Give us your website — we'll figure out who your customers likely are and find you 10 real companies to reach out to, free.</p>
        </header>

        {step === STEP.INPUT && (
          <div className="self-serve-card">
            <div className="self-serve-step-label">Step 1 of 3</div>
            <div className="self-serve-toggle">
              <button type="button" className={source === 'website' ? 'active' : ''} onClick={() => setSource('website')}>
                Enter my website
              </button>
              <button type="button" className={source === 'template' ? 'active' : ''} onClick={() => setSource('template')}>
                Upload a filled-in template
              </button>
            </div>

            {source === 'website' ? (
              <div>
                <input
                  type="text"
                  placeholder="yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
                <button type="button" className="self-serve-btn full" disabled={websiteBusy} onClick={handleInferFromWebsite}>
                  {websiteBusy ? 'Analyzing…' : 'Analyze my website'}
                </button>
                <div className="self-serve-hint">We only read your homepage — nothing is stored until you confirm below.</div>
                {websiteError && <div className="self-serve-error">{websiteError}</div>}
              </div>
            ) : (
              <div>
                <p className="self-serve-hint">Download the template, fill in who you sell to, then upload it back.</p>
                <a className="self-serve-btn secondary full" href={`${API_BASE}/self-serve/template`}>
                  Download template (.csv)
                </a>
                <div style={{ height: 10 }} />
                <input type="file" accept=".csv" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
                <button type="button" className="self-serve-btn full" disabled={templateBusy} onClick={handleParseTemplate}>
                  {templateBusy ? 'Uploading…' : 'Upload filled-in template'}
                </button>
                {templateError && <div className="self-serve-error">{templateError}</div>}
              </div>
            )}
          </div>
        )}

        {step === STEP.CONFIRM && icp && (
          <div className="self-serve-card">
            <div className="self-serve-step-label">Step 2 of 3 — confirm who you sell to</div>
            <p className="self-serve-summary">{companySummary || "Here's what we inferred — edit anything that's off."}</p>
            <span className={`self-serve-confidence ${confidence}`}>{confidence.toUpperCase()} CONFIDENCE</span>

            <label className="self-serve-field-label">Industries you sell to</label>
            <input
              type="text"
              placeholder="e.g. credit unions, banks"
              value={(icp.industries || []).join(', ')}
              onChange={(e) => updateIcpField('industries', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            />
            <div className="self-serve-row">
              <div>
                <label className="self-serve-field-label">Min employees</label>
                <input
                  type="number"
                  placeholder="any"
                  value={icp.employee_min ?? ''}
                  onChange={(e) => updateIcpField('employee_min', e.target.value ? parseInt(e.target.value, 10) : null)}
                />
              </div>
              <div>
                <label className="self-serve-field-label">Max employees</label>
                <input
                  type="number"
                  placeholder="any"
                  value={icp.employee_max ?? ''}
                  onChange={(e) => updateIcpField('employee_max', e.target.value ? parseInt(e.target.value, 10) : null)}
                />
              </div>
            </div>
            <label className="self-serve-field-label">Geographies</label>
            <input
              type="text"
              placeholder="e.g. United States"
              value={(icp.geographies || []).join(', ')}
              onChange={(e) => updateIcpField('geographies', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            />

            {evidence && <div className="self-serve-evidence">“{evidence}”</div>}
            <button type="button" className="self-serve-btn full" style={{ marginTop: 14 }} onClick={() => setStep(STEP.EMAIL)}>
              This looks right — continue
            </button>
          </div>
        )}

        {step === STEP.EMAIL && (
          <div className="self-serve-card">
            <div className="self-serve-step-label">Step 3 of 3</div>
            <p className="self-serve-hint">Where should we send the full list and set up a call, if this looks good?</p>
            <input type="email" placeholder="you@yourcompany.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="button" className="self-serve-btn full" disabled={discoverBusy} onClick={handleDiscover}>
              {discoverBusy ? 'Searching…' : 'Find my 10 companies'}
            </button>
            {discoverError && <div className="self-serve-error">{discoverError}</div>}
          </div>
        )}

        {step === STEP.RESULTS && results && (
          <div className="self-serve-card">
            <div className="self-serve-step-label">Here's who you could reach out to</div>
            <p className="self-serve-hint">
              {results.companies?.length
                ? `Found ${results.companies.length} real compan${results.companies.length === 1 ? 'y' : 'ies'} that match.`
                : "We ran the search but didn't find a confident match yet — a call is the fastest next step."}
            </p>
            {(results.companies || []).map((c, i) => (
              <div className="self-serve-company" key={i}>
                <div className="self-serve-company-name">{c.name || 'Unknown company'}</div>
                <div className="self-serve-company-meta">
                  {[c.industry, c.employee_count ? `${c.employee_count} employees` : null, c.location].filter(Boolean).join(' · ')}
                </div>
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer">View on LinkedIn →</a>
                )}
              </div>
            ))}
            <div className="self-serve-cta">
              <a className="self-serve-btn" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
                Book a call to go deeper
              </a>
            </div>
          </div>
        )}

        <footer className="self-serve-footer">Elephant Edge · this ran a real, live search against your own criteria</footer>
      </div>
    </div>
  )
}
