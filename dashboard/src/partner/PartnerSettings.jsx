import { useEffect, useRef, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerIcp, savePartnerIcp, parsePartnerIcp, updateMyProfile, formatApiError } from '../v2/api.js'

function parsedToForm(parsed) {
  return icpToForm(parsed)
}

function icpToForm(icp) {
  return {
    industries: (icp?.industries || []).join(', '),
    geographies: (icp?.geographies || []).join(', '),
    revenue_min_usd: icp?.revenue_min_usd ?? '',
    revenue_max_usd: icp?.revenue_max_usd ?? '',
    employee_min: icp?.employee_min ?? '',
    employee_max: icp?.employee_max ?? '',
    sales_team_size_min: icp?.sales_team_size_min ?? '',
    sales_team_size_max: icp?.sales_team_size_max ?? '',
    decision_maker_titles: (icp?.decision_maker_titles || []).join(', '),
    notes: icp?.notes ?? '',
  }
}

export default function PartnerSettings({ adminMode = false }) {
  const { user } = useTenant()

  return (
    <div className="partnerSettingsExecutivePage">
      {/* Header */}
      <div className="partnerSettingsHeader">
        <div className="partnerSettingsHeaderInfo">
          <h1>Settings</h1>
          <p>Manage your account profile and Ideal Customer Profile (ICP) criteria used for account discovery.</p>
        </div>
      </div>

      {adminMode && (
        <div className="partnerSettingsAdminNotice">
          <span className="partnerSettingsAdminDot" />
          <span>Viewing as Admin: Profile editing is reserved for the partner themselves. ICP configuration is active below.</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="partnerSettingsGrid">
        {!adminMode && <ProfileCard user={user} />}
        <IcpCard />
      </div>
    </div>
  )
}

function ProfileCard({ user }) {
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateMyProfile({ name })
      setSaved(true)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="partnerSettingsPanel">
      <div className="partnerSettingsPanelHead">
        <div>
          <h2 className="partnerSettingsPanelTitle">Profile Details</h2>
          <p className="partnerSettingsPanelSubtitle">Your personal partner identity across the workspace.</p>
        </div>
      </div>

      <div className="partnerSettingsFieldsGrid">
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Full Name</label>
          <input
            className="partnerSearchInput"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false) }}
          />
        </div>
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Email Address</label>
          <div className="partnerReadonlyValue">{user?.email}</div>
        </div>
      </div>

      {error && <div className="partnerFormError" style={{ marginTop: 12 }}>{error}</div>}

      <div className="partnerFormActions" style={{ marginTop: 16 }}>
        <button className="partnerPrimaryBtn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
        {saved && <span className="partnerSavedNote">✓ Changes saved successfully</span>}
      </div>
    </div>
  )
}

