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

// Elephant Edge only. Watches a fixed list of LinkedIn profiles (competitors, partners,
// ecosystem people from targetedcompanies.md) for new posts matching a GTM keyword taxonomy --
// see app/phases/linkedin_monitor.py. Two views: the signal feed (what actually matched, most
// recent first) and the profile list (who's being watched, when they were last checked).
export default function Targets() {
  const { tenantSlug } = useParams()
  const [view, setView] = useState('signals') // 'signals' | 'profiles'

  const [signals, setSignals] = useState([])
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [signalsError, setSignalsError] = useState(null)

  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profilesError, setProfilesError] = useState(null)
  const [profileSearch, setProfileSearch] = useState('')

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setSignalsLoading(true)
    client.get('/linkedin-monitor/signals', { params: { limit: 100 } })
      .then(res => setSignals(res.data))
      .catch(err => setSignalsError(err.response?.data?.detail || err.message))
      .finally(() => setSignalsLoading(false))
  }, [tenantSlug])

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setProfilesLoading(true)
    client.get('/linkedin-monitor/profiles')
      .then(res => setProfiles(res.data))
      .catch(err => setProfilesError(err.response?.data?.detail || err.message))
      .finally(() => setProfilesLoading(false))
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

  const activeCount = profiles.filter(p => p.active).length

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
      </div>

      {view === 'signals' ? (
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
                    {s.profile_name && s.author_name && s.profile_name !== s.author_name && (
                      <span className="hint"> &middot; {s.profile_name}</span>
                    )}
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
      ) : (
        <div className="overview-card">
          <input
            type="text"
            placeholder="Search name or company..."
            value={profileSearch}
            onChange={e => setProfileSearch(e.target.value)}
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
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => (
                  <tr key={p.id}>
                    <td>{p.name || '-'}</td>
                    <td>{p.company || '-'}</td>
                    <td><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">Profile &rarr;</a></td>
                    <td><span className={`status-pill status-pill-sm ${p.active ? 'on' : 'off'}`}>{p.active ? 'Active' : 'Paused'}</span></td>
                    <td>{p.last_checked_at ? timeAgo(p.last_checked_at) : 'Not yet checked'}</td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr><td colSpan={5} className="empty-state">{profilesLoading ? 'Loading...' : 'No profiles match.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
