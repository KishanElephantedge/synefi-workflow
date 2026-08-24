import { useEffect, useState } from 'react'
import {
  listCrmCompanies, listCrmContacts, updateCrmCompany, updateCrmContact,
  deleteCrmCompany, deleteCrmContact, formatApiError,
} from '../api.js'
import { IconAlertTriangle, IconEdit, IconTrash, IconX } from '../icons.jsx'

// V2 CRM -- direct read/edit/delete against the real HubSpot account already connected in V1
// (app/hubspot_client.py's CRM section). V1's existing HubSpot sync (app/phases/hubspot_sync.py)
// only pushes new companies/contacts one-way after Decision Maker succeeds; this page is the
// first place either object type can be read back, edited, or deleted. Curated property sets
// only, matching the backend's own deliberate scope decision -- not every HubSpot field is
// editable here.
const OBJECT_TYPES = {
  companies: {
    label: 'Companies',
    idLabel: 'name',
    list: listCrmCompanies,
    update: updateCrmCompany,
    remove: deleteCrmCompany,
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'domain', label: 'Domain' },
      { key: 'industry', label: 'Industry' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'phone', label: 'Phone' },
      { key: 'website', label: 'Website' },
    ],
  },
  contacts: {
    label: 'Contacts',
    idLabel: 'email',
    list: listCrmContacts,
    update: updateCrmContact,
    remove: deleteCrmContact,
    fields: [
      { key: 'firstname', label: 'First name' },
      { key: 'lastname', label: 'Last name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'jobtitle', label: 'Job title' },
    ],
  },
}

function objectTitle(objectType, record) {
  const p = record.properties || {}
  if (objectType === 'companies') return p.name || p.domain || record.id
  const name = [p.firstname, p.lastname].filter(Boolean).join(' ')
  return name || p.email || record.id
}

function objectSubtitle(objectType, record) {
  const p = record.properties || {}
  if (objectType === 'companies') return p.domain || p.industry || ''
  return p.email || p.jobtitle || ''
}

