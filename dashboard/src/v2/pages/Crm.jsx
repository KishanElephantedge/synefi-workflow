import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listCrmCompanies, listCrmContacts, deleteCrmCompany, deleteCrmContact, formatApiError } from '../api.js'
import { IconAlertTriangle, IconEdit, IconTrash } from '../icons.jsx'

// V2 CRM -- direct read/edit/delete against the real HubSpot account already connected in V1
// (app/hubspot_client.py's CRM section). V1's existing HubSpot sync (app/phases/hubspot_sync.py)
// only pushes new companies/contacts one-way after Decision Maker succeeds; this page is the
// first place either object type can be read back, edited, or deleted. Curated property sets
// only, matching the backend's own deliberate scope decision -- not every HubSpot field is
// editable here. Table layout (not V2's usual row-list pattern) and a dedicated edit page
// (not a modal) per explicit request, so this section's shape differs from other V2 pages.
export const OBJECT_TYPES = {
  companies: {
    label: 'Companies',
    singular: 'company',
    list: listCrmCompanies,
    remove: deleteCrmCompany,
    columns: [
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
    singular: 'contact',
    list: listCrmContacts,
    remove: deleteCrmContact,
    columns: [
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
  return [p.firstname, p.lastname].filter(Boolean).join(' ') || p.email || record.id
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
          Delete {config.singular}?
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
        <div className="v2-table-wrap">
          <table className="v2-table">
            <thead>
              <tr>
                {config.columns.map(col => <th key={col.key}>{col.label}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  {config.columns.map(col => {
                    const value = record.properties?.[col.key]
                    return (
                      <td key={col.key} className={value ? '' : 'v2-table-muted'}>{value || '—'}</td>
                    )
                  })}
                  <td>
                    <div className="v2-table-actions">
                      <Link
                        to={`/v2/relationships/crm/${objectType}/${record.id}`}
                        className="v2-btn" title="Edit" style={{ padding: '0.35rem 0.55rem' }}
                      >
                        <IconEdit />
                      </Link>
                      <button
                        type="button" className="v2-btn-danger v2-btn" title="Delete"
                        onClick={() => setDeletingRecord(record)} style={{ padding: '0.35rem 0.55rem' }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {records !== null && (afterStack.length > 1 || nextAfter) && (
        <div className="v2-pagination">
          <button type="button" onClick={goPrev} disabled={afterStack.length <= 1 || loading}>Previous</button>
          <span>Page {afterStack.length}</span>
          <button type="button" onClick={goNext} disabled={!nextAfter || loading}>Next</button>
        </div>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'contacts' ? 'contacts' : 'companies'

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
            onClick={() => setSearchParams({ tab: key })}
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
