import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

function timeAgo(iso) {
  if (!iso) return ''
  // Backend timestamps are naive UTC -- a string with no "Z"/offset gets parsed as LOCAL time
  // by JS, silently shifting it by the browser's UTC offset (same fix as NotificationBell.jsx).
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const TIER_CLASS = {
  'Tier 1: Direct signals': 'tier-hot',
  'Tier 2: Workflow signals': 'tier-warm',
  'Tier 3: Strategic signals': 'tier-cool',
  'Tier 4: Competitive signals': 'tier-excluded',
}

const TIER_SHORT = {
  'Tier 1: Direct signals': 'Direct',
  'Tier 2: Workflow signals': 'Workflow',
  'Tier 3: Strategic signals': 'Strategic',
  'Tier 4: Competitive signals': 'Competitive',
}

const ACTION_PILL_CLASS = { engage: 'on', monitor: 'warn', ignore: 'off' }

const PROFILES_PAGE_SIZE = 10

// "1d 2h 30m" -- compact, real, from the schedule's own days/hours/minutes fields (never
// re-derived from interval_minutes, which is the backend's OWN pre-computed total, not a
// second source of truth to keep in sync by hand).
function formatSchedule(days, hours, minutes) {
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes || parts.length === 0) parts.push(`${minutes}m`)
  return parts.join(' ')
}

