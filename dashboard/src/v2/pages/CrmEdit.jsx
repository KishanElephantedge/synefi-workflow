import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCrmCompany, getCrmContact, updateCrmCompany, updateCrmContact, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft } from '../icons.jsx'
import { OBJECT_TYPES } from './Crm.jsx'

const LOADERS = { companies: getCrmCompany, contacts: getCrmContact }
const UPDATERS = { companies: updateCrmCompany, contacts: updateCrmContact }

// Dedicated full-page CRM editor (companies/contacts) -- a separate route rather than a modal
// on the list page, so editing a record is its own navigable page, not an overlay.
export default function CrmEdit() {
  const { objectType, id } = useParams()
  const navigate = useNavigate()
  const config = OBJECT_TYPES[objectType]

  const [values, setValues] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (!config) return
    setLoading(true)
    setLoadError(null)
    LOADERS[objectType](id)
      .then(record => {
        const initial = {}
        config.columns.forEach(col => { initial[col.key] = record.properties?.[col.key] || '' })
        setValues(initial)
      })
      .catch(err => setLoadError(formatApiError(err)))
      .finally(() => setLoading(false))
  }, [objectType, id])

  if (!config) {
    return <div className="v2-state v2-state-error">Unknown CRM object type "{objectType}".</div>
  }

  const backTo = `/v2/crm?tab=${objectType}`

  const save = () => {
    setSaving(true)
    setSaveError(null)
    UPDATERS[objectType](id, values)
      .then(() => navigate(backTo))
      .catch(err => setSaveError(formatApiError(err)))
      .finally(() => setSaving(false))
  }

  return (
    <div>
      <button type="button" className="v2-crm-edit-back" onClick={() => navigate(backTo)}>
        <IconChevronLeft /> Back to {config.label}
      </button>

      <div className="v2-page-head">
        <div className="v2-page-eyebrow">Edit {config.label.slice(0, -1).toLowerCase()}</div>
        <h1 className="v2-page-title">
          {loading ? 'Loading…' : (values ? (values.name || values.email || [values.firstname, values.lastname].filter(Boolean).join(' ')) || id : id)}
        </h1>
      </div>

      {loadError && (
        <p className="v2-state v2-state-error"><IconAlertTriangle /> {loadError}</p>
      )}

      {loading && !loadError && <div className="v2-state">Loading…</div>}

      {values && !loading && (
        <div className="v2-card" style={{ maxWidth: '520px' }}>
          {config.columns.map(col => (
            <div className="v2-field" key={col.key}>
              <label className="v2-field-label">{col.label}</label>
              <input
                type="text" className="v2-input" value={values[col.key]}
                onChange={e => setValues(v => ({ ...v, [col.key]: e.target.value }))}
              />
            </div>
          ))}

          {saveError && (
            <p className="v2-state v2-state-error" style={{ padding: 0, background: 'none', textAlign: 'left' }}>
              <IconAlertTriangle /> {saveError}
            </p>
          )}

          <div className="v2-btn-row">
            <button type="button" className="v2-btn-primary v2-btn" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="v2-btn" onClick={() => navigate(backTo)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
