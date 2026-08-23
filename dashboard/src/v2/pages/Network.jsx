import { useEffect, useState } from 'react'
import {
  getNetworkSignals, getNetworkProfiles, addNetworkProfile, removeNetworkProfile, toggleNetworkProfileActive,
  getNetworkKeywords, putNetworkKeywords, runNetworkClassification, getNetworkPartnerMatches, formatApiError,
  runNetworkPartnerMatching, getNetworkRecommendations, updateNetworkRecommendation,
  generateNetworkRecommendationMessage, getNetworkRecommendationMessages, updateNetworkRecommendationMessage,
  markNetworkRecommendationMessageSent, lookupNetworkProfileSlackId, setNetworkProfileSlackId,
} from '../api.js'
import { IconAlertTriangle, IconRefreshCw, IconCheck, IconX } from '../icons.jsx'

// V2's port of V1's Targets page -- same real backend (app/phases/linkedin_monitor.py,
// app/phases/gtm_partner_classification.py, app/phases/gtm_partner_matching.py,
// app/phases/gtm_partner_messaging.py), no second implementation. Renamed "Network": this
// isn't just a signal feed, it's the watch-list of people/companies in Elephant Edge's ecosystem,
// which of them could be introduced to each other as GTM referral partners, AND which real
// companies from Elephant Edge's own company DB each watched partner could be introduced to.
const TABS = ['Signal Feed', 'Watched Profiles', 'Partner Matches', 'Recommended Companies', 'Settings']

const ACTION_BADGE = { engage: 'v2-badge-success', monitor: 'v2-badge-warning', ignore: 'v2-badge-neutral' }

