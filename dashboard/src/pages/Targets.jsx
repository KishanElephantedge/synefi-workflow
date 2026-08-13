import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
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

const PROFILES_PAGE_SIZE = 10

// Elephant Edge only. Watches a fixed list of LinkedIn profiles (competitors, partners,
// ecosystem people) for new posts matching a GTM keyword taxonomy -- see
// app/phases/linkedin_monitor.py. Three views: the signal feed (what actually matched, most
// recent first), the profile list (who's being watched), and Settings (keyword taxonomy +
// profile add/remove -- both editable here, not in code, so this list never needs a deploy).
export default function Targets() {
  const { tenantSlug } = useParams()
  const [view, setView] = useState('signals') // 'signals' | 'profiles' | 'settings'

  const [signals, setSignals] = useState([])
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [signalsError, setSignalsError] = useState(null)

  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profilesError, setProfilesError] = useState(null)
  const [profileSearch, setProfileSearch] = useState('')
  const [profilePage, setProfilePage] = useState(1)

  const [keywords, setKeywords] = useState(null)
  const [keywordsLoading, setKeywordsLoading] = useState(true)
  const [keywordsError, setKeywordsError] = useState(null)
  const [keywordsSaving, setKeywordsSaving] = useState(false)
  const [newKeywordByTier, setNewKeywordByTier] = useState({})

  const [newProfile, setNewProfile] = useState({ name: '', company: '', linkedin_url: '' })
  const [addingProfile, setAddingProfile] = useState(false)
  const [addProfileError, setAddProfileError] = useState(null)

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

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    loadSignals()
    loadProfiles()
    loadKeywords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

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
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>Every 45 min</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={view === 'signals' ? '' : 'secondary'} onClick={() => setView('signals')}>Signal Feed</button>
        <button type="button" className={view === 'profiles' ? '' : 'secondary'} onClick={() => setView('profiles')}>Watched Profiles</button>
        <button type="button" className={view === 'settings' ? '' : 'secondary'} onClick={() => setView('settings')}>Settings</button>
      </div>

      {view === 'signals' && (
        <div className="overview-card">
          {signalsError && <p className="error">{signalsError}</p>}
          {!signalsError && signals.length === 0 && (
            <p className="empty-state">{signalsLoading ? 'Loading...' : 'No signals detected yet -- the monitor checks every 45 minutes.'}</p>
          )}
          <div className="activity-timeline">
            {signals.map(s => (
              <div
                key={s.id}
                style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem', marginBottom: '0.85rem', background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div>
                    <strong>{s.author_name || s.profile_name || 'Unknown'}</strong>
                  </div>
                  <span className={`tier-badge ${TIER_CLASS[s.tier] || 'tier-excluded'}`}>{TIER_SHORT[s.tier] || s.tier}</span>
                </div>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.88rem', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {s.post_text}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
                  {(s.matched_keywords || []).map(kw => (
                    <span key={kw} className="status-pill status-pill-sm off">{kw}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="hint">{timeAgo(s.posted_at)}{s.alerted_at ? ' · Slack alerted' : ''}</span>
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
          <input
            type="text"
            placeholder="Search name or company..."
            value={profileSearch}
            onChange={e => { setProfileSearch(e.target.value); setProfilePage(1) }}
            style={{ width: '100%', maxWidth: 320, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '0.9rem' }}
          />
          {profilesError && <p className="error">{profilesError}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
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
                  <tr><td colSpan={6} className="empty-state">{profilesLoading ? 'Loading...' : 'No profiles match.'}</td></tr>
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

      {view === 'settings' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
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
