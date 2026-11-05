import { useState, useEffect, useRef } from 'react'
import './SelfServe.css'

// Public, unauthenticated page (app.elephantedge.ai/home)
// Prospects enter their website to preview their ICP and matching enriched accounts.
const API_BASE = 'https://elephantedge-workflow-1-7k9d.onrender.com/api'
const BOOKING_URL = 'https://calendly.com/elephantedge/intro'

const STEP = {
  INPUT: 'input',
  CONFIRM: 'confirm',
  RESULTS: 'results',
  EMAIL: 'email',
}

const FAQS = [
  {
    q: 'How does Fractional Partner determine my ideal customer profile?',
    a: 'Our platform analyzes your website to understand your product, positioning, and case studies, automatically inferring the industries, company sizes, and geographies of the buyers you serve best.',
  },
  {
    q: 'How does account enrichment work?',
    a: 'Once your ICP is established, Fractional Partner cross-references live business records and verified company profiles to surface active organizations that fit your exact buyer parameters.',
  },
  {
    q: 'Can I export the accounts discovered here?',
    a: 'Yes, you can export your discovered accounts to a CSV file or share the permanent results link with your team.',
  },
  {
    q: 'What happens when I book a call or demo?',
    a: 'We show you how to connect your outreach channels (email and LinkedIn), automate verified decision-maker discovery, and run tailored outbound campaigns at scale.',
  },
  {
    q: 'Is my website data secure?',
    a: 'Yes. We only read publicly available content from your homepage. Nothing is stored without your confirmation.',
  },
]

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
  const [emailSaved, setEmailSaved] = useState(false)
  const [discoverBusy, setDiscoverBusy] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  const [results, setResults] = useState(null)

  // ICP tag inputs
  const [newIndustryTag, setNewIndustryTag] = useState('')
  const [newGeoTag, setNewGeoTag] = useState('')

  // UI state
  const [copiedLink, setCopiedLink] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const [initialLoading, setInitialLoading] = useState(false)

  const toolRef = useRef(null)

  // Re-fetch past result if ?token= is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setInitialLoading(true)
      fetch(`${API_BASE}/self-serve/results/${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setResults(data)
            if (data.website_url) setWebsiteUrl(data.website_url)
            if (data.icp) setIcp(data.icp)
            setStep(STEP.RESULTS)
          }
        })
        .catch(() => {})
        .finally(() => setInitialLoading(false))
    }
  }, [])

  function scrollToTool() {
    if (toolRef.current) {
      toolRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function cleanDomainInput(input) {
    let clean = input.trim()
    clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    clean = clean.split('/')[0].split('?')[0].split('#')[0]
    return clean
  }

  function applyInferredIcp(inferred) {
    setIcp({
      industries: inferred.industries || inferred.their_customer_industries || [],
      employee_min: inferred.employee_min ?? null,
      employee_max: inferred.employee_max ?? null,
      geographies: inferred.geographies || ['United States'],
    })
    setCompanySummary(inferred.company_summary || '')
    setConfidence((inferred.confidence || 'medium').toLowerCase())
    setEvidence(inferred.evidence || null)
    setStep(STEP.CONFIRM)
    scrollToTool()
  }

  async function handleInferFromWebsite() {
    const raw = websiteUrl.trim()
    setWebsiteError(null)
    if (!raw) {
      setWebsiteError('Please enter your website address (e.g. yourcompany.com).')
      return
    }

    const clean = cleanDomainInput(raw)
    setWebsiteUrl(clean)
    setWebsiteBusy(true)

    try {
      const res = await fetch(`${API_BASE}/self-serve/infer-icp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: clean }),
      })
      const data = await res.json()
      if (!data.ok) {
        setWebsiteError((data.reason || "Couldn't read that website automatically.") + ' You can upload a CSV template instead.')
        setSource('template')
        return
      }
      applyInferredIcp(data.inferred)
    } catch {
      setWebsiteError('Unable to reach the server. Please try again.')
    } finally {
      setWebsiteBusy(false)
    }
  }

  async function handleParseTemplate() {
    setTemplateError(null)
    if (!templateFile) {
      setTemplateError('Please choose your filled-in CSV template file first.')
      return
    }
    setTemplateBusy(true)
    try {
      const form = new FormData()
      form.append('file', templateFile)
      const res = await fetch(`${API_BASE}/self-serve/template/parse`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!data.ok) {
        setTemplateError(data.reason || "Couldn't parse that CSV file. Please verify its format.")
        return
      }
      applyInferredIcp(data.icp)
    } catch {
      setTemplateError('Unable to reach the server. Please try again.')
    } finally {
      setTemplateBusy(false)
    }
  }

  function updateIcpField(field, value) {
    setIcp((prev) => ({ ...prev, [field]: value }))
  }

  function handleAddIndustryTag() {
    const tag = newIndustryTag.trim()
    if (!tag) return
    const current = icp?.industries || []
    if (!current.includes(tag)) {
      updateIcpField('industries', [...current, tag])
    }
    setNewIndustryTag('')
  }

  function handleRemoveIndustryTag(tagToRemove) {
    const current = icp?.industries || []
    updateIcpField('industries', current.filter((t) => t !== tagToRemove))
  }

  function handleAddGeoTag() {
    const tag = newGeoTag.trim()
    if (!tag) return
    const current = icp?.geographies || []
    if (!current.includes(tag)) {
      updateIcpField('geographies', [...current, tag])
    }
    setNewGeoTag('')
  }

  function handleRemoveGeoTag(tagToRemove) {
    const current = icp?.geographies || []
    updateIcpField('geographies', current.filter((t) => t !== tagToRemove))
  }

  function handleSetHeadcountPreset(min, max) {
    updateIcpField('employee_min', min)
    updateIcpField('employee_max', max)
  }

  // Called when moving from Step 2 (Confirm ICP) -> Step 3 (Matching Accounts)
  async function handleConfirmAndFindAccounts() {
    setDiscoverError(null)
    setDiscoverBusy(true)
    try {
      const res = await fetch(`${API_BASE}/self-serve/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || 'preview@fractionalpartner.com',
          icp,
          source,
          website_url: websiteUrl ? cleanDomainInput(websiteUrl) : null,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setDiscoverError(data.reason || 'Something went wrong running your account search.')
        return
      }
      setResults(data)
      setStep(STEP.RESULTS)

      if (data.token) {
        const url = new URL(window.location.href)
        url.searchParams.set('token', data.token)
        window.history.replaceState({}, '', url.toString())
      }

      scrollToTool()
    } catch {
      setDiscoverError('Unable to connect to the server. Please try again.')
    } finally {
      setDiscoverBusy(false)
    }
  }

  // Called in Step 4 when visitor inputs their real work email to save the report & book
  // This is the visitor's OWN email for the outreach CC, collected only after they've already
  // seen their matching accounts and chosen to go further -- not a search input. It just
  // attaches to the already-completed submission (results.token); it never re-runs the company
  // search or touches any provider, so there's no second real spend per visitor.
  async function handleSaveEmail() {
    setDiscoverError(null)
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setDiscoverError('Please enter a valid work email.')
      return
    }
    if (!results?.token) {
      setDiscoverError('Something went wrong -- please start a new search.')
      return
    }
    setDiscoverBusy(true)
    try {
      const res = await fetch(`${API_BASE}/self-serve/submissions/${results.token}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()
      if (!data.ok) {
        setDiscoverError(data.reason || 'Something went wrong saving your email.')
        return
      }
      setEmailSaved(true)
    } catch {
      setDiscoverError('Unable to connect to the server. Please try again.')
    } finally {
      setDiscoverBusy(false)
    }
  }

  function handleDownloadCsv() {
    if (!results?.companies?.length) return
    const headers = ['Company Name', 'Industry', 'Employees', 'Location', 'LinkedIn URL']
    const rows = results.companies.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.industry || '').replace(/"/g, '""')}"`,
      `"${c.employee_count ?? ''}"`,
      `"${(c.location || '').replace(/"/g, '""')}"`,
      `"${(c.linkedin_url || '').replace(/"/g, '""')}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeDomain = (websiteUrl || 'target').replace(/[^a-zA-Z0-9_-]/g, '_')
    a.setAttribute('download', `${safeDomain}_matching_accounts.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleCopyShareLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  function handleReset() {
    setStep(STEP.INPUT)
    setResults(null)
    setIcp(null)
    setEmailSaved(false)
    setCompanySummary('')
    setEvidence(null)
    setWebsiteError(null)
    setDiscoverError(null)

    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
    scrollToTool()
  }

  return (
    <div className="self-serve-light">
      {/* Top Navbar */}
      <header className="ssl-nav">
        <div className="ssl-nav-container">
          <div className="ssl-brand">
            <div className="ssl-logo-wrap">
              <img src="/logo.png" alt="Fractional Partners" className="ssl-logo-img" />
            </div>
            <span className="ssl-brand-name">Fractional Partners</span>
          </div>

          <nav className="ssl-nav-links">
            <a
              href="#preview"
              className="ssl-nav-link"
              onClick={(e) => {
                e.preventDefault()
                scrollToTool()
              }}
            >
              Preview Accounts
            </a>
            <a href="#how-it-works" className="ssl-nav-link">
              How It Works
            </a>
            <a href="#platform" className="ssl-nav-link">
              Platform
            </a>
            <a href="#faq" className="ssl-nav-link">
              FAQ
            </a>
          </nav>

          <div className="ssl-nav-actions">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ssl-btn-ghost"
            >
              Sign In
            </a>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ssl-btn-primary ssl-btn-sm"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="ssl-main">
        {/* Hero Section */}
        <section className="ssl-hero">
          <div className="ssl-badge">
            <span className="ssl-badge-dot" />
            <span>Fractional Partner · B2B Account Discovery & Outreach</span>
          </div>

          <h1 className="ssl-hero-title">
            See who you could be reaching out to today
          </h1>

          <p className="ssl-hero-subtitle">
            Enter your company website. Fractional Partner identifies who buys from you and enriches target accounts
            matching your criteria, so you can see real pipeline before setting up outreach campaigns.
          </p>
        </section>

        {/* Interactive Experience Studio Card */}
        <section className="ssl-studio-section" ref={toolRef} id="preview">
          <div className="ssl-card">
            {/* Stepper Header: 1. Enter Website, 2. Confirm ICP, 3. Matching Accounts, 4. Work Email */}
            <div className="ssl-stepper">
              <div className={`ssl-step ${step === STEP.INPUT ? 'active' : 'done'}`}>
                <div className="ssl-step-num">{step === STEP.INPUT ? '1' : '✓'}</div>
                <span className="ssl-step-label">1. Enter Website</span>
              </div>
              <div className="ssl-step-line" />
              <div
                className={`ssl-step ${
                  step === STEP.CONFIRM
                    ? 'active'
                    : step === STEP.RESULTS || step === STEP.EMAIL
                    ? 'done'
                    : ''
                }`}
              >
                <div className="ssl-step-num">
                  {step === STEP.RESULTS || step === STEP.EMAIL ? '✓' : '2'}
                </div>
                <span className="ssl-step-label">2. Confirm ICP</span>
              </div>
              <div className="ssl-step-line" />
              <div
                className={`ssl-step ${
                  step === STEP.RESULTS ? 'active' : step === STEP.EMAIL ? 'done' : ''
                }`}
              >
                <div className="ssl-step-num">{step === STEP.EMAIL ? '✓' : '3'}</div>
                <span className="ssl-step-label">3. Matching Accounts</span>
              </div>
              <div className="ssl-step-line" />
              <div className={`ssl-step ${step === STEP.EMAIL ? 'active' : ''}`}>
                <div className="ssl-step-num">4</div>
                <span className="ssl-step-label">4. Work Email</span>
              </div>
            </div>

            {/* Initial Past Result Loading */}
            {initialLoading && (
              <div className="ssl-loading-box">
                <div className="ssl-spinner" />
                <p>Loading your saved accounts…</p>
              </div>
            )}

            {/* STEP 1: WEBSITE INPUT */}
            {!initialLoading && step === STEP.INPUT && (
              <div className="ssl-step-view">
                <div className="ssl-view-header">
                  <div>
                    <h2 className="ssl-view-title">Enter your company website</h2>
                    <p className="ssl-view-desc">
                      We'll inspect your homepage positioning to determine your target customer industries, headcount range, and geographies.
                    </p>
                  </div>

                  <div className="ssl-toggle-group">
                    <button
                      type="button"
                      className={`ssl-toggle-btn ${source === 'website' ? 'active' : ''}`}
                      onClick={() => setSource('website')}
                    >
                      Website
                    </button>
                    <button
                      type="button"
                      className={`ssl-toggle-btn ${source === 'template' ? 'active' : ''}`}
                      onClick={() => setSource('template')}
                    >
                      CSV Template
                    </button>
                  </div>
                </div>

                {source === 'website' ? (
                  <div className="ssl-form-area">
                    <div className="ssl-input-row">
                      <div className="ssl-input-field">
                        <span className="ssl-input-addon">https://</span>
                        <input
                          type="text"
                          className="ssl-input"
                          placeholder="yourcompany.com"
                          value={websiteUrl}
                          onChange={(e) => {
                            setWebsiteUrl(e.target.value)
                            if (websiteError) setWebsiteError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInferFromWebsite()
                          }}
                          disabled={websiteBusy}
                        />
                      </div>
                      <button
                        type="button"
                        className="ssl-btn-primary ssl-btn-submit"
                        disabled={websiteBusy || !websiteUrl.trim()}
                        onClick={handleInferFromWebsite}
                      >
                        {websiteBusy ? 'Analyzing website…' : 'Analyze Website'}
                      </button>
                    </div>

                    {websiteBusy && (
                      <div className="ssl-progress-notice">
                        <div className="ssl-spinner" />
                        <span>Reading your homepage and synthesizing customer profile…</span>
                      </div>
                    )}

                    {websiteError && (
                      <div className="ssl-error-banner">
                        <span>{websiteError}</span>
                      </div>
                    )}

                    <p className="ssl-hint-text">
                      We only read your publicly available homepage. Nothing is stored until you confirm in the next step.
                    </p>
                  </div>
                ) : (
                  <div className="ssl-template-area">
                    <div className="ssl-template-download-card">
                      <div>
                        <div className="ssl-card-heading">Download CSV Template</div>
                        <div className="ssl-card-caption">
                          Use our simple CSV format to define your target industries, size, and geographies.
                        </div>
                      </div>
                      <a
                        className="ssl-btn-outline"
                        href={`${API_BASE}/self-serve/template`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download Template (.csv)
                      </a>
                    </div>

                    <div className="ssl-file-picker">
                      <input
                        type="file"
                        id="csv-file-input"
                        accept=".csv"
                        className="ssl-hidden-file"
                        onChange={(e) => {
                          setTemplateFile(e.target.files?.[0] || null)
                          setTemplateError(null)
                        }}
                      />
                      <label htmlFor="csv-file-input" className="ssl-file-label">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>
                          {templateFile ? (
                            <strong>Selected: {templateFile.name}</strong>
                          ) : (
                            'Click to select your completed CSV file'
                          )}
                        </span>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="ssl-btn-primary ssl-btn-full"
                      disabled={templateBusy || !templateFile}
                      onClick={handleParseTemplate}
                    >
                      {templateBusy ? 'Parsing file…' : 'Upload & Review ICP'}
                    </button>

                    {templateError && (
                      <div className="ssl-error-banner">
                        <span>{templateError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: CONFIRM & EDIT ICP */}
            {step === STEP.CONFIRM && icp && (
              <div className="ssl-step-view">
                <div className="ssl-sub-nav">
                  <button type="button" className="ssl-btn-back" onClick={() => setStep(STEP.INPUT)}>
                    ← Change website
                  </button>
                  <span className={`ssl-confidence-badge ${confidence}`}>
                    {confidence.toUpperCase()} CONFIDENCE
                  </span>
                </div>

                <div className="ssl-summary-box">
                  <div className="ssl-summary-title">Inferred Profile Summary</div>
                  <p className="ssl-summary-text">
                    {companySummary || "Here is what we inferred from your website, edit any criteria below that isn't quite right."}
                  </p>
                </div>

                <div className="ssl-form-grid">
                  {/* Industries */}
                  <div className="ssl-field-block ssl-field-wide">
                    <label className="ssl-label">Industries you sell to</label>
                    <div className="ssl-tag-list">
                      {(icp.industries || []).map((ind) => (
                        <span key={ind} className="ssl-tag">
                          <span>{ind}</span>
                          <button
                            type="button"
                            className="ssl-tag-del"
                            onClick={() => handleRemoveIndustryTag(ind)}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <div className="ssl-tag-input-wrap">
                        <input
                          type="text"
                          className="ssl-tag-input"
                          placeholder="Add industry (press Enter)..."
                          value={newIndustryTag}
                          onChange={(e) => setNewIndustryTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault()
                              handleAddIndustryTag()
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="ssl-tag-add-btn"
                          onClick={handleAddIndustryTag}
                          disabled={!newIndustryTag.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Employee Range */}
                  <div className="ssl-field-block">
                    <label className="ssl-label">Company Size (Employees)</label>
                    <div className="ssl-range-row">
                      <div className="ssl-range-col">
                        <span className="ssl-range-hint">Min</span>
                        <input
                          type="number"
                          className="ssl-input"
                          placeholder="any"
                          value={icp.employee_min ?? ''}
                          onChange={(e) =>
                            updateIcpField('employee_min', e.target.value ? parseInt(e.target.value, 10) : null)
                          }
                        />
                      </div>
                      <span className="ssl-range-sep">to</span>
                      <div className="ssl-range-col">
                        <span className="ssl-range-hint">Max</span>
                        <input
                          type="number"
                          className="ssl-input"
                          placeholder="any"
                          value={icp.employee_max ?? ''}
                          onChange={(e) =>
                            updateIcpField('employee_max', e.target.value ? parseInt(e.target.value, 10) : null)
                          }
                        />
                      </div>
                    </div>
                    <div className="ssl-presets-row">
                      <span className="ssl-presets-text">Presets:</span>
                      <button type="button" className="ssl-preset-chip" onClick={() => handleSetHeadcountPreset(10, 50)}>
                        10-50
                      </button>
                      <button type="button" className="ssl-preset-chip" onClick={() => handleSetHeadcountPreset(50, 250)}>
                        50-250
                      </button>
                      <button type="button" className="ssl-preset-chip" onClick={() => handleSetHeadcountPreset(250, 1000)}>
                        250-1,000
                      </button>
                      <button type="button" className="ssl-preset-chip" onClick={() => handleSetHeadcountPreset(1000, 10000)}>
                        1,000+
                      </button>
                    </div>
                  </div>

                  {/* Geographies */}
                  <div className="ssl-field-block">
                    <label className="ssl-label">Target Geographies</label>
                    <div className="ssl-tag-list">
                      {(icp.geographies || []).map((geo) => (
                        <span key={geo} className="ssl-tag ssl-tag-geo">
                          <span>{geo}</span>
                          <button
                            type="button"
                            className="ssl-tag-del"
                            onClick={() => handleRemoveGeoTag(geo)}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <div className="ssl-tag-input-wrap">
                        <input
                          type="text"
                          className="ssl-tag-input"
                          placeholder="Add country/region..."
                          value={newGeoTag}
                          onChange={(e) => setNewGeoTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault()
                              handleAddGeoTag()
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="ssl-tag-add-btn"
                          onClick={handleAddGeoTag}
                          disabled={!newGeoTag.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {discoverBusy && (
                  <div className="ssl-progress-notice" style={{ marginBottom: 16 }}>
                    <div className="ssl-spinner" />
                    <span>Enriching target accounts matching your criteria…</span>
                  </div>
                )}

                {discoverError && (
                  <div className="ssl-error-banner" style={{ marginBottom: 16 }}>
                    <span>{discoverError}</span>
                  </div>
                )}

                <div className="ssl-action-row">
                  <button
                    type="button"
                    className="ssl-btn-primary ssl-btn-lg"
                    disabled={discoverBusy}
                    onClick={handleConfirmAndFindAccounts}
                  >
                    {discoverBusy ? 'Finding matching accounts…' : 'Confirm & View Matching Accounts →'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: MATCHING ACCOUNTS RESULTS */}
            {step === STEP.RESULTS && results && (
              <div className="ssl-step-view">
                <div className="ssl-results-header">
                  <div>
                    <div className="ssl-results-badge">Enrichment Complete</div>
                    <h2 className="ssl-view-title">Accounts matching your criteria</h2>
                    <p className="ssl-view-desc">
                      {results.companies?.length
                        ? `Found ${results.companies.length} verified companies matching your ideal customer profile.`
                        : 'No direct matches found for this specific criteria.'}
                    </p>
                  </div>

                  <div className="ssl-results-actions">
                    <button type="button" className="ssl-btn-outline" onClick={handleDownloadCsv}>
                      Export CSV
                    </button>
                    <button type="button" className="ssl-btn-outline" onClick={handleCopyShareLink}>
                      {copiedLink ? 'Link Copied!' : 'Share Link'}
                    </button>
                    <button
                      type="button"
                      className="ssl-btn-primary"
                      onClick={() => {
                        setStep(STEP.EMAIL)
                        scrollToTool()
                      }}
                    >
                      Receive Full Report →
                    </button>
                    <button type="button" className="ssl-btn-ghost" onClick={handleReset}>
                      New Search
                    </button>
                  </div>
                </div>

                {/* Company Cards List */}
                <div className="ssl-accounts-list">
                  {(results.companies || []).map((company, index) => (
                    <div className="ssl-account-card" key={index}>
                      <div className="ssl-account-main">
                        <div className="ssl-account-avatar">
                          {(company.name || 'Co')
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="ssl-account-name-row">
                            <span className="ssl-account-name">{company.name || 'Target Account'}</span>
                            <span className="ssl-account-pill">Verified Account</span>
                          </div>
                          <div className="ssl-account-meta">
                            {[
                              company.industry,
                              company.employee_count ? `${company.employee_count.toLocaleString()} employees` : null,
                              company.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="ssl-account-action">
                        {company.linkedin_url && (
                          <a
                            href={company.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ssl-linkedin-btn"
                          >
                            <span>View on LinkedIn</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Next Step Banner leading to Step 4 or Booking */}
                <div className="ssl-cta-banner">
                  <div className="ssl-cta-banner-content">
                    <h3 className="ssl-cta-banner-title">
                      Ready to launch outreach to accounts like these?
                    </h3>
                    <p className="ssl-cta-banner-desc">
                      Fractional Partner enriches verified decision-makers, crafts personalized messaging based on real-time buying signals, and runs multi-channel outreach on your behalf.
                    </p>

                    <div className="ssl-cta-banner-actions">
                      <button
                        type="button"
                        className="ssl-btn-primary ssl-btn-lg"
                        onClick={() => {
                          setStep(STEP.EMAIL)
                          scrollToTool()
                        }}
                      >
                        Enter Work Email to Save Report →
                      </button>
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ssl-btn-outline ssl-btn-lg"
                      >
                        Book a Demo with Our Team
                      </a>
                    </div>

                    <div className="ssl-cta-meta">
                      <span>15-minute live walkthrough with the founders, we will show you full pipeline automation</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: WORK EMAIL & FINAL CONFIRMATION */}
            {step === STEP.EMAIL && (
              <div className="ssl-step-view">
                <div className="ssl-sub-nav">
                  <button type="button" className="ssl-btn-back" onClick={() => setStep(STEP.RESULTS)}>
                    ← Back to Accounts
                  </button>
                </div>

                <div className="ssl-email-centered">
                  <h2 className="ssl-view-title">Where should we deliver your account report?</h2>
                  <p className="ssl-view-desc">
                    Enter your work email to receive your verified matching accounts and permanent link.
                  </p>

                  {emailSaved ? (
                    <div className="ssl-saved-banner">
                      <div className="ssl-saved-icon">✓</div>
                      <div>
                        <strong>Account report sent!</strong>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                          Your discovered accounts have been associated with {email}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="ssl-email-input-box">
                      <input
                        type="email"
                        className="ssl-input ssl-input-lg"
                        placeholder="you@yourcompany.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (discoverError) setDiscoverError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEmail()
                        }}
                        disabled={discoverBusy}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="ssl-btn-primary ssl-btn-lg ssl-btn-submit"
                        disabled={discoverBusy || !email.trim()}
                        onClick={handleSaveEmail}
                      >
                        {discoverBusy ? 'Saving…' : 'Save & Send Report'}
                      </button>
                    </div>
                  )}

                  {discoverBusy && (
                    <div className="ssl-progress-notice" style={{ marginTop: 20 }}>
                      <div className="ssl-spinner" />
                      <span>Saving your preferences…</span>
                    </div>
                  )}

                  {discoverError && (
                    <div className="ssl-error-banner" style={{ marginTop: 16 }}>
                      <span>{discoverError}</span>
                    </div>
                  )}

                  <div className="ssl-booking-next-box">
                    <h3 className="ssl-booking-next-title">Next Step: Schedule Your Walkthrough</h3>
                    <p className="ssl-booking-next-desc">
                      Let's review these accounts together and show you how Fractional Partner automates decision-maker outreach.
                    </p>
                    <div className="ssl-booking-next-actions">
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ssl-btn-primary ssl-btn-lg"
                      >
                        Book a Demo on Calendly
                      </a>
                      <button type="button" className="ssl-btn-outline" onClick={handleDownloadCsv}>
                        Download Discovered Accounts (.csv)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="ssl-section" id="how-it-works">
          <div className="ssl-section-header">
            <span className="ssl-eyebrow">How It Works</span>
            <h2 className="ssl-section-heading">Autonomous Account Discovery & Outreach</h2>
            <p className="ssl-section-sub">
              Fractional Partner removes the manual friction of building prospect lists and managing outbound campaigns.
            </p>
          </div>

          <div className="ssl-grid-3">
            <div className="ssl-feature-card">
              <div className="ssl-feature-icon">1</div>
              <h3 className="ssl-feature-title">Automatic ICP Synthesis</h3>
              <p className="ssl-feature-desc">
                We analyze your website, customer stories, and positioning to automatically construct a precise profile of who actually buys from you.
              </p>
            </div>

            <div className="ssl-feature-card">
              <div className="ssl-feature-icon">2</div>
              <h3 className="ssl-feature-title">Live Account Enrichment</h3>
              <p className="ssl-feature-desc">
                Our platform continuously scans verified business records and buying signals to identify companies actively matching your criteria.
              </p>
            </div>

            <div className="ssl-feature-card">
              <div className="ssl-feature-icon">3</div>
              <h3 className="ssl-feature-title">Autonomous Execution</h3>
              <p className="ssl-feature-desc">
                Fractional Partner identifies decision-makers, crafts relevant contextual messages, and coordinates outreach across email and LinkedIn.
              </p>
            </div>
          </div>
        </section>

        {/* PLATFORM VALUE PROPOSITION SECTION */}
        <section className="ssl-section" id="platform">
          <div className="ssl-section-header">
            <span className="ssl-eyebrow">Platform Highlights</span>
            <h2 className="ssl-section-heading">Built for High-Growth B2B Teams</h2>
            <p className="ssl-section-sub">
              Stop spending hours on manual database filters. Let autonomous intelligence drive your pipeline.
            </p>
          </div>

          <div className="ssl-highlights-list">
            <div className="ssl-highlight-row">
              <div className="ssl-highlight-bullet">01</div>
              <div className="ssl-highlight-info">
                <h4 className="ssl-highlight-title">No Stale Contact Lists</h4>
                <p className="ssl-highlight-desc">
                  Traditional databases rely on outdated scrapes with high bounce rates. Fractional Partner matches against verified live entities and active hiring signals.
                </p>
              </div>
            </div>

            <div className="ssl-highlight-row">
              <div className="ssl-highlight-bullet">02</div>
              <div className="ssl-highlight-info">
                <h4 className="ssl-highlight-title">Zero Manual List Building</h4>
                <p className="ssl-highlight-desc">
                  Forget complex boolean queries and spreadsheet exports. Enter your criteria once, and our engine automatically surfaces relevant accounts.
                </p>
              </div>
            </div>

            <div className="ssl-highlight-row">
              <div className="ssl-highlight-bullet">03</div>
              <div className="ssl-highlight-info">
                <h4 className="ssl-highlight-title">Contextual Outreach Signals</h4>
                <p className="ssl-highlight-desc">
                  Reach out when companies are actually in-market based on recent funding, executive moves, and active hiring announcements.
                </p>
              </div>
            </div>

            <div className="ssl-highlight-row">
              <div className="ssl-highlight-bullet">04</div>
              <div className="ssl-highlight-info">
                <h4 className="ssl-highlight-title">Turnkey Setup</h4>
                <p className="ssl-highlight-desc">
                  Book a brief call with our team. We'll walk through your account list and configure your autonomous outbound workflows in minutes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION (2-COLUMN LAYOUT) */}
        <section className="ssl-section" id="faq">
          <div className="ssl-faq-layout">
            {/* Left Column */}
            <div className="ssl-faq-sidebar">
              <span className="ssl-eyebrow">FAQ</span>
              <h2 className="ssl-section-heading" style={{ textAlign: 'left' }}>
                Frequently Asked Questions
              </h2>
              <p className="ssl-section-sub" style={{ textAlign: 'left' }}>
                Have questions about how Fractional Partner discovers accounts and launches outreach? Here are quick answers.
              </p>
              <div style={{ marginTop: 24 }}>
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ssl-btn-primary"
                >
                  Book a Demo Call
                </a>
              </div>
            </div>

            {/* Right Column: Accordion Points */}
            <div className="ssl-faq-accordion">
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div className={`ssl-faq-row ${isOpen ? 'open' : ''}`} key={index}>
                    <button
                      type="button"
                      className="ssl-faq-btn"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    >
                      <span>{faq.q}</span>
                      <span className="ssl-faq-toggle">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="ssl-faq-body">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="ssl-bottom-callout">
          <div className="ssl-bottom-card">
            <h2 className="ssl-bottom-heading">Ready to see Fractional Partner on your accounts?</h2>
            <p className="ssl-bottom-desc">
              Schedule a 15-minute product walkthrough. We'll review your market criteria together and show you how autonomous outreach works in practice.
            </p>
            <div className="ssl-bottom-btns">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ssl-btn-primary ssl-btn-lg"
              >
                Book a Demo
              </a>
              <a
                href="#preview"
                className="ssl-btn-outline ssl-btn-lg"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToTool()
                }}
              >
                Preview Your Accounts
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="ssl-footer">
        <div className="ssl-footer-container">
          <div className="ssl-footer-brand">
            <div className="ssl-footer-logo-row">
              <img src="/logo.png" alt="Fractional Partners" className="ssl-footer-logo" />
              <span className="ssl-footer-title">Fractional Partners</span>
            </div>
            <p className="ssl-footer-sub">Autonomous Account Discovery & Sales Execution</p>
          </div>

          <div className="ssl-footer-nav">
            <a
              href="#preview"
              className="ssl-footer-nav-link"
              onClick={(e) => {
                e.preventDefault()
                scrollToTool()
              }}
            >
              Preview Tool
            </a>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ssl-footer-nav-link"
            >
              Platform Login
            </a>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ssl-footer-nav-link"
            >
              Book a Demo
            </a>
          </div>
        </div>
        <div className="ssl-footer-bottom">
          <span>© {new Date().getFullYear()} Fractional Partners. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
