import { useEffect, useRef, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerIcp, savePartnerIcp, parsePartnerIcp, updateMyProfile, formatApiError } from '../v2/api.js'

// Parsed-ICP preview -> the same shape icpToForm() already produces from a real saved ICP, so
// applying an AI parse result to the form is identical to loading one from the server.
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
    <div>
      <div className="partnerAccountsHeader">
        <h1>Settings</h1>
        <p>Your profile and the ICP we fetch accounts against.</p>
      </div>

      {/* Hidden in admin mode -- ProfileCard edits the CURRENT SESSION's own name via
          PATCH /auth/me, which is the admin's own account here, not the partner's. Nothing
          about editing a partner's display name is possible or needed from this view. */}
      {adminMode ? (
        <p className="partnerEmptyFeatures">Profile editing is only available to the partner themselves.</p>
      ) : (
        <ProfileCard user={user} />
      )}
      <IcpCard />
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
    <div className="partnerSettingsCard">
      <h2 className="partnerSectionTitle">Profile</h2>
      <div className="partnerFormRow">
        <label className="partnerFormLabel">Name</label>
        <input className="partnerSearchInput" type="text" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
      </div>
      <div className="partnerFormRow">
        <label className="partnerFormLabel">Email</label>
        <div className="partnerReadonlyValue">{user?.email}</div>
      </div>
      {error && <div className="partnerFormError">{error}</div>}
      <div className="partnerFormActions">
        <button className="partnerPrimaryBtn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {saved && <span className="partnerSavedNote">Saved</span>}
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

  if (loading) return <div className="partnerSettingsCard"><div className="partnerLoadingState">Loading...</div></div>
  if (!form) return null

  return (
    <div className="partnerSettingsCard">
      <h2 className="partnerSectionTitle">Your ICP</h2>
      <p className="partnerHint">
        Changing this doesn&apos;t re-run discovery automatically -- it notifies Elephant Edge, who will
        fetch a fresh batch of accounts against the new criteria.
      </p>

      <div className="partnerFormRow">
        <label className="partnerFormLabel">Describe your ICP</label>
        <textarea
          className="partnerSearchInput"
          rows={4}
          placeholder="Write it however you'd describe it -- e.g. 'SaaS founders doing $3-30M ARR, small sales team of 2-3, mostly US.' Or upload a doc below."
          value={describeText}
          onChange={(e) => { setDescribeText(e.target.value); setApplied(false) }}
        />
        <div className="partnerFormActions" style={{ marginTop: 8 }}>
          <button className="partnerPrimaryBtn" onClick={parseDescription} disabled={parsing || !describeText.trim()}>
            {parsing ? 'Reading...' : 'Fill fields from this'}
          </button>
          <button
            type="button"
            className="partnerPrimaryBtn"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
          >
            Upload a doc
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv"
            onChange={onFileChosen}
            style={{ display: 'none' }}
          />
        </div>
        {parseError && <div className="partnerFormError">{parseError}</div>}
        {applied && (
          <div className="partnerSavedNote">
            Filled in below from what you described -- check it over, then hit Save ICP.
          </div>
        )}
        <div className="partnerHint">Text or markdown files only for now.</div>
      </div>

      <div className="partnerFormRow">
        <label className="partnerFormLabel">Industries</label>
        <input className="partnerSearchInput" type="text" placeholder="B2B SaaS, Fintech" value={form.industries} onChange={set('industries')} />
      </div>
      <div className="partnerFormRow">
        <label className="partnerFormLabel">Geographies</label>
        <input className="partnerSearchInput" type="text" placeholder="United States" value={form.geographies} onChange={set('geographies')} />
      </div>
      <div className="partnerFormRowSplit">
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Revenue min (USD)</label>
          <input className="partnerSearchInput" type="number" placeholder="25000000" value={form.revenue_min_usd} onChange={set('revenue_min_usd')} />
        </div>
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Revenue max (USD)</label>
          <input className="partnerSearchInput" type="number" placeholder="250000000" value={form.revenue_max_usd} onChange={set('revenue_max_usd')} />
        </div>
      </div>
      <div className="partnerFormRowSplit">
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Employees min</label>
          <input className="partnerSearchInput" type="number" placeholder="30" value={form.employee_min} onChange={set('employee_min')} />
        </div>
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Employees max</label>
          <input className="partnerSearchInput" type="number" placeholder="100" value={form.employee_max} onChange={set('employee_max')} />
        </div>
      </div>
      <div className="partnerFormRowSplit">
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Sales team size min</label>
          <input className="partnerSearchInput" type="number" placeholder="2" value={form.sales_team_size_min} onChange={set('sales_team_size_min')} />
        </div>
        <div className="partnerFormRow">
          <label className="partnerFormLabel">Sales team size max</label>
          <input className="partnerSearchInput" type="number" placeholder="3" value={form.sales_team_size_max} onChange={set('sales_team_size_max')} />
        </div>
      </div>
      <div className="partnerFormRow">
        <label className="partnerFormLabel">Decision maker titles</label>
        <input className="partnerSearchInput" type="text" placeholder="Owner, Founder, CEO, Co-Founder" value={form.decision_maker_titles} onChange={set('decision_maker_titles')} />
      </div>
      <div className="partnerFormRow">
        <label className="partnerFormLabel">Notes</label>
        <textarea className="partnerSearchInput" rows={3} value={form.notes} onChange={set('notes')} />
      </div>

      {error && <div className="partnerFormError">{error}</div>}
      <div className="partnerFormActions">
        <button className="partnerPrimaryBtn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save ICP'}</button>
        {saved && <span className="partnerSavedNote">Saved — Elephant Edge has been notified</span>}
      </div>
    </div>
  )
}