function IcpCard() {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [describeText, setDescribeText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [applied, setApplied] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getPartnerIcp()
      .then((icp) => setForm(icpToForm(icp)))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setSaved(false) }

  const onFileChosen = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDescribeText((t) => (t ? t + '\n\n' : '') + String(reader.result || ''))
    reader.readAsText(file)
    e.target.value = ''
  }

  const parseDescription = async () => {
    if (!describeText.trim()) return
    setParsing(true)
    setParseError(null)
    setApplied(false)
    try {
      const parsed = await parsePartnerIcp(describeText)
      setForm(parsedToForm(parsed))
      setApplied(true)
      setSaved(false)
    } catch (err) {
      setParseError(formatApiError(err))
    } finally {
      setParsing(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await savePartnerIcp({
        industries: form.industries.split(',').map((s) => s.trim()).filter(Boolean),
        geographies: form.geographies.split(',').map((s) => s.trim()).filter(Boolean),
        revenue_min_usd: form.revenue_min_usd ? Number(form.revenue_min_usd) : null,
        revenue_max_usd: form.revenue_max_usd ? Number(form.revenue_max_usd) : null,
        employee_min: form.employee_min ? Number(form.employee_min) : null,
        employee_max: form.employee_max ? Number(form.employee_max) : null,
        sales_team_size_min: form.sales_team_size_min ? Number(form.sales_team_size_min) : null,
        sales_team_size_max: form.sales_team_size_max ? Number(form.sales_team_size_max) : null,
        decision_maker_titles: form.decision_maker_titles.split(',').map((s) => s.trim()).filter(Boolean),
        notes: form.notes || null,
      })
      setSaved(true)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="partnerSettingsPanel"><div className="partnerLoadingState">Loading ICP configuration...</div></div>
  if (!form) return null

  return (
    <div className="partnerSettingsPanel">
      <div className="partnerSettingsPanelHead">
        <div>
          <h2 className="partnerSettingsPanelTitle">Ideal Customer Profile (ICP)</h2>
          <p className="partnerSettingsPanelSubtitle">
            Changing these criteria updates the matching filters used by Elephant Edge to fetch new target accounts.
          </p>
        </div>
      </div>

      <div className="partnerSettingsLayoutSplit">
        {/* Natural Language ICP Parser Box */}
        <div className="partnerSettingsAiParserBox">
          <div className="partnerSettingsAiParserHeader">
            <span className="partnerSettingsAiBadge">AI Parser</span>
            <span className="partnerSettingsAiTitle">Describe your target companies in plain English</span>
          </div>
          <p className="partnerSettingsAiDesc">
            Our AI extracts industries, revenue bands, headcounts, and decision-maker roles straight into the structured fields.
          </p>
          <textarea
            className="partnerSearchInput partnerSettingsTextarea"
            rows={3}
            placeholder="e.g. B2B SaaS companies doing $3M-$30M ARR with 20-100 employees in the US, targeting CEO and VP Sales..."
            value={describeText}
            onChange={(e) => { setDescribeText(e.target.value); setApplied(false) }}
          />

          <div className="partnerSettingsParserActions">
            <button
              type="button"
              className="partnerPrimaryBtn"
              onClick={parseDescription}
              disabled={parsing || !describeText.trim()}
            >
              {parsing ? 'Extracting criteria...' : 'Auto-fill fields from description'}
            </button>
            <button
              type="button"
              className="partnerSecondaryBtn"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
            >
              Upload document (.md / .txt)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv"
              onChange={onFileChosen}
              style={{ display: 'none' }}
            />
          </div>

          {parseError && <div className="partnerFormError" style={{ marginTop: 4 }}>{parseError}</div>}
          {applied && (
            <div className="partnerSavedNote" style={{ marginTop: 4 }}>
              ✓ Structured fields updated below. Review and click "Save ICP Criteria" to commit.
            </div>
          )}
        </div>

        {/* Structured Form Fields: Clean 2-column grid */}
        <div className="partnerSettingsFieldsGrid">
          <div className="partnerFormRow">
            <label className="partnerFormLabel">Target Industries</label>
            <input
              className="partnerSearchInput"
              type="text"
              placeholder="Professional Services, SaaS, Healthcare"
              value={form.industries}
              onChange={set('industries')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Target Geographies</label>
            <input
              className="partnerSearchInput"
              type="text"
              placeholder="United States, Canada, United Kingdom"
              value={form.geographies}
              onChange={set('geographies')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Revenue Min (USD)</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="2500000"
              value={form.revenue_min_usd}
              onChange={set('revenue_min_usd')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Revenue Max (USD)</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="5000000"
              value={form.revenue_max_usd}
              onChange={set('revenue_max_usd')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Company Headcount Min</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="11"
              value={form.employee_min}
              onChange={set('employee_min')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Company Headcount Max</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="50"
              value={form.employee_max}
              onChange={set('employee_max')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Sales Team Size Min</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="2"
              value={form.sales_team_size_min}
              onChange={set('sales_team_size_min')}
            />
          </div>

          <div className="partnerFormRow">
            <label className="partnerFormLabel">Sales Team Size Max</label>
            <input
              className="partnerSearchInput"
              type="number"
              placeholder="3"
              value={form.sales_team_size_max}
              onChange={set('sales_team_size_max')}
            />
          </div>

          <div className="partnerFormRow partnerSettingsColSpan2">
            <label className="partnerFormLabel">Decision Maker Titles</label>
            <input
              className="partnerSearchInput"
              type="text"
              placeholder="Owner, Founder, CEO, Co-Founder, VP Sales"
              value={form.decision_maker_titles}
              onChange={set('decision_maker_titles')}
            />
          </div>

          <div className="partnerFormRow partnerSettingsColSpan2">
            <label className="partnerFormLabel">Qualification Notes & Specific Constraints</label>
            <textarea
              className="partnerSearchInput"
              rows={3}
              placeholder="e.g. Specifically targeting companies with no dedicated marketing hire (Marketing < 1)."
              value={form.notes}
              onChange={set('notes')}
            />
          </div>
        </div>
      </div>

      {error && <div className="partnerFormError" style={{ marginTop: 14 }}>{error}</div>}

      <div className="partnerFormActions partnerSettingsFooterActions">
        <button className="partnerPrimaryBtn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save ICP Criteria'}
        </button>
        {saved && <span className="partnerSavedNote">✓ Saved — Elephant Edge has been notified</span>}
      </div>
    </div>
  )
}
