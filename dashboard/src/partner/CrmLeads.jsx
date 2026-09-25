import { useEffect, useRef, useState } from 'react'
import { getCrmLeads, getCrmLeadsExportUrl, updateCrmLead, formatApiError } from '../v2/api.js'
import PartnerDropdown from './PartnerDropdown.jsx'

const PAGE_SIZE = 50

// Explicit pipeline, not a generic status -- mirrors the real workflow Majji laid out (raw
// import, then company/role fit BEFORE spending on email enrichment, THEN outreach) rather than
// just a send/reply funnel. Order here is left-to-right through the real process.
const STAGES = [
  { value: '', label: 'All' },
  { value: 'imported', label: 'Imported' },
  { value: 'fit_review', label: 'Fit Review' },
  { value: 'enriched', label: 'Enriched' },
  { value: 'outreached', label: 'Outreached' },
  { value: 'replied', label: 'Replied' },
  { value: 'registered', label: 'Registered' },
  { value: 'attended', label: 'Attended' },
  { value: 'no_response', label: 'No Response' },
  { value: 'not_interested', label: 'Not Interested' },
]

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]))

function FitBadge({ value }) {
  if (value === 'pass') return <span className="partnerTag partnerTagPrimary">Fit</span>
  if (value === 'fail') return <span className="partnerTag partnerTagWarn">No fit</span>
  return <span className="partnerTableMuted">Pending</span>
}

// Explicit ask 2026-09-26: picking "Outreached" shouldn't just be a status flip -- it should
// immediately ask which channel the outreach actually went out on, since LinkedIn and Email are
// tracked/attributed separately downstream. Every other stage commits on a single click; only
// Outreached opens this second-level channel menu before writing anything.
const CHANNEL_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email', label: 'Email' },
]
const CHANNEL_LABEL = Object.fromEntries(CHANNEL_OPTIONS.map((c) => [c.value, c.label]))

