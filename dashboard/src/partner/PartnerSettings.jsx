import { useEffect, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { getPartnerIcp, savePartnerIcp, updateMyProfile, formatApiError } from '../v2/api.js'

function icpToForm(icp) {
  return {
    industries: (icp?.industries || []).join(', '),
    geographies: (icp?.geographies || []).join(', '),
    revenue_min_usd: icp?.revenue_min_usd ?? '',
    revenue_max_usd: icp?.revenue_max_usd ?? '',
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

  useEffect(() => {
    getPartnerIcp()
      .then((icp) => setForm(icpToForm(icp)))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setSaved(false) }

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

      {error && <div className="partnerFormError">{error}</div>}
      <div className="partnerFormActions">
        <button className="partnerPrimaryBtn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save ICP'}</button>
        {saved && <span className="partnerSavedNote">Saved — Elephant Edge has been notified</span>}
      </div>
    </div>
  )
}