// Elephant Edge only. Watches a fixed list of LinkedIn profiles (competitors, partners,
// ecosystem people) for new posts matching a GTM keyword taxonomy -- see
// app/phases/linkedin_monitor.py. Three views: the signal feed (what actually matched, most
// recent first), the profile list (who's being watched), and Settings (keyword taxonomy +
// profile add/remove -- both editable here, not in code, so this list never needs a deploy).
export default function Targets() {
  const { tenantSlug } = useParams()
  const [view, setView] = useState('signals') // 'signals' | 'profiles' | 'partners' | 'settings'

  const [partnerMatches, setPartnerMatches] = useState(null)
  const [partnerMatchesError, setPartnerMatchesError] = useState(null)
  const [classifying, setClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState(null)

  const [signals, setSignals] = useState([])
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [signalsError, setSignalsError] = useState(null)

  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profilesError, setProfilesError] = useState(null)
  const [profileSearch, setProfileSearch] = useState('')
  const [profilePage, setProfilePage] = useState(1)
  const [signalFilter, setSignalFilter] = useState('relevant') // 'relevant' | 'engage' | 'monitor' | 'ignored' | 'all'

  const [keywords, setKeywords] = useState(null)
  const [keywordsLoading, setKeywordsLoading] = useState(true)
  const [keywordsError, setKeywordsError] = useState(null)
  const [keywordsSaving, setKeywordsSaving] = useState(false)
  const [newKeywordByTier, setNewKeywordByTier] = useState({})

  const [newProfile, setNewProfile] = useState({ name: '', company: '', linkedin_url: '' })
  const [addingProfile, setAddingProfile] = useState(false)
  const [addProfileError, setAddProfileError] = useState(null)

  const [schedule, setSchedule] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ days: 0, hours: 0, minutes: 45, enabled: true })
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  const loadSchedule = () => {
    setScheduleLoading(true)
    client.get('/linkedin-monitor/schedule')
      .then(res => { setSchedule(res.data); setScheduleForm({ days: res.data.days, hours: res.data.hours, minutes: res.data.minutes, enabled: res.data.enabled }) })
      .catch(err => setScheduleError(err.response?.data?.detail || err.message))
      .finally(() => setScheduleLoading(false))
  }

  const saveSchedule = (overrides = {}) => {
    const next = { ...scheduleForm, ...overrides }
    setScheduleSaving(true)
    setScheduleError(null)
    client.put('/linkedin-monitor/schedule', next)
      .then(res => { setSchedule(res.data); setScheduleForm({ days: res.data.days, hours: res.data.hours, minutes: res.data.minutes, enabled: res.data.enabled }) })
      .catch(err => setScheduleError(err.response?.data?.detail || err.message))
      .finally(() => setScheduleSaving(false))
  }

  const loadSignals = () => {
    setSignalsLoading(true)
    client.get('/linkedin-monitor/signals', { params: { limit: 100 } })
      .then(res => setSignals(res.data))
      .catch(err => setSignalsError(err.response?.data?.detail || err.message))
      .finally(() => setSignalsLoading(false))
  }

  const loadProfiles = () => {
    setProfilesLoading(true)
    client.get('/linkedin-monitor/profiles')
      .then(res => setProfiles(res.data))
      .catch(err => setProfilesError(err.response?.data?.detail || err.message))
      .finally(() => setProfilesLoading(false))
  }

  const loadKeywords = () => {
    setKeywordsLoading(true)
    client.get('/linkedin-monitor/keywords')
      .then(res => setKeywords(res.data))
      .catch(err => setKeywordsError(err.response?.data?.detail || err.message))
      .finally(() => setKeywordsLoading(false))
  }

  const loadPartnerMatches = () => {
    client.get('/linkedin-monitor/partner-matches')
      .then(res => setPartnerMatches(res.data))
      .catch(err => setPartnerMatchesError(err.response?.data?.detail || err.message))
  }

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    loadSignals()
    loadProfiles()
    loadKeywords()
    loadPartnerMatches()
    loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  const runClassification = (onlyUnclassified) => {
    setClassifying(true)
    setClassifyResult(null)
    client.post('/linkedin-monitor/classify', null, { params: { only_unclassified: onlyUnclassified } })
      .then(res => {
        setClassifyResult(res.data)
        loadProfiles()
        loadPartnerMatches()
      })
      .catch(err => setPartnerMatchesError(err.response?.data?.detail || err.message))
      .finally(() => setClassifying(false))
  }

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Targets</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  const filteredProfiles = profiles.filter(p => {
    const q = profileSearch.trim().toLowerCase()
    if (!q) return true
    return (p.name || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q)
  })
  const totalProfilePages = Math.max(1, Math.ceil(filteredProfiles.length / PROFILES_PAGE_SIZE))
  const pagedProfiles = filteredProfiles.slice((profilePage - 1) * PROFILES_PAGE_SIZE, profilePage * PROFILES_PAGE_SIZE)

  const activeCount = profiles.filter(p => p.active).length

  const saveKeywords = (next) => {
    setKeywords(next)
    setKeywordsSaving(true)
    client.put('/linkedin-monitor/keywords', next)
      .catch(err => setKeywordsError(err.response?.data?.detail || err.message))
      .finally(() => setKeywordsSaving(false))
  }

  const removeKeyword = (tier, keyword) => {
    const next = { ...keywords, [tier]: keywords[tier].filter(k => k !== keyword) }
    saveKeywords(next)
  }

  const addKeyword = (tier) => {
    const value = (newKeywordByTier[tier] || '').trim()
    if (!value) return
    const next = { ...keywords, [tier]: [...(keywords[tier] || []), value] }
    saveKeywords(next)
    setNewKeywordByTier({ ...newKeywordByTier, [tier]: '' })
  }

  const removeProfile = (id) => {
    client.delete(`/linkedin-monitor/profiles/${id}`)
      .then(loadProfiles)
      .catch(() => {})
  }

  const toggleProfileActive = (p) => {
    client.patch(`/linkedin-monitor/profiles/${p.id}`, null, { params: { active: !p.active } })
      .then(loadProfiles)
      .catch(() => {})
  }

  const addProfile = () => {
    if (!newProfile.linkedin_url.trim()) {
      setAddProfileError('LinkedIn URL is required')
      return
    }
    setAddingProfile(true)
    setAddProfileError(null)
    client.post('/linkedin-monitor/profiles', null, { params: newProfile })
      .then(() => {
        setNewProfile({ name: '', company: '', linkedin_url: '' })
        loadProfiles()
      })
      .catch(err => setAddProfileError(err.response?.data?.detail || err.message))
      .finally(() => setAddingProfile(false))
  }

  return (
    <div className="page page-wide">
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Profiles Watched</div>
          <div className="stat-value">{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Signals Detected</div>
          <div className="stat-value">{signals.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Poll Interval</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {scheduleLoading ? '...' : schedule ? (schedule.enabled ? `Every ${formatSchedule(schedule.days, schedule.hours, schedule.minutes)}` : 'Paused') : 'Every 45 min'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={view === 'signals' ? '' : 'secondary'} onClick={() => setView('signals')}>Signal Feed</button>
        <button type="button" className={view === 'profiles' ? '' : 'secondary'} onClick={() => setView('profiles')}>Watched Profiles</button>
        <button type="button" className={view === 'partners' ? '' : 'secondary'} onClick={() => setView('partners')}>Partner Matches</button>
        <button type="button" className={view === 'settings' ? '' : 'secondary'} onClick={() => setView('settings')}>Settings</button>
      </div>

      {view === 'signals' && (
        <div className="overview-card">
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { key: 'relevant', label: 'Relevant (engage + monitor)' },
              { key: 'engage', label: 'Engage only' },
              { key: 'monitor', label: 'Monitor only' },
              { key: 'ignored', label: 'Ignored by AI' },
              { key: 'all', label: 'All' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                className={signalFilter === f.key ? '' : 'secondary'}
                style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                onClick={() => setSignalFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {signalsError && <p className="error">{signalsError}</p>}
          {!signalsError && signals.length === 0 && (
            <p className="empty-state">
              {signalsLoading ? 'Loading...' : `No signals detected yet -- the monitor checks ${schedule ? (schedule.enabled ? `every ${formatSchedule(schedule.days, schedule.hours, schedule.minutes)}` : 'is currently paused') : 'periodically'}.`}
            </p>
          )}
          <div className="activity-timeline">
            {signals.filter(s => {
              if (signalFilter === 'all') return true
              if (signalFilter === 'relevant') return s.recommended_action !== 'ignore'
              if (signalFilter === 'ignored') return s.recommended_action === 'ignore'
              return s.recommended_action === signalFilter
            }).map(s => (
              <div
                key={s.id}
                style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem', marginBottom: '0.85rem',
                  background: s.recommended_action === 'ignore' ? 'var(--surface-alt)' : 'var(--surface)',
                  opacity: s.recommended_action === 'ignore' ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div>
                    <strong>{s.author_name || s.profile_name || 'Unknown'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {s.recommended_action && (
                      <span className={`status-pill status-pill-sm ${ACTION_PILL_CLASS[s.recommended_action] || 'off'}`}>
                        {s.recommended_action}{s.relevance_score != null ? ` · ${s.relevance_score}` : ''}
                      </span>
                    )}
                    <span className={`tier-badge ${TIER_CLASS[s.tier] || 'tier-excluded'}`}>{TIER_SHORT[s.tier] || s.tier}</span>
                  </div>
                </div>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.88rem', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {s.post_text}
                </p>
                {s.classifier_reason && (
                  <p className="hint" style={{ margin: '0 0 0.6rem', fontStyle: 'italic' }}>{s.classifier_reason}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
                  {(s.matched_keywords || []).map(kw => (
                    <span key={kw} className="status-pill status-pill-sm off">{kw}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="hint">{timeAgo(s.posted_at)}{s.alerted_at ? ' · Alerted' : ''}</span>
                  {s.post_url && (
                    <a href={s.post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>
                      View post &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'profiles' && (
        <div className="overview-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <input
              type="text"
              placeholder="Search name or company..."
              value={profileSearch}
              onChange={e => { setProfileSearch(e.target.value); setProfilePage(1) }}
              style={{ width: '100%', maxWidth: 320, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            />
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="secondary btn-small" disabled={classifying} onClick={() => runClassification(true)}>
                {classifying ? 'Classifying...' : 'Classify unclassified'}
              </button>
              {classifyResult && (
                <p className="hint" style={{ margin: '0.3rem 0 0' }}>
                  {classifyResult.classified} classified, {classifyResult.insufficient_evidence} insufficient evidence, {classifyResult.failed} failed
                </p>
              )}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
            Industry / Sells to are inferred from each profile's company name, a real web search about the company, and their own captured posts -- grows more accurate as more of their activity is captured. A profile with no evidence yet stays unclassified rather than guessed.
          </p>
          {profilesError && <p className="error">{profilesError}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>Sells to</th>
                  <th>LinkedIn</th>
                  <th>Status</th>
                  <th>Last Checked</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedProfiles.map(p => (
                  <tr key={p.id}>
                    <td>{p.name || '-'}</td>
                    <td>{p.company || '-'}</td>
                    <td>{p.industry || (p.classification_status === 'insufficient_evidence' ? <span className="hint">insufficient evidence</span> : '-')}</td>
                    <td>{p.sells_to || '-'}</td>
                    <td><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">Profile &rarr;</a></td>
                    <td>
                      <span
                        className={`status-pill status-pill-sm ${p.active ? 'on' : 'off'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleProfileActive(p)}
                        title="Click to toggle"
                      >
                        {p.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>{p.last_checked_at ? timeAgo(p.last_checked_at) : 'Not yet checked'}</td>
                    <td><button type="button" className="link-button" onClick={() => removeProfile(p.id)}>Remove</button></td>
                  </tr>
                ))}
                {pagedProfiles.length === 0 && (
                  <tr><td colSpan={8} className="empty-state">{profilesLoading ? 'Loading...' : 'No profiles match.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalProfilePages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="button" className="secondary btn-small" disabled={profilePage <= 1} onClick={() => setProfilePage(p => p - 1)}>&larr; Prev</button>
              <span className="hint">Page {profilePage} of {totalProfilePages} ({filteredProfiles.length} profiles)</span>
              <button type="button" className="secondary btn-small" disabled={profilePage >= totalProfilePages} onClick={() => setProfilePage(p => p + 1)}>Next &rarr;</button>
            </div>
          )}
        </div>
      )}

      {view === 'partners' && (
        <div className="overview-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <div>
              <h3 className="overview-card-title" style={{ marginBottom: '0.3rem' }}>Candidate referral partners</h3>
              <p className="hint" style={{ margin: 0 }}>
                Watched companies in DIFFERENT industries who sell to the same real, stated buyer type -- worth introducing to each other.
                Grouped only from companies you've already classified below.
              </p>
            </div>
            <button type="button" className="secondary btn-small" disabled={classifying} onClick={() => runClassification(true)}>
              {classifying ? 'Classifying...' : 'Classify unclassified'}
            </button>
          </div>
          {partnerMatchesError && <p className="error">{partnerMatchesError}</p>}
          {partnerMatches && (
            <p className="hint" style={{ marginBottom: '1rem' }}>
              {partnerMatches.classified_count} of {partnerMatches.total_active_profiles} watched profiles classified so far.
            </p>
          )}
          {!partnerMatches ? (
            <p className="empty-state">Loading...</p>
          ) : partnerMatches.clusters.length === 0 ? (
            <p className="empty-state">
              No cross-industry matches yet. Click "Classify unclassified" above -- classification needs at least a company name (used to run a real web search) or some captured posts per profile.
            </p>
          ) : (
            partnerMatches.clusters.map(cluster => (
              <div key={cluster.sells_to} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <strong>Sells to: {cluster.sells_to}</strong>
                  <span className="hint">{cluster.member_count} companies · {cluster.industries_represented.length} industries</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
                  {cluster.industries_represented.map(ind => (
                    <span key={ind} className="status-pill status-pill-sm off">{ind}</span>
                  ))}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Company</th><th>Industry</th><th>Confidence</th><th></th></tr>
                    </thead>
                    <tbody>
                      {cluster.members.map(m => (
                        <tr key={m.id}>
                          <td>{m.name || '-'}</td>
                          <td>{m.company || '-'}</td>
                          <td>{m.industry}</td>
                          <td>{m.confidence || '-'}</td>
                          <td><a href={m.linkedin_url} target="_blank" rel="noopener noreferrer">Profile &rarr;</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {view === 'settings' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="overview-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="overview-card-title">Monitor Schedule</h3>
              {scheduleSaving && <span className="hint">Saving...</span>}
            </div>
            {scheduleError && <p className="error">{scheduleError}</p>}
            {scheduleLoading && <p className="hint">Loading...</p>}
            {schedule && (
              <>
                <p className="hint" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
                  How often the monitor checks watched profiles for new posts. Each check only pulls posts since the
                  last check, so a shorter interval finds new posts sooner -- it doesn't re-fetch older ones.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.9rem' }}>
                  <div>
                    <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>Days</label>
                    <input
                      type="number" min="0" value={scheduleForm.days}
                      onChange={e => setScheduleForm({ ...scheduleForm, days: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      style={{ width: 80, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>Hours</label>
                    <input
                      type="number" min="0" max="23" value={scheduleForm.hours}
                      onChange={e => setScheduleForm({ ...scheduleForm, hours: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      style={{ width: 80, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>Minutes</label>
                    <input
                      type="number" min="0" max="59" value={scheduleForm.minutes}
                      onChange={e => setScheduleForm({ ...scheduleForm, minutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      style={{ width: 80, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <button type="button" onClick={() => saveSchedule()} disabled={scheduleSaving}>
                    {scheduleSaving ? 'Saving...' : 'Save interval'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className={`status-pill status-pill-sm ${scheduleForm.enabled ? 'on' : 'off'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setScheduleForm({ ...scheduleForm, enabled: !scheduleForm.enabled }); saveSchedule({ enabled: !scheduleForm.enabled }) }}
                    title="Click to toggle"
                  >
                    {scheduleForm.enabled ? 'Running' : 'Paused'}
                  </span>
                  <span className="hint">
                    {scheduleForm.enabled
                      ? 'Click to pause -- watched profiles stop being checked until resumed.'
                      : 'Click to resume checking watched profiles.'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="overview-card">
            <h3 className="overview-card-title">Add a Profile to Watch</h3>
            {addProfileError && <p className="error">{addProfileError}</p>}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>Name</label>
                <input type="text" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>Company</label>
                <input type="text" value={newProfile.company} onChange={e => setNewProfile({ ...newProfile, company: e.target.value })}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label className="hint" style={{ display: 'block', marginBottom: '0.3rem' }}>LinkedIn URL *</label>
                <input type="text" value={newProfile.linkedin_url} onChange={e => setNewProfile({ ...newProfile, linkedin_url: e.target.value })}
                  placeholder="https://www.linkedin.com/in/..."
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              </div>
              <button type="button" onClick={addProfile} disabled={addingProfile}>{addingProfile ? 'Adding...' : 'Add Profile'}</button>
            </div>
            <p className="hint" style={{ marginTop: '0.75rem' }}>To remove a profile, use the "Remove" link in the Watched Profiles tab.</p>
          </div>

          <div className="overview-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="overview-card-title">Keyword Taxonomy</h3>
              {keywordsSaving && <span className="hint">Saving...</span>}
            </div>
            {keywordsError && <p className="error">{keywordsError}</p>}
            {keywordsLoading && <p className="hint">Loading...</p>}
            {keywords && Object.values(keywords).every(kws => kws.length === 0) && (
              <p className="hint" style={{ marginBottom: '1rem' }}>
                Every tier is empty — the monitor will capture and alert on ALL activity from watched profiles, unfiltered.
              </p>
            )}
            {keywords && Object.entries(keywords).map(([tier, kws]) => (
              <div key={tier} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className={`tier-badge ${TIER_CLASS[tier] || 'tier-excluded'}`}>{TIER_SHORT[tier] || tier}</span>
                  <strong style={{ fontSize: '0.85rem' }}>{tier}</strong>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {kws.map(kw => (
                    <span key={kw} className="status-pill status-pill-sm off" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(tier, kw)}
                        aria-label={`Remove ${kw}`}
                        style={{ background: 'none', boxShadow: 'none', padding: 0, color: 'inherit', fontWeight: 700, lineHeight: 1, minWidth: 'auto' }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Add keyword..."
                    value={newKeywordByTier[tier] || ''}
                    onChange={e => setNewKeywordByTier({ ...newKeywordByTier, [tier]: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addKeyword(tier) }}
                    style={{ padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                  <button type="button" className="secondary btn-small" onClick={() => addKeyword(tier)}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
