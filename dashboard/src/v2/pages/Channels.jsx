import { useEffect, useState } from 'react'
import { getChannelIntelligence, getOwnLinkedinContent, syncOwnLinkedinContent, setOwnLinkedinProfileUrl, formatApiError } from '../api.js'
import { IconAlertTriangle } from '../icons.jsx'

const CHANNEL_LABELS = {
  personal_network: 'Personal network',
  linkedin_content: 'LinkedIn content',
  inbound: 'Inbound (website)',
  webinar: 'Webinars',
  outbound: 'Outbound',
  other: 'Other',
}

function formatUsd(value) {
  if (!value) return '$0'
  return `$${Number(value).toLocaleString()}`
}

function ChannelCard({ channelKey, stats }) {
  const isActive = stats.meetings_with_recorded_outcome > 0
  return (
    <div className="v2-card" style={{ marginBottom: '1rem', opacity: isActive ? 1 : 0.7 }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{CHANNEL_LABELS[channelKey] || channelKey}</span>
        {!isActive && <span className="v2-badge v2-badge-neutral">No outcomes recorded yet</span>}
      </div>

      <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
        <div>
          <div className="v2-kv-label">Meetings with recorded outcome</div>
          <div className="v2-kv-value">{stats.meetings_with_recorded_outcome}</div>
        </div>
        <div>
          <div className="v2-kv-label">Deals won / lost</div>
          <div className="v2-kv-value">{stats.deals_won} / {stats.deals_lost}</div>
        </div>
        <div>
          <div className="v2-kv-label">Revenue won</div>
          <div className="v2-kv-value">{formatUsd(stats.revenue_won_usd)}</div>
        </div>
      </div>
    </div>
  )
}

// Same "genuinely reasons, but every claim is server-side verified against real numbers before
// this page ever sees it" discipline as Campaigns.jsx's IntelligenceSection.
function IntelligenceSection({ intelligence }) {
  if (intelligence.status === 'insufficient_data') {
    return (
      <div className="v2-card">
        <div className="v2-state">Not enough real recorded meeting outcomes yet to compare channels.</div>
      </div>
    )
  }
  if (intelligence.status === 'llm_unavailable' || intelligence.status === 'discarded') {
    return (
      <div className="v2-card">
        <div className="v2-state">
          {intelligence.status === 'discarded'
            ? "Couldn't generate a trustworthy comparison this time — discarded rather than shown ungrounded."
            : 'Reasoning is temporarily unavailable — the real numbers above are still accurate.'}
        </div>
      </div>
    )
  }
  return (
    <div className="v2-card">
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">Which channel is actually producing revenue</span>
        <span className="v2-badge v2-badge-neutral">AI-reasoned, grounded in the numbers above</span>
      </div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 0 }}>{intelligence.diagnosis}</p>
      <div className="v2-kv-label" style={{ marginTop: '0.8rem' }}>Priority recommendation</div>
      <p style={{ color: 'var(--v2-text)', fontSize: '0.92rem', lineHeight: 1.6, marginTop: 4, marginBottom: 0 }}>{intelligence.priority_recommendation}</p>
    </div>
  )
}

// Real, on-demand visibility into Majji's own LinkedIn posts (Channels Intelligence step 7) --
// deliberately separate from the revenue-attribution numbers above (outcome_channel already
// covers that). No engagement/likes data here -- see own_linkedin_content.py's own docstring for
// why that's explicitly out of scope rather than guessed at.
function OwnContentCard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [savingUrl, setSavingUrl] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const load = () => getOwnLinkedinContent().then(res => { setData(res); setUrlInput(res.profile_url || '') }).catch(err => setError(formatApiError(err)))

  useEffect(() => { load() }, [])

  const saveUrl = async () => {
    setSavingUrl(true)
    setError(null)
    try {
      await setOwnLinkedinProfileUrl(urlInput.trim())
      await load()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSavingUrl(false)
    }
  }

  const sync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setError(null)
    try {
      const res = await syncOwnLinkedinContent()
      setSyncResult(res)
      await load()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSyncing(false)
    }
  }

  if (error) {
    return <div className="v2-card v2-state v2-state-error">Couldn't load LinkedIn content: {error}</div>
  }
  if (data === null) {
    return <div className="v2-skeleton-row" style={{ height: 100 }} />
  }

  return (
    <div className="v2-card" style={{ marginTop: '1.5rem' }}>
      <div className="v2-config-card-head">
        <span className="v2-config-card-title">LinkedIn content</span>
        <span className="v2-badge v2-badge-neutral">Real posts, no engagement data</span>
      </div>

      <div className="v2-field" style={{ marginTop: '0.6rem' }}>
        <label className="v2-field-label">Tracked profile</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="v2-input" type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://www.linkedin.com/in/..." style={{ flex: 1 }} />
          <button type="button" className="v2-btn" disabled={savingUrl || !urlInput.trim() || urlInput.trim() === data.profile_url} onClick={saveUrl}>
            {savingUrl ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="v2-btn-row" style={{ marginTop: '0.6rem' }}>
        <button type="button" className="v2-btn" disabled={syncing || !data.profile_url} onClick={sync}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {syncResult && (
          <span className="v2-field-hint">
            {syncResult.status === 'ok' ? `${syncResult.new_posts} new post(s) found.` : syncResult.status === 'not_configured' ? 'No profile configured.' : `Sync failed: ${syncResult.error}`}
          </span>
        )}
      </div>

      {data.posts.length === 0 ? (
        <div className="v2-state" style={{ marginTop: '0.8rem' }}>No posts synced yet.</div>
      ) : (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {data.posts.map(p => (
            <div key={p.id} style={{ paddingTop: '0.6rem', borderTop: '1px solid var(--v2-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--v2-text)' }}>{(p.post_text || '').slice(0, 200)}{(p.post_text || '').length > 200 ? '…' : ''}</div>
              <div className="v2-field-hint" style={{ marginTop: 4 }}>
                {p.posted_at ? new Date(p.posted_at).toLocaleDateString() : 'Date unknown'}
                {p.post_url && <> · <a href={p.post_url} target="_blank" rel="noreferrer">View on LinkedIn</a></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Channels() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getChannelIntelligence().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load channels: {error}</div>
        </div>
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="v2-account-list">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 140 }} />)}
      </div>
    )
  }

  return (
    <div>
      <IntelligenceSection intelligence={data.intelligence} />
      <div style={{ marginTop: '1rem' }}>
        {Object.entries(data.by_channel).map(([key, stats]) => <ChannelCard key={key} channelKey={key} stats={stats} />)}
      </div>
      {data.unattributed_outcomes_count > 0 && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.8rem' }}>
          {data.unattributed_outcomes_count} recorded meeting outcome(s) have no channel attributed — record the channel on the Meetings page so they count here.
        </p>
      )}

      <OwnContentCard />
    </div>
  )
}
