import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProposal, updateProposal, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft } from '../icons.jsx'

const STATUS_OPTIONS = ['sent', 'in_pipeline', 'accepted', 'rejected', 'stalled', 'unknown']

const TEXT_FIELDS = [
  { key: 'company_name', label: 'Company name' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'sent_period', label: 'Sent period' },
  { key: 'icp_fit', label: 'ICP fit (yes / no / unknown)' },
  { key: 'monthly_value', label: 'Monthly value' },
]

// Dedicated full-page editor for one Proposal row -- same pattern as CrmEdit.jsx (its own
// route, not a modal, so it's directly linkable and survives a refresh via GET /proposals/{id}).
export default function ProposalEdit() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [values, setValues] = useState(null)
  const [documentText, setDocumentText] = useState(null)
  const [documentFilename, setDocumentFilename] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    getProposal(id)
      .then(p => {
        setValues({
          company_name: p.company_name || '',
          contact_name: p.contact_name || '',
          linkedin_url: p.linkedin_url || '',
          sent_period: p.sent_period || '',
          icp_fit: p.icp_fit || '',
          monthly_value: p.monthly_value != null ? String(p.monthly_value) : '',
          status: p.status || 'unknown',
          what_they_asked_for: p.what_they_asked_for || '',
          why_not_closed: p.why_not_closed || '',
        })
        setDocumentText(p.proposal_document_text || null)
        setDocumentFilename(p.proposal_document_filename || null)
      })
      .catch(err => setLoadError(formatApiError(err)))
      .finally(() => setLoading(false))
  }, [id])

  const backTo = '/v2/proposals'

  const save = () => {
    setSaving(true)
    setSaveError(null)
    const payload = { ...values, monthly_value: values.monthly_value === '' ? null : Number(values.monthly_value) }
    updateProposal(id, payload)
      .then(() => navigate(backTo))
      .catch(err => setSaveError(formatApiError(err)))
      .finally(() => setSaving(false))
  }

  return (
    <div>
      <button type="button" className="v2-crm-edit-back" onClick={() => navigate(backTo)}>
        <IconChevronLeft /> Back to Proposals
      </button>

      <div className="v2-page-head">
        <div className="v2-page-eyebrow">Edit proposal</div>
        <h1 className="v2-page-title">{loading ? 'Loading…' : (values?.company_name || id)}</h1>
      </div>

      {loadError && <p className="v2-state v2-state-error"><IconAlertTriangle /> {loadError}</p>}
      {loading && !loadError && <div className="v2-state">Loading…</div>}

      {values && !loading && (
        <div className="v2-crm-edit-card">
          <div className="v2-crm-edit-grid">
            {TEXT_FIELDS.map(f => (
              <div className="v2-field" key={f.key}>
                <label className="v2-field-label">{f.label}</label>
                <input
                  type="text" className="v2-input" value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}

            <div className="v2-field">
              <label className="v2-field-label">Status</label>
              <select
                className="v2-select" value={values.status}
                onChange={e => setValues(v => ({ ...v, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="v2-field">
            <label className="v2-field-label">What they asked for</label>
            <textarea
              className="v2-textarea" value={values.what_they_asked_for}
              onChange={e => setValues(v => ({ ...v, what_they_asked_for: e.target.value }))}
            />
          </div>

          <div className="v2-field">
            <label className="v2-field-label">Why it didn't close</label>
            <textarea
              className="v2-textarea" value={values.why_not_closed}
              onChange={e => setValues(v => ({ ...v, why_not_closed: e.target.value }))}
            />
          </div>

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

      {documentText && (
        <div className="v2-crm-edit-card" style={{ marginTop: 'var(--v2-space-4)' }}>
          <div className="v2-section-title" style={{ marginBottom: '0.6rem' }}>
            Original proposal document{documentFilename ? ` — ${documentFilename}` : ''}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v2-text-muted)', marginBottom: '0.8rem' }}>
            Read-only reference material, extracted from the real proposal that was sent.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '0.84rem',
            maxHeight: '420px', overflowY: 'auto', background: 'var(--v2-surface-elevated)',
            border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', padding: '1rem',
          }}>
            {documentText}
          </pre>
        </div>
      )}
    </div>
  )
}