function EditModal({ objectType, record, onClose, onSaved }) {
  const config = OBJECT_TYPES[objectType]
  const [values, setValues] = useState(() => {
    const initial = {}
    config.fields.forEach(f => { initial[f.key] = record.properties?.[f.key] || '' })
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = () => {
    setSaving(true)
    setError(null)
    config.update(record.id, values)
      .then(updated => onSaved(updated))
      .catch(err => setError(formatApiError(err)))
      .finally(() => setSaving(false))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="v2-card"
        style={{ width: '440px', maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="v2-section-title">Edit {config.label.slice(0, -1)}</div>
          <button type="button" className="v2-btn" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <IconX />
          </button>
        </div>

        {config.fields.map(f => (
          <div className="v2-field" key={f.key}>
            <label className="v2-field-label">{f.label}</label>
            <input
              type="text" className="v2-input" value={values[f.key]}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}

        {error && (
          <p className="v2-state v2-state-error" style={{ padding: 0, background: 'none', textAlign: 'left' }}>
            <IconAlertTriangle /> {error}
          </p>
        )}

        <div className="v2-btn-row">
          <button type="button" className="v2-btn-primary v2-btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="v2-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ objectType, record, onClose, onConfirm, deleting }) {
  const config = OBJECT_TYPES[objectType]
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div className="v2-card" style={{ width: '380px', maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div className="v2-section-title" style={{ marginBottom: '0.6rem' }}>
          Delete {config.label.slice(0, -1).toLowerCase()}?
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--v2-text-muted)', marginBottom: '1.2rem' }}>
          This permanently deletes <strong>{objectTitle(objectType, record)}</strong> from HubSpot. This can't be undone here.
        </p>
        <div className="v2-btn-row">
          <button type="button" className="v2-btn-danger v2-btn" disabled={deleting} onClick={onConfirm}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" className="v2-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ObjectTab({ objectType }) {
  const config = OBJECT_TYPES[objectType]
  const [records, setRecords] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [afterStack, setAfterStack] = useState([null])
  const [nextAfter, setNextAfter] = useState(null)

  const [editing, setEditing] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = (after) => {
    setLoading(true)
    setError(null)
    config.list({ limit: 25, after, search: search.trim() || null })
      .then(data => {
        setRecords(data.results)
        setNextAfter(data.next_after || null)
      })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setAfterStack([null])
    load(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectType])

  const runSearch = () => {
    setAfterStack([null])
    load(null)
  }

  const goNext = () => {
    if (!nextAfter) return
    setAfterStack(stack => [...stack, nextAfter])
    load(nextAfter)
  }

  const goPrev = () => {
    if (afterStack.length <= 1) return
    const stack = afterStack.slice(0, -1)
    setAfterStack(stack)
    load(stack[stack.length - 1])
  }

  const handleSaved = (updated) => {
    setRecords(rows => rows.map(r => (r.id === updated.id ? updated : r)))
    setEditing(null)
  }

  const handleDelete = () => {
    setDeleting(true)
    config.remove(deletingRecord.id)
      .then(() => {
        setRecords(rows => rows.filter(r => r.id !== deletingRecord.id))
        setDeletingRecord(null)
      })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setDeleting(false))
  }

  return (
    <div>
      <div className="v2-toolbar">
        <input
          type="text" className="v2-search-input" placeholder={`Search ${config.label.toLowerCase()}…`}
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
        />
        <button type="button" className="v2-btn" onClick={runSearch}>Search</button>
      </div>

      {error && (
        <p className="v2-state v2-state-error"><IconAlertTriangle /> {error}</p>
      )}

      {loading && records === null && <div className="v2-state">Loading {config.label.toLowerCase()}…</div>}

      {records !== null && records.length === 0 && !loading && (
        <div className="v2-state">No {config.label.toLowerCase()} found.</div>
      )}

      {records !== null && records.length > 0 && (
        <div className="v2-card" style={{ padding: 0 }}>
          {records.map((record, i) => (
            <div
              key={record.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.85rem 1.1rem', borderBottom: i === records.length - 1 ? 'none' : '1px solid var(--v2-border)',
                gap: '1rem',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--v2-text)' }}>
                  {objectTitle(objectType, record)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--v2-text-muted)' }}>
                  {objectSubtitle(objectType, record)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button type="button" className="v2-btn" title="Edit" onClick={() => setEditing(record)} style={{ padding: '0.4rem 0.6rem' }}>
                  <IconEdit />
                </button>
                <button type="button" className="v2-btn-danger v2-btn" title="Delete" onClick={() => setDeletingRecord(record)} style={{ padding: '0.4rem 0.6rem' }}>
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {records !== null && (afterStack.length > 1 || nextAfter) && (
        <div className="v2-pagination">
          <button type="button" onClick={goPrev} disabled={afterStack.length <= 1 || loading}>Previous</button>
          <span>Page {afterStack.length}</span>
          <button type="button" onClick={goNext} disabled={!nextAfter || loading}>Next</button>
        </div>
      )}

      {editing && (
        <EditModal objectType={objectType} record={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deletingRecord && (
        <ConfirmDeleteModal
          objectType={objectType} record={deletingRecord} deleting={deleting}
          onClose={() => setDeletingRecord(null)} onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

export default function Crm() {
  const [tab, setTab] = useState('companies')

  return (
    <div>
      <div className="v2-page-head">
        <div className="v2-page-eyebrow">Read, edit, and delete data straight from HubSpot</div>
        <h1 className="v2-page-title">CRM</h1>
      </div>

      <div className="v2-config-tabs">
        {Object.entries(OBJECT_TYPES).map(([key, cfg]) => (
          <button
            key={key} type="button" className={`v2-config-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '1.2rem' }}>
        {tab === 'companies' && <ObjectTab objectType="companies" />}
        {tab === 'contacts' && <ObjectTab objectType="contacts" />}
      </div>
    </div>
  )
}