function timeAgo(iso) {
  if (!iso) return ''
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function SignalFeedTab() {
  const [signals, setSignals] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('relevant')

  useEffect(() => {
    getNetworkSignals(100).then(setSignals).catch(err => setError(formatApiError(err)))
  }, [])

  const filtered = (signals || []).filter(s => {
    if (filter === 'all') return true
    if (filter === 'relevant') return s.recommended_action !== 'ignore'
    return s.recommended_action === filter
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { key: 'relevant', label: 'Relevant' },
          { key: 'engage', label: 'Engage' },
          { key: 'monitor', label: 'Monitor' },
          { key: 'ignore', label: 'Ignored' },
          { key: 'all', label: 'All' },
        ].map(f => (
          <button key={f.key} type="button" className={`v2-config-tab${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="v2-card"><div className="v2-state v2-state-error"><IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} /><div>Couldn't load signals: {error}</div></div></div>
      ) : signals === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 200 }} />
      ) : filtered.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No signals yet -- the monitor checks every 45 minutes.</div></div>
      ) : (
        <div className="v2-evidence-list">
          {filtered.map(s => (
            <div key={s.id} className="v2-evidence-item">
              <div className="v2-evidence-item-head">
                <span className="v2-evidence-item-title">{s.author_name || s.profile_name || 'Unknown'}</span>
                {s.recommended_action && <span className={`v2-badge ${ACTION_BADGE[s.recommended_action] || 'v2-badge-neutral'}`}>{s.recommended_action}</span>}
              </div>
              <div className="v2-evidence-item-body">{s.post_text}</div>
              {s.classifier_reason && <p className="v2-placeholder-note" style={{ marginTop: 4, marginBottom: 0, fontStyle: 'italic' }}>{s.classifier_reason}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span className="v2-kv-label">{timeAgo(s.posted_at)}</span>
                {s.post_url && <a href={s.post_url} target="_blank" rel="noopener noreferrer">View post &rarr;</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WatchedProfilesTab({ classifying, classifyResult, onClassify }) {
  const [profiles, setProfiles] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const load = () => getNetworkProfiles().then(setProfiles).catch(err => setError(formatApiError(err)))
  useEffect(load, [])

  const filtered = (profiles || []).filter(p => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (p.name || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <input
          type="text" placeholder="Search name or company..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 320, padding: '0.5rem 0.75rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }}
        />
        <div style={{ textAlign: 'right' }}>
          <button type="button" className="v2-btn" disabled={classifying} onClick={() => onClassify(load)}>
            {classifying ? 'Classifying...' : 'Classify unclassified'}
          </button>
          {classifyResult && (
            <p className="v2-kv-label" style={{ margin: '0.3rem 0 0' }}>
              {classifyResult.classified} classified, {classifyResult.insufficient_evidence} insufficient, {classifyResult.failed} failed
            </p>
          )}
        </div>
      </div>
      <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
        Industry / Sells to are inferred from each profile's real name, a web search about them, and their own captured posts -- never guessed when there's nothing to go on.
      </p>
      {error ? (
        <div className="v2-card"><div className="v2-state v2-state-error">{error}</div></div>
      ) : profiles === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
      ) : filtered.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No profiles match.</div></div>
      ) : (
        <div className="v2-evidence-list">
          {filtered.map(p => (
            <div key={p.id} className="v2-evidence-item">
              <div className="v2-evidence-item-head">
                <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="v2-evidence-item-title" style={{ color: 'inherit' }}>
                  {p.name || 'Unnamed'}{p.company ? ` · ${p.company}` : ''}
                </a>
                <span
                  className={`v2-badge ${p.active ? 'v2-badge-success' : 'v2-badge-neutral'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleNetworkProfileActive(p.id, !p.active).then(load)}
                >
                  {p.active ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="v2-kv-grid" style={{ marginTop: 6 }}>
                <div>
                  <div className="v2-kv-label">Industry</div>
                  <div className="v2-kv-value">{p.industry || (p.classification_status === 'insufficient_evidence' ? 'insufficient evidence' : '—')}</div>
                </div>
                <div>
                  <div className="v2-kv-label">Sells to</div>
                  <div className="v2-kv-value">{p.sells_to || '—'}</div>
                </div>
                <div>
                  <div className="v2-kv-label">Last checked</div>
                  <div className="v2-kv-value">{p.last_checked_at ? timeAgo(p.last_checked_at) : 'Not yet checked'}</div>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" className="v2-btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => removeNetworkProfile(p.id).then(load)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PartnerMatchesTab({ classifying, onClassify }) {
  const [matches, setMatches] = useState(null)
  const [error, setError] = useState(null)

  const load = () => getNetworkPartnerMatches().then(setMatches).catch(err => setError(formatApiError(err)))
  useEffect(load, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <p className="v2-placeholder-note" style={{ margin: 0, maxWidth: '60ch' }}>
          Watched companies in DIFFERENT industries who sell to the same real, stated buyer type -- worth introducing to each other. Grouped only from profiles already classified.
        </p>
        <button type="button" className="v2-btn" disabled={classifying} onClick={() => onClassify(load)}>
          {classifying ? 'Classifying...' : 'Classify unclassified'}
        </button>
      </div>
      {error ? (
        <div className="v2-card"><div className="v2-state v2-state-error">{error}</div></div>
      ) : matches === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 160 }} />
      ) : (
        <>
          <p className="v2-kv-label" style={{ marginBottom: '1rem' }}>{matches.classified_count} of {matches.total_active_profiles} watched profiles classified so far.</p>
          {matches.clusters.length === 0 ? (
            <div className="v2-card"><div className="v2-state">No cross-industry matches yet -- classification coverage grows as the monitor keeps running.</div></div>
          ) : (
            matches.clusters.map(cluster => (
              <div key={cluster.sells_to} className="v2-card" style={{ marginBottom: '1rem' }}>
                <div className="v2-evidence-item-head">
                  <span className="v2-evidence-item-title">Sells to: {cluster.sells_to}</span>
                  <span className="v2-badge v2-badge-neutral">{cluster.member_count} companies</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.6rem 0' }}>
                  {cluster.industries_represented.map(ind => <span key={ind} className="v2-badge v2-badge-info">{ind}</span>)}
                </div>
                <div className="v2-evidence-list">
                  {cluster.members.map(m => (
                    <div key={m.id} className="v2-evidence-item">
                      <div className="v2-evidence-item-head">
                        <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="v2-evidence-item-title" style={{ color: 'inherit' }}>
                          {m.name}{m.company ? ` · ${m.company}` : ''}
                        </a>
                        <span className="v2-kv-label">{m.industry}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}

const REC_STATUS_BADGE = { proposed: 'v2-badge-warning', approved: 'v2-badge-success', rejected: 'v2-badge-danger' }
const MSG_STATUS_BADGE = { draft: 'v2-badge-warning', approved: 'v2-badge-info', rejected: 'v2-badge-danger', sent: 'v2-badge-success' }

// Per-partner outreach message: draft -> approve/reject -> (once approved) mark sent via a real
// channel. "Send via Slack DM" only appears once the partner has a confirmed slack_user_id --
// mark_message_sent() itself performs the real send server-side (app/slack_bot_client.py) and
// returns auto_sent so this never claims a send that didn't actually happen.
function RecommendationMessage({ message, profile, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [channel, setChannel] = useState(profile?.slack_user_id ? 'slack' : 'linkedin')
  const [result, setResult] = useState(null)

  const setStatus = (status) => {
    setBusy(true); setError(null)
    updateNetworkRecommendationMessage(message.id, status).then(onChanged).catch(err => setError(formatApiError(err))).finally(() => setBusy(false))
  }

  const markSent = () => {
    setBusy(true); setError(null); setResult(null)
    markNetworkRecommendationMessageSent(message.id, channel)
      .then(res => { setResult(res); onChanged() })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setBusy(false))
  }

  return (
    <div className="v2-card" style={{ marginBottom: '0.75rem' }}>
      <div className="v2-evidence-item-head">
        <span className={`v2-badge ${MSG_STATUS_BADGE[message.status] || 'v2-badge-neutral'}`}>{message.status}</span>
        <span className="v2-kv-label">{timeAgo(message.generated_at)}</span>
      </div>
      <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>{message.generated_message || '(generation failed)'}</p>
      {error && <div className="v2-form-message error">{error}</div>}
      {message.status === 'draft' && (
        <div className="v2-btn-row">
          <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => setStatus('approved')}><IconCheck width={13} height={13} /> Approve</button>
          <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => setStatus('rejected')}><IconX width={13} height={13} /> Reject</button>
        </div>
      )}
      {message.status === 'approved' && (
        <div>
          <div className="v2-btn-row" style={{ marginBottom: '0.4rem' }}>
            <select
              value={channel} onChange={e => setChannel(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }}
            >
              <option value="slack">Slack</option>
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
            </select>
            <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={markSent}>
              {busy ? 'Sending...' : channel === 'slack' && profile?.slack_user_id ? 'Send via Slack DM' : 'Copy this text, then mark sent'}
            </button>
          </div>
          {result?.auto_sent === true && <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>Sent via Slack DM.</p>}
          {result?.auto_sent === false && <p className="v2-placeholder-note" style={{ marginBottom: 0 }}>Recorded as sent (no Slack id on file, so nothing was auto-sent -- deliver it yourself).</p>}
        </div>
      )}
      {message.status === 'sent' && (
        <p className="v2-kv-label" style={{ margin: 0 }}>Sent via {message.send_channel} · {timeAgo(message.sent_at)}</p>
      )}
    </div>
  )
}

function SlackIdentity({ profile, onChanged }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [manualId, setManualId] = useState('')
  const [status, setStatus] = useState(null)

  const lookup = () => {
    setStatus({ loading: true })
    lookupNetworkProfileSlackId(profile.id, email)
      .then(res => { setStatus({ loading: false, found: res.found }); if (res.found) onChanged() })
      .catch(err => setStatus({ loading: false, error: formatApiError(err) }))
  }

  const saveManual = () => {
    setNetworkProfileSlackId(profile.id, manualId).then(onChanged).catch(err => setStatus({ error: formatApiError(err) }))
  }

  if (profile.slack_user_id) {
    return <p className="v2-placeholder-note" style={{ margin: 0 }}>Slack DM confirmed: <code>{profile.slack_user_id}</code></p>
  }

  return (
    <div>
      <button type="button" className="v2-btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => setOpen(o => !o)}>
        {open ? 'Hide Slack setup' : 'Set up Slack DM'}
      </button>
      {open && (
        <div className="v2-card" style={{ marginTop: '0.5rem', padding: 'var(--v2-space-3)' }}>
          <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
            Exact email match only -- no name guessing, to avoid ever DMing the wrong person.
          </p>
          <div className="v2-btn-row" style={{ marginBottom: '0.5rem' }}>
            <input type="email" placeholder="partner@email.com" value={email} onChange={e => setEmail(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }} />
            <button type="button" className="v2-btn" disabled={status?.loading} onClick={lookup}>Look up by email</button>
          </div>
          {status?.found === false && <p className="v2-placeholder-note">No exact match found in Slack -- enter the id manually instead.</p>}
          {status?.error && <div className="v2-form-message error">{status.error}</div>}
          <div className="v2-btn-row">
            <input type="text" placeholder="Or paste a confirmed Slack user id" value={manualId} onChange={e => setManualId(e.target.value)}
              style={{ flex: '1 1 200px', padding: '0.4rem 0.6rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }} />
            <button type="button" className="v2-btn" disabled={!manualId.trim()} onClick={saveManual}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

// V1's "Recommended Companies" tab -- for each watched partner profile, real companies from
// Elephant Edge's own DB that the partner (based on their real, classified sells_to/industry)
// could be introduced to, approve/reject, then an auto-drafted outreach message per partner once
// at least one company is approved. Backed entirely by app/phases/gtm_partner_matching.py +
// gtm_partner_messaging.py -- no new backend work, this is a straight port.
function RecommendedCompaniesTab() {
  const [profiles, setProfiles] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [messages, setMessages] = useState(null)
  const [draftingMessage, setDraftingMessage] = useState(false)

  const loadProfiles = () => getNetworkProfiles().then(setProfiles).catch(err => setError(formatApiError(err)))
  const loadRecommendations = () => getNetworkRecommendations().then(setRecommendations).catch(err => setError(formatApiError(err)))
  useEffect(() => { loadProfiles(); loadRecommendations() }, [])

  const loadMessages = (profileId) => getNetworkRecommendationMessages(profileId).then(setMessages).catch(err => setError(formatApiError(err)))
  useEffect(() => {
    if (selectedId) { setMessages(null); loadMessages(selectedId) }
  }, [selectedId])

  const recsByProfile = {}
  ;(recommendations || []).forEach(r => {
    if (!recsByProfile[r.profile_id]) recsByProfile[r.profile_id] = []
    recsByProfile[r.profile_id].push(r)
  })

  const filteredProfiles = (profiles || []).filter(p => {
    if (roleFilter === 'cro' && !p.is_cro) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (p.name || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q)
  })

  const selectedProfile = (profiles || []).find(p => p.id === selectedId)
  const selectedRecs = recsByProfile[selectedId] || []

  const runMatching = (profileId) => {
    setMatching(true); setMatchResult(null)
    runNetworkPartnerMatching({ onlyNewProfiles: !profileId, profileId })
      .then(res => { setMatchResult(res); loadRecommendations() })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setMatching(false))
  }

  const setRecStatus = (recId, status) => {
    updateNetworkRecommendation(recId, status).then(() => { loadRecommendations(); if (status === 'approved') loadMessages(selectedId) }).catch(err => setError(formatApiError(err)))
  }

  const draftMessage = () => {
    setDraftingMessage(true)
    generateNetworkRecommendationMessage(selectedId).then(() => loadMessages(selectedId)).catch(err => setError(formatApiError(err))).finally(() => setDraftingMessage(false))
  }

  if (error) return <div className="v2-card"><div className="v2-state v2-state-error">{error}</div></div>

  if (!selectedId) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
          <input
            type="text" placeholder="Search name or company..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 260px', maxWidth: 320, padding: '0.5rem 0.75rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }}
          />
          <button type="button" className={`v2-config-tab${roleFilter === 'all' ? ' active' : ''}`} onClick={() => setRoleFilter('all')}>All</button>
          <button type="button" className={`v2-config-tab${roleFilter === 'cro' ? ' active' : ''}`} onClick={() => setRoleFilter('cro')}>CRO</button>
        </div>
        <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
          Watched partners matched against Elephant Edge's own company DB, based on each partner's real, classified specialty -- click a partner to review and approve matches.
        </p>
        {profiles === null || recommendations === null ? (
          <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 240 }} />
        ) : filteredProfiles.length === 0 ? (
          <div className="v2-card"><div className="v2-state">No partners match.</div></div>
        ) : (
          <div className="v2-evidence-list">
            {filteredProfiles.map(p => {
              const recs = recsByProfile[p.id] || []
              return (
                <div key={p.id} className="v2-evidence-item" style={{ cursor: 'pointer' }} onClick={() => setSelectedId(p.id)}>
                  <div className="v2-evidence-item-head">
                    <span className="v2-evidence-item-title">{p.name || `Profile #${p.id}`}{p.company ? ` · ${p.company}` : ''}</span>
                    {recs.length > 0 && <span className="v2-badge v2-badge-neutral">{recs.length} matched</span>}
                  </div>
                  <div className="v2-evidence-item-body">{p.sells_to || p.industry || 'No specialty on file'}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <button type="button" className="v2-btn" style={{ marginBottom: '0.9rem' }} onClick={() => setSelectedId(null)}>&larr; Back to all partners</button>

      <div className="v2-card" style={{ marginBottom: '1rem' }}>
        <div className="v2-evidence-item-head">
          <span className="v2-evidence-item-title">{selectedProfile?.name || 'Unknown partner'}{selectedProfile?.company ? ` · ${selectedProfile.company}` : ''}</span>
          {selectedProfile?.linkedin_url && <a href={selectedProfile.linkedin_url} target="_blank" rel="noopener noreferrer">Profile &rarr;</a>}
        </div>
        <div className="v2-kv-value" style={{ marginBottom: '0.6rem' }}><strong>Specialty:</strong> {selectedProfile?.sells_to || selectedProfile?.industry || 'Unknown'}</div>
        {selectedProfile && <SlackIdentity profile={selectedProfile} onChanged={loadProfiles} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="v2-section-title" style={{ margin: 0 }}>Matched companies</div>
        <button type="button" className="v2-btn" disabled={matching} onClick={() => runMatching(selectedId)}>
          <IconRefreshCw width={13} height={13} /> {matching ? 'Matching...' : selectedRecs.length > 0 ? 'Re-run matching' : 'Run matching for this partner'}
        </button>
      </div>
      {matchResult && (
        <p className="v2-placeholder-note" style={{ marginTop: 0 }}>
          {matchResult.status === 'paused' ? 'Matching schedule is paused.' : `${matchResult.recommendations_created ?? 0} new match(es) found.`}
        </p>
      )}
      {selectedRecs.length === 0 ? (
        <div className="v2-card" style={{ marginBottom: '1.25rem' }}><div className="v2-state">No companies matched yet -- click "Run matching for this partner" above.</div></div>
      ) : (
        <div className="v2-evidence-list" style={{ marginBottom: '1.25rem' }}>
          {selectedRecs.map(r => (
            <div key={r.id} className="v2-evidence-item">
              <div className="v2-evidence-item-head">
                <span className="v2-evidence-item-title">{r.company_name || `#${r.company_id}`}</span>
                <span className={`v2-badge ${REC_STATUS_BADGE[r.status] || 'v2-badge-neutral'}`}>{r.status}</span>
              </div>
              <div className="v2-evidence-item-body">{r.match_reasoning}</div>
              {r.match_confidence && <p className="v2-kv-label" style={{ marginTop: 4 }}>Confidence: {r.match_confidence}</p>}
              {r.status === 'proposed' && (
                <div className="v2-btn-row" style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="v2-btn v2-btn-primary" onClick={() => setRecStatus(r.id, 'approved')}><IconCheck width={13} height={13} /> Approve</button>
                  <button type="button" className="v2-btn v2-btn-danger" onClick={() => setRecStatus(r.id, 'rejected')}><IconX width={13} height={13} /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="v2-section-title" style={{ margin: 0 }}>Outreach message</div>
        <button type="button" className="v2-btn" disabled={draftingMessage} onClick={draftMessage}>
          {draftingMessage ? 'Drafting...' : 'Draft message from approved companies'}
        </button>
      </div>
      {messages === null ? (
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 120 }} />
      ) : messages.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No message drafted yet. Approve at least one company above, then draft one.</div></div>
      ) : (
        messages.map(m => <RecommendationMessage key={m.id} message={m} profile={selectedProfile} onChanged={() => loadMessages(selectedId)} />)
      )}
    </div>
  )
}

function SettingsTab() {
  const [keywords, setKeywords] = useState(null)
  const [error, setError] = useState(null)
  const [newProfile, setNewProfile] = useState({ name: '', company: '', linkedin_url: '' })
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getNetworkKeywords().then(setKeywords).catch(err => setError(formatApiError(err)))
  }, [])

  const save = (next) => {
    setKeywords(next)
    putNetworkKeywords(next).catch(err => setError(formatApiError(err)))
  }

  const removeKeyword = (tier, kw) => save({ ...keywords, [tier]: keywords[tier].filter(k => k !== kw) })

  const allEmpty = keywords && Object.values(keywords).every(kws => kws.length === 0)

  const handleAddProfile = () => {
    if (!newProfile.linkedin_url.trim()) { setAddError('LinkedIn URL is required'); return }
    setAdding(true)
    setAddError(null)
    addNetworkProfile(newProfile)
      .then(() => setNewProfile({ name: '', company: '', linkedin_url: '' }))
      .catch(err => setAddError(formatApiError(err)))
      .finally(() => setAdding(false))
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="v2-card">
        <div className="v2-section-title">Add a profile to watch</div>
        {addError && <p className="v2-state v2-state-error" style={{ padding: 0, background: 'none' }}>{addError}</p>}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '0.6rem' }}>
          <input type="text" placeholder="Name" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }} />
          <input type="text" placeholder="Company" value={newProfile.company} onChange={e => setNewProfile({ ...newProfile, company: e.target.value })}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }} />
          <input type="text" placeholder="https://www.linkedin.com/in/..." value={newProfile.linkedin_url} onChange={e => setNewProfile({ ...newProfile, linkedin_url: e.target.value })}
            style={{ flex: '1 1 260px', padding: '0.5rem 0.75rem', borderRadius: 'var(--v2-radius)', border: '1px solid var(--v2-border)', background: 'var(--v2-surface)', color: 'var(--v2-text)' }} />
          <button type="button" className="v2-btn v2-btn-primary" disabled={adding} onClick={handleAddProfile}>{adding ? 'Adding...' : 'Add'}</button>
        </div>
      </div>

      <div className="v2-card">
        <div className="v2-section-title">Keyword taxonomy</div>
        {error && <p className="v2-state v2-state-error" style={{ padding: 0, background: 'none' }}>{error}</p>}
        {allEmpty && (
          <p className="v2-placeholder-note">Every tier is empty — the monitor captures and alerts on ALL activity from watched profiles, unfiltered.</p>
        )}
        {keywords === null ? (
          <div className="v2-skeleton-row" />
        ) : (
          Object.entries(keywords).map(([tier, kws]) => (
            <div key={tier} style={{ marginBottom: '1rem' }}>
              <div className="v2-kv-label" style={{ marginBottom: '0.4rem' }}>{tier}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {kws.map(kw => (
                  <span key={kw} className="v2-badge v2-badge-neutral" style={{ cursor: 'pointer' }} onClick={() => removeKeyword(tier, kw)} title="Click to remove">
                    {kw} ×
                  </span>
                ))}
                {kws.length === 0 && <span className="v2-kv-label">(empty)</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Network() {
  const [tab, setTab] = useState(TABS[0])
  const [classifying, setClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState(null)

  const runClassify = (afterLoad) => {
    setClassifying(true)
    runNetworkClassification(true)
      .then(res => {
        setClassifyResult(res)
        if (afterLoad) afterLoad()
      })
      .finally(() => setClassifying(false))
  }

  return (
    <div>
      <div className="v2-config-tabs">
        {TABS.map(t => (
          <button key={t} type="button" className={`v2-config-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div style={{ marginTop: '1.2rem' }}>
        {tab === 'Signal Feed' && <SignalFeedTab />}
        {tab === 'Watched Profiles' && <WatchedProfilesTab classifying={classifying} classifyResult={classifyResult} onClassify={runClassify} />}
        {tab === 'Partner Matches' && <PartnerMatchesTab classifying={classifying} onClassify={runClassify} />}
        {tab === 'Recommended Companies' && <RecommendedCompaniesTab />}
        {tab === 'Settings' && <SettingsTab />}
      </div>
    </div>
  )
}