function StageSelect({ lead, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [pendingChannel, setPendingChannel] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPendingChannel(false) } }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setPendingChannel(false) } }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const commit = async (updates) => {
    setSaving(true)
    try {
      const updated = await updateCrmLead(lead.id, updates)
      onChanged(updated)
    } catch (err) {
      alert(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const pickStage = (stageValue) => {
    if (stageValue === 'outreached') {
      setPendingChannel(true)
      return
    }
    setOpen(false)
    commit({ stage: stageValue })
  }

  const pickChannel = (channel) => {
    setOpen(false)
    setPendingChannel(false)
    commit({ stage: 'outreached', outreach_channel: channel })
  }

  const triggerLabel = lead.stage === 'outreached' && lead.outreach_channel
    ? `Outreached · ${CHANNEL_LABEL[lead.outreach_channel]}`
    : (STAGE_LABEL[lead.stage] || lead.stage)

  return (
    <div className="partnerDropdown partnerDropdownStage" ref={ref}>
      <button
        type="button"
        className="partnerDropdownTrigger"
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setPendingChannel(false) }}
      >
        <span className="partnerDropdownTriggerLabel">{triggerLabel}</span>
        <span className="partnerDropdownArrow" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="partnerDropdownMenu partnerDropdownMenuRight" role="listbox">
          {!pendingChannel ? (
            STAGES.filter((s) => s.value).map((s) => (
              <li key={s.value} role="option" aria-selected={lead.stage === s.value}>
                <button
                  type="button"
                  className={`partnerDropdownOption${lead.stage === s.value ? ' partnerDropdownOptionActive' : ''}`}
                  onClick={() => pickStage(s.value)}
                >
                  {s.label}
                </button>
              </li>
            ))
          ) : (
            CHANNEL_OPTIONS.map((c) => (
              <li key={c.value} role="option">
                <button type="button" className="partnerDropdownOption" onClick={() => pickChannel(c.value)}>
                  {c.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// role_fit/company_fit filter options -- "pending" maps to the backend's NULL check, not a
// literal stored value (see list_crm_leads' own docstring).
const FIT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'pass', label: 'Fit' },
  { value: 'fail', label: 'No fit' },
  { value: 'pending', label: 'Pending' },
]

export default function CrmLeads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [stageCounts, setStageCounts] = useState({})
  const [stats, setStats] = useState({})
  const [sourceFiles, setSourceFiles] = useState([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  // "which list" -- explicit ask 2026-09-23: "add an select dropdown to select particular
  // list so only that will be shown instead of mixing all". '' means every list, mixed.
  const [sourceFile, setSourceFile] = useState('')
  const [roleFit, setRoleFit] = useState('')
  const [companyFit, setCompanyFit] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getCrmLeads({ page, pageSize: PAGE_SIZE, search, stage, sourceFile, roleFit, companyFit })
      .then((data) => {
        setLeads(data.leads || [])
        setTotal(data.total || 0)
        setStageCounts(data.stage_counts || {})
        setStats(data.stats || {})
        setSourceFiles(data.source_files || [])
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, search, stage, sourceFile, roleFit, companyFit])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // This is a partner-facing page (Sandy sees it) -- the real source_file values are internal
  // tooling names (Clay, Prospeo, SalesIntel exports, ...) that shouldn't leak into a client
  // view. The backend already returns source_files in a stable, first-imported-first order
  // (see list_crm_leads), so "List 1" always means the same underlying list across reloads.
  // Only the label shown is generic -- filtering and the CSV export still use the real value.
  const listLabel = Object.fromEntries(sourceFiles.map((f, i) => [f, `List ${i + 1}`]))

  const handleLeadUpdated = (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    // Stage counts drift by one move -- cheap to just reload rather than hand-patch two buckets.
    load()
  }

  return (
    <div>
      <div className="partnerAccountsHeader partnerAccountsHeaderRow">
        <div>
          <h1>Data</h1>
          <p>Every outreach target for the Enterprise Edge webinar series, tracked stage by stage.</p>
        </div>
        <a
          className="partnerBtnSecondary"
          href={getCrmLeadsExportUrl({ search, stage, sourceFile, roleFit, companyFit })}
        >
          Download CSV
        </a>
      </div>

      <div className="partnerStatsRow">
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.company_fit_pass ?? 0}</div>
          <div className="partnerStatCardLabel">Company fit confirmed</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.role_fit_pass ?? 0}</div>
          <div className="partnerStatCardLabel">Role fit confirmed</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.contacts_needed ?? 0}</div>
          <div className="partnerStatCardLabel">Accounts fit, no contact found yet</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.emails_found ?? 0}</div>
          <div className="partnerStatCardLabel">Emails found</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.reached_out ?? 0}</div>
          <div className="partnerStatCardLabel">Reached out</div>
        </div>
      </div>

      <div className="partnerFilterPills">
        {STAGES.map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            className={`partnerFilterPill${stage === s.value ? ' partnerFilterPillActive' : ''}`}
            onClick={() => { setPage(1); setStage(s.value) }}
          >
            {s.label}
            <span className="partnerFilterPillCount">
              {s.value ? (stageCounts[s.value] ?? 0) : Object.values(stageCounts).reduce((a, b) => a + b, 0)}
            </span>
          </button>
        ))}
      </div>

      <div className="partnerSearchRow">
        <input
          className="partnerSearchInput"
          type="text"
          placeholder="Search by name or company"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
        />
        <PartnerDropdown
          ariaLabel="Filter by which imported list"
          value={sourceFile}
          onChange={(v) => { setPage(1); setSourceFile(v) }}
          options={[{ value: '', label: 'All lists' }, ...sourceFiles.map((f) => ({ value: f, label: listLabel[f] }))]}
        />
        <PartnerDropdown
          ariaLabel="Filter by role fit"
          value={roleFit}
          onChange={(v) => { setPage(1); setRoleFit(v) }}
          options={FIT_OPTIONS.map((f) => ({ value: f.value, label: `Role fit: ${f.label}` }))}
        />
        <PartnerDropdown
          ariaLabel="Filter by company fit"
          value={companyFit}
          onChange={(v) => { setPage(1); setCompanyFit(v) }}
          options={FIT_OPTIONS.map((f) => ({ value: f.value, label: `Company fit: ${f.label}` }))}
        />
      </div>

      {loading ? (
        <div className="partnerLoadingState">Loading...</div>
      ) : error ? (
        <div className="partnerErrorState">{error}</div>
      ) : leads.length === 0 ? (
        <div className="partnerCardWrap">
          <div className="partnerEmptyState">
            {search ? 'No leads match that search.' : 'No leads in this stage yet.'}
          </div>
        </div>
      ) : (
        <div className="partnerTableWrap">
          <table className="partnerTable crmTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Title</th>
                <th>Industry</th>
                <th>Revenue</th>
                <th>Size</th>
                <th>Role fit</th>
                <th>Company fit</th>
                <th title="Why a fit check passed/failed/is pending">Fit notes</th>
                <th>Email</th>
                <th>Source</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="partnerAccountName">{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}</div>
                  </td>
                  <td className={lead.company_name ? '' : 'partnerTableMuted'}>
                    {lead.company_name
                      ? (lead.company_linkedin_url
                          ? <a
                              href={lead.company_linkedin_url.startsWith('http') ? lead.company_linkedin_url : `https://${lead.company_linkedin_url}`}
                              target="_blank" rel="noreferrer" className="partnerTableAction"
                            >
                              {lead.company_name}
                            </a>
                          : lead.company_name)
                      : '—'}
                  </td>
                  <td className={lead.title ? '' : 'partnerTableMuted'}>{lead.title || '—'}</td>
                  <td className={lead.industry ? '' : 'partnerTableMuted'}>{lead.industry || '—'}</td>
                  <td className={lead.estimated_revenue ? '' : 'partnerTableMuted'}>{lead.estimated_revenue || '—'}</td>
                  <td className={lead.employee_count ? '' : 'partnerTableMuted'}>{lead.employee_count || '—'}</td>
                  <td><FitBadge value={lead.role_fit} /></td>
                  <td><FitBadge value={lead.company_fit} /></td>
                  <td className="partnerTableMuted" style={{ maxWidth: 260 }} title={lead.fit_notes || ''}>
                    {lead.fit_notes ? (lead.fit_notes.length > 70 ? `${lead.fit_notes.slice(0, 70)}…` : lead.fit_notes) : '—'}
                  </td>
                  <td className={lead.email ? '' : 'partnerTableMuted'}>{lead.email || '—'}</td>
                  <td className="partnerTableMuted">{listLabel[lead.source_file] || lead.source_file}</td>
                  <td><StageSelect lead={lead} onChanged={handleLeadUpdated} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > PAGE_SIZE && (
        <div className="partnerPagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages} · {total} leads</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
