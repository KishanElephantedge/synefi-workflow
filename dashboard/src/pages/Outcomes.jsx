import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import client from '../api/client'

function humanizeActivity(value) {
  if (!value) return '-'
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function activityPillClass(value) {
  if (value === 'CONNECTED' || value === 'COMPLETED') return 'on'
  if (value === 'NO_REPLY_YET') return 'warn'
  return 'off'
}

function messagePillClass(value) {
  if (value === 'approved') return 'on'
  if (value === 'rejected') return 'bad'
  if (value === 'draft') return 'warn'
  return 'off'
}

function pct(rate) {
  if (rate === null || rate === undefined) return '-'
  return `${Math.round(rate * 100)}%`
}

// Elephant Edge only. Lead dashboard: KPI cards + a searchable/filterable table of every
// lead we've researched or messaged, driven from OUR OWN db and enriched with live
// SalesRobot status where a match exists (see GET /leads) -- deliberately not SalesRobot-
// first, so a lead we've generated a message for but haven't pushed yet still shows up, and
// the page still mostly works if SalesRobot is briefly unreachable. The old flat campaign
// list is now one view inside this page (a toggle), not the whole page.
export default function Outcomes() {
  const { tenantSlug } = useParams()
  const [searchParams] = useSearchParams()

  const [view, setView] = useState('leads') // 'leads' | 'campaigns'

  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)

  const [leads, setLeads] = useState([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError] = useState(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [messageFilter, setMessageFilter] = useState(searchParams.get('message_status') || '')
  const [activityFilter, setActivityFilter] = useState(searchParams.get('activity') || '')
  const [pipelineOnly] = useState(searchParams.get('pipeline_only') !== 'false')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const PAGE_SIZE = 25

  const [selectedLead, setSelectedLead] = useState(null)
  const [leadDetail, setLeadDetail] = useState(null)
  const [leadDetailLoading, setLeadDetailLoading] = useState(false)
  const [leadDetailError, setLeadDetailError] = useState(null)
  const [showFullMessage, setShowFullMessage] = useState(false)

  const [campaigns, setCampaigns] = useState([])
  const [campaignsError, setCampaignsError] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [campaignLeads, setCampaignLeads] = useState([])
  const [campaignLeadsLoading, setCampaignLeadsLoading] = useState(false)

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    client.get('/leads/stats').then(res => setStats(res.data)).catch(err => setStatsError(err.response?.data?.detail || err.message))
  }, [tenantSlug])

  // Debounce the search box so every keystroke doesn't fire a request -- filtering happens
  // server-side now (see GET /leads), so typing quickly would otherwise mean one query per
  // character.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setLeadsLoading(true)
    client.get('/leads', { params: { page, page_size: PAGE_SIZE, search, message_status: messageFilter, activity: activityFilter, pipeline_only: pipelineOnly } })
      .then(res => {
        setLeads(res.data.leads)
        setTotalPages(res.data.total_pages)
        setTotalLeads(res.data.total)
      })
      .catch(err => setLeadsError(err.response?.data?.detail || err.message))
      .finally(() => setLeadsLoading(false))
  }, [tenantSlug, page, search, messageFilter, activityFilter, pipelineOnly])

  const loadCampaigns = () => {
    client.get('/salesrobot/campaigns').then(res => setCampaigns(res.data)).catch(err => setCampaignsError(err.response?.data?.detail || err.message))
  }

  const openCampaign = (campaign) => {
    setSelectedCampaign(campaign)
    setCampaignLeads([])
    setCampaignLeadsLoading(true)
    const uuid = campaign.campaignUuid || campaign.uuid
    client.get(`/salesrobot/campaigns/${uuid}/leads`)
      .then(res => setCampaignLeads(res.data))
      .catch(() => {})
      .finally(() => setCampaignLeadsLoading(false))
  }

  const switchToCampaigns = () => {
    setView('campaigns')
    if (campaigns.length === 0) loadCampaigns()
  }

  const openLead = (lead) => {
    setSelectedLead(lead)
    setLeadDetail(null)
    setLeadDetailError(null)
    setShowFullMessage(false)
    setLeadDetailLoading(true)
    client.get(`/leads/${lead.contact_id}`)
      .then(res => setLeadDetail(res.data))
      .catch(err => setLeadDetailError(err.response?.data?.detail || err.message))
      .finally(() => setLeadDetailLoading(false))
  }

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Campaign</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1>Campaign</h1>
        <p className="meta">Every lead we've researched or messaged, with live status where available.</p>
      </div>

      {statsError && <p className="error">{statsError}</p>}
      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Messages Drafted</div>
            <div className="stat-value">{stats.researched}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Messages Approved</div>
            <div className="stat-value">{stats.approved}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Connections Sent</div>
            <div className="stat-value">{stats.connections_sent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Accepted</div>
            <div className="stat-value">{stats.connections_accepted} <span className="hint">({pct(stats.acceptance_rate)})</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Replied</div>
            <div className="stat-value">{stats.replied} <span className="hint">({pct(stats.reply_rate)})</span></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={view === 'leads' ? '' : 'secondary'} onClick={() => setView('leads')}>Leads</button>
        <button type="button" className={view === 'campaigns' ? '' : 'secondary'} onClick={switchToCampaigns}>Campaigns</button>
      </div>

      {view === 'leads' ? (
        <div className="batch-layout">
          <div className="batch-layout-main">
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search name, company, title..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ flex: '1 1 240px', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
              />
              <select value={messageFilter} onChange={e => { setPage(1); setMessageFilter(e.target.value) }} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <option value="">All message statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={activityFilter} onChange={e => { setPage(1); setActivityFilter(e.target.value) }} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <option value="">All activity</option>
                <option value="SENT">Sent</option>
                <option value="CONNECTED">Connected</option>
                <option value="REPLIED">Replied</option>
                <option value="NO_REPLY_YET">No reply yet</option>
                <option value="NOT_SENT">Not sent</option>
              </select>
            </div>

            {leadsError && <p className="error">{leadsError}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Sent to SalesRobot</th>
                    <th>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.contact_id} style={{ cursor: 'pointer' }} onClick={() => openLead(l)}>
                      <td>{l.first_name} {l.last_name}</td>
                      <td>{l.company_name || '-'}</td>
                      <td>{l.title || '-'}</td>
                      <td><span className={`status-pill ${messagePillClass(l.message_status)}`}>{l.message_status || 'none'}</span></td>
                      <td>{l.push_status || '-'}</td>
                      <td><span className={`status-pill status-pill-sm ${activityPillClass(l.salesrobot_last_activity)}`}>{humanizeActivity(l.salesrobot_last_activity)}</span></td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">{leadsLoading ? 'Loading leads...' : 'No leads match.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" className="secondary btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
                <span className="hint">Page {page} of {totalPages} ({totalLeads} leads)</span>
                <button type="button" className="secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
              </div>
            )}
          </div>

          {selectedLead && (
            <div className="message-drawer">
              <div className="message-drawer-header">
                <div>
                  <h3>{selectedLead.first_name} {selectedLead.last_name}</h3>
                  <p className="meta">{selectedLead.title} {selectedLead.company_name ? `@ ${selectedLead.company_name}` : ''}</p>
                </div>
                <button type="button" className="message-drawer-close" onClick={() => setSelectedLead(null)} aria-label="Close">&times;</button>
              </div>
              <div className="message-drawer-body">
                {leadDetailLoading && <p className="hint">Loading...</p>}
                {leadDetailError && <p className="error">{leadDetailError}</p>}
                {leadDetail && (
                  <>
                    <div className="message-drawer-section">
                      <strong>Status</strong>
                      <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>
                        <span className={`status-pill ${messagePillClass(leadDetail.message_status)}`}>{leadDetail.message_status || 'no message'}</span>
                        {' '}
                        <span className={`status-pill ${activityPillClass(leadDetail.salesrobot_last_activity)}`}>{humanizeActivity(leadDetail.salesrobot_last_activity)}</span>
                      </p>
                    </div>
                    {leadDetail.linkedin_url && (
                      <div className="message-drawer-section">
                        <strong>Profile</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}><a href={leadDetail.linkedin_url} target="_blank" rel="noopener noreferrer">{leadDetail.linkedin_url}</a></p>
                      </div>
                    )}
                    {leadDetail.generated_message && (
                      <div className="message-drawer-section">
                        <strong>Message</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{leadDetail.generated_message}</p>
                      </div>
                    )}
                    <div className="message-drawer-section">
                      <button type="button" className="link-button" onClick={() => setShowFullMessage(!showFullMessage)}>
                        {showFullMessage ? 'Hide research details' : 'View research details'}
                      </button>
                    </div>
                    {showFullMessage && (
                      <>
                        {leadDetail.company_research && (
                          <div className="message-drawer-section">
                            <strong>Company research</strong>
                            <pre>{JSON.stringify(leadDetail.company_research, null, 2)}</pre>
                          </div>
                        )}
                        {leadDetail.contact_research && (
                          <div className="message-drawer-section">
                            <strong>Contact research</strong>
                            <pre>{JSON.stringify(leadDetail.contact_research, null, 2)}</pre>
                          </div>
                        )}
                        {leadDetail.fit_analysis && (
                          <div className="message-drawer-section">
                            <strong>Fit analysis</strong>
                            <pre>{JSON.stringify(leadDetail.fit_analysis, null, 2)}</pre>
                          </div>
                        )}
                      </>
                    )}
                    <div className="message-drawer-section">
                      <strong>History</strong>
                      {leadDetail.activity_history.length === 0 && <p className="hint">No historical events received for this lead yet.</p>}
                      {leadDetail.activity_history.map(e => (
                        <div key={e.id} style={{ marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                          <strong>{e.event_type || 'unrecognized event'}</strong> — {new Date(e.received_at).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button type="button" className="link-button" style={{ marginBottom: '0.75rem' }} onClick={() => setView('leads')}>&larr; Back to leads</button>
          {campaignsError && <p className="error">{campaignsError}</p>}
          {!selectedCampaign ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Campaign</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.campaignUuid || c.uuid}>
                      <td>{c.campaignName || c.name}</td>
                      <td>{c.campaignStatus || '-'}</td>
                      <td><button type="button" className="link-button" onClick={() => openCampaign(c)}>View leads &rarr;</button></td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && !campaignsError && (
                    <tr><td colSpan={3} className="empty-state">Loading campaigns...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <button type="button" className="link-button" style={{ marginBottom: '0.75rem' }} onClick={() => setSelectedCampaign(null)}>&larr; Back to campaigns</button>
              <h2 style={{ margin: '0 0 0.75rem' }}>{selectedCampaign.campaignName || selectedCampaign.name}</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Title</th><th>Company</th><th>Status</th></tr></thead>
                  <tbody>
                    {campaignLeads.map(l => (
                      <tr key={l.prospectUuid}>
                        <td>{l.fullName}</td>
                        <td>{l.jobTitle || '-'}</td>
                        <td>{l.companyName || '-'}</td>
                        <td><span className={`status-pill ${activityPillClass(l.lastActivity)}`}>{humanizeActivity(l.lastActivity)}</span></td>
                      </tr>
                    ))}
                    {campaignLeads.length === 0 && (
                      <tr><td colSpan={4} className="empty-state">{campaignLeadsLoading ? 'Loading...' : 'No leads in this campaign yet.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
