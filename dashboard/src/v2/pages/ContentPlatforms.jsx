import { useEffect, useState } from 'react'
import {
  getContentOpportunities, reviewContentOpportunity, generateContentOpportunityDraft,
  generateAccountIntelligenceTopics, getContentPillars, getContentPillarDetail,
  generateContentPillar, reviewContentPillar, generateContentPillarDraft,
  reviewContentCluster, generateContentClusterDraft, formatApiError,
} from '../api.js'
import { IconCheck, IconX, IconRefreshCw, IconChevronDown, IconSparkles } from '../icons.jsx'
import { useTenant } from '../../context/TenantContext.jsx'

// Three platform-specific tabs on Market Intelligence (2026-09-19, explicit instruction), all
// backed by the same shared ContentOpportunity pool (content_opportunity.py) -- a topic/
// opportunity is platform-agnostic until a draft is requested, so all three tabs list the SAME
// real opportunities and differ only in which platform's draft they generate/show. Content
// Clusters (content_pillar.py) is Blogs-only, since it's a long-form SEO system with no
// linkedin/linkedin_article equivalent.

const ORIGIN_LABEL = { trend: 'Trending', competitor: 'Competitor', account_intelligence: 'Our accounts' }
const STATUS_BADGE = { candidate: 'v2-badge-warning', approved: 'v2-badge-success', rejected: 'v2-badge-danger', changes_requested: 'v2-badge-neutral' }

function ReviewRow({ onReview, busy }) {
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  return (
    <div>
      {showNote && (
        <textarea
          className="v2-textarea" value={note} onChange={e => setNote(e.target.value)}
          placeholder="What needs to change?" style={{ marginBottom: '0.6rem' }}
        />
      )}
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => onReview('approve', note)}>
          <IconCheck width={14} height={14} /> Approve
        </button>
        <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => onReview('reject', note)}>
          <IconX width={14} height={14} /> Reject
        </button>
        <button type="button" className="v2-btn" disabled={busy} onClick={() => (showNote ? onReview('request_changes', note) : setShowNote(true))}>
          {showNote ? 'Submit change request' : 'Request changes'}
        </button>
      </div>
    </div>
  )
}

function OpportunityCard({ o, platform, userEmail, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const draft = o.drafts?.[platform]

  const doReview = async (action, note) => {
    setBusy(true); setError(null)
    try {
      await reviewContentOpportunity(o.id, { action, reviewedBy: userEmail, note: note || null })
      onChanged()
    } catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }

  const doGenerateDraft = async () => {
    setBusy(true); setError(null)
    try {
      await generateContentOpportunityDraft(o.id, platform)
      onChanged()
    } catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }

  return (
    <div className="v2-card" style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{o.topic_name || '(topic deleted)'}</div>
          <div className="v2-placeholder-note" style={{ margin: '0.2rem 0 0' }}>
            {ORIGIN_LABEL[o.origin] || o.origin}{o.trend_state && o.trend_state !== 'account_pattern' ? ` · ${o.trend_state}` : ''}
          </div>
        </div>
        <span className={`v2-badge ${STATUS_BADGE[o.status] || 'v2-badge-neutral'}`}>{o.status.replace('_', ' ')}</span>
      </div>

      <p style={{ margin: '0.75rem 0 0.4rem' }}><strong>Why now:</strong> {o.why_now}</p>
      <p style={{ margin: '0 0 0.75rem' }}><strong>Angle:</strong> {o.suggested_angle}</p>

      {error && <div className="v2-form-message error">{error}</div>}

      {o.status === 'candidate' && <ReviewRow onReview={doReview} busy={busy} />}

      {o.status === 'approved' && !draft && (
        <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={doGenerateDraft}>
          {busy ? 'Writing…' : 'Generate draft'}
        </button>
      )}

      {draft && (
        <div className="v2-message-text" style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
          {draft}
          <div className="v2-btn-row" style={{ marginTop: '0.6rem' }}>
            <button type="button" className="v2-btn" disabled={busy} onClick={doGenerateDraft}>
              <IconRefreshCw width={13} height={13} /> Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PlatformOpportunitiesList({ platform }) {
  const { user } = useTenant()
  const [opportunities, setOpportunities] = useState(null)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)

  const load = () => {
    getContentOpportunities().then(data => setOpportunities(data.opportunities)).catch(err => setError(formatApiError(err)))
  }
  useEffect(load, [])

  const doGenerateAccountTopics = async () => {
    setGenerating(true); setError(null)
    try {
      const res = await generateAccountIntelligenceTopics()
      if (res.status !== 'ok' && res.status !== undefined) {
        // insufficient_data / no_business_context / llm_unavailable -- real, honest reasons, not an error
        setError(res.reason || res.status)
      }
      load()
    } catch (err) { setError(formatApiError(err)) } finally { setGenerating(false) }
  }

  return (
    <div>
      <div className="v2-btn-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="v2-btn v2-btn-primary" disabled={generating} onClick={doGenerateAccountTopics}>
          <IconSparkles width={14} height={14} /> {generating ? 'Finding patterns…' : 'Find topics from our accounts'}
        </button>
      </div>

      {error && <div className="v2-form-message error" style={{ marginBottom: '0.9rem' }}>{error}</div>}

      {opportunities === null ? (
        <div className="v2-skeleton-row" style={{ height: 120 }} />
      ) : opportunities.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No content opportunities yet. Ask the Content Strategist for a topic, or find patterns from your own accounts above.</div></div>
      ) : (
        opportunities.map(o => <OpportunityCard key={o.id} o={o} platform={platform} userEmail={user?.email} onChanged={load} />)
      )}
    </div>
  )
}

// ---------- Content Clusters (Blogs only) ----------

function ClusterRow({ cluster, userEmail, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const doReview = async (action) => {
    setBusy(true); setError(null)
    try { await reviewContentCluster(cluster.id, { action, reviewedBy: userEmail }); onChanged() }
    catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }
  const doGenerateDraft = async () => {
    setBusy(true); setError(null)
    try { await generateContentClusterDraft(cluster.id); onChanged() }
    catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }

  return (
    <div style={{ borderTop: '1px solid var(--v2-border)', padding: '0.85rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{cluster.order_index}. {cluster.title}</div>
          <div className="v2-placeholder-note" style={{ margin: '0.2rem 0 0' }}>{cluster.keyword} · {cluster.intent} · links to {cluster.offering_name}</div>
        </div>
        <span className={`v2-badge ${STATUS_BADGE[cluster.status] || 'v2-badge-neutral'}`}>{cluster.status.replace('_', ' ')}</span>
      </div>
      <p style={{ margin: '0.6rem 0' }}>{cluster.angle}</p>
      {error && <div className="v2-form-message error">{error}</div>}
      {cluster.status === 'candidate' && (
        <div className="v2-btn-row">
          <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => doReview('approve')}><IconCheck width={13} height={13} /> Approve</button>
          <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => doReview('reject')}><IconX width={13} height={13} /> Reject</button>
        </div>
      )}
      {cluster.status === 'approved' && !cluster.draft_text && (
        <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={doGenerateDraft}>{busy ? 'Writing…' : 'Generate draft'}</button>
      )}
      {cluster.draft_text && (
        <div className="v2-message-text" style={{ whiteSpace: 'pre-wrap' }}>
          {cluster.draft_text}
          <div className="v2-btn-row" style={{ marginTop: '0.6rem' }}>
            <button type="button" className="v2-btn" disabled={busy} onClick={doGenerateDraft}><IconRefreshCw width={13} height={13} /> Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PillarCard({ summary, userEmail, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const loadDetail = () => getContentPillarDetail(summary.id).then(setDetail).catch(err => setError(formatApiError(err)))

  const toggle = () => {
    setExpanded(e => !e)
    if (!detail) loadDetail()
  }

  const refresh = () => { loadDetail(); onChanged() }

  const doReview = async (action) => {
    setBusy(true); setError(null)
    try { await reviewContentPillar(summary.id, { action, reviewedBy: userEmail }); refresh() }
    catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }
  const doGenerateDraft = async () => {
    setBusy(true); setError(null)
    try { await generateContentPillarDraft(summary.id); refresh() }
    catch (err) { setError(formatApiError(err)) } finally { setBusy(false) }
  }

  return (
    <div className="v2-card" style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }} onClick={toggle}>
        <div>
          <div style={{ fontWeight: 600 }}>{summary.title}</div>
          <div className="v2-placeholder-note" style={{ margin: '0.2rem 0 0' }}>
            {summary.primary_keyword} · drives toward {summary.commercial_goal}
            {summary.grounded_function ? ` · grounded in real "${summary.grounded_function}" account pattern` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className={`v2-badge ${STATUS_BADGE[summary.status] || 'v2-badge-neutral'}`}>{summary.status.replace('_', ' ')}</span>
          <IconChevronDown width={16} height={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          {error && <div className="v2-form-message error">{error}</div>}
          {!detail ? (
            <div className="v2-skeleton-row" style={{ height: 80 }} />
          ) : (
            <>
              {detail.why_now && <p style={{ margin: '0 0 0.6rem' }}><strong>Why now (real account pattern):</strong> {detail.why_now}</p>}
              <p style={{ margin: '0 0 0.6rem' }}><strong>Core narrative:</strong> {detail.core_narrative}</p>
              <div className="v2-placeholder-note" style={{ marginBottom: '0.6rem' }}>
                Sections: {detail.sections?.join(' → ')}
              </div>

              {detail.status === 'candidate' && (
                <div className="v2-btn-row" style={{ marginBottom: '0.9rem' }}>
                  <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => doReview('approve')}><IconCheck width={13} height={13} /> Approve pillar</button>
                  <button type="button" className="v2-btn v2-btn-danger" disabled={busy} onClick={() => doReview('reject')}><IconX width={13} height={13} /> Reject</button>
                </div>
              )}
              {detail.status === 'approved' && !detail.draft_text && (
                <button type="button" className="v2-btn v2-btn-primary" style={{ marginBottom: '0.9rem' }} disabled={busy} onClick={doGenerateDraft}>
                  {busy ? 'Writing master page…' : 'Generate master page draft'}
                </button>
              )}
              {detail.draft_text && (
                <div className="v2-message-text" style={{ whiteSpace: 'pre-wrap', marginBottom: '0.9rem' }}>
                  {detail.draft_text}
                  <div className="v2-btn-row" style={{ marginTop: '0.6rem' }}>
                    <button type="button" className="v2-btn" disabled={busy} onClick={doGenerateDraft}><IconRefreshCw width={13} height={13} /> Regenerate</button>
                  </div>
                </div>
              )}

              <div className="v2-section-title" style={{ fontSize: '0.85rem', marginTop: '0.9rem' }}>9 linked sub-blogs</div>
              {detail.clusters.map(c => <ClusterRow key={c.id} cluster={c} userEmail={userEmail} onChanged={refresh} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ContentClustersSection() {
  const { user } = useTenant()
  const [pillars, setPillars] = useState(null)
  const [error, setError] = useState(null)
  const [theme, setTheme] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = () => {
    getContentPillars().then(data => setPillars(data.pillars)).catch(err => setError(formatApiError(err)))
  }
  useEffect(load, [])

  const doGenerate = async () => {
    setGenerating(true); setError(null)
    try {
      const res = await generateContentPillar(theme.trim() || undefined)
      if (res.status !== 'ok') {
        // insufficient_data / no_business_context / no_offerings_configured / llm_unavailable / discarded --
        // real, honest reasons a pillar wasn't grounded well enough, not a generic error
        setError(res.reason || res.status)
      } else {
        setTheme('')
      }
      load()
    } catch (err) { setError(formatApiError(err)) } finally { setGenerating(false) }
  }

  return (
    <div>
      <div className="v2-section-title">Content Clusters</div>
      <p className="v2-placeholder-note" style={{ marginBottom: '0.9rem' }}>
        One Master Pillar Page + 9 linked sub-blogs, grounded in a real pattern across the accounts
        we're reaching (same account intelligence as Quick Drafts) -- not just a typed theme.
      </p>

      <div className="v2-btn-row" style={{ marginBottom: '1rem' }}>
        <input
          className="v2-input" style={{ minWidth: 280 }} value={theme} onChange={e => setTheme(e.target.value)}
          placeholder="Optional: steer toward a theme, e.g. Founder-Led Sales → Sales Engine"
          onKeyDown={e => e.key === 'Enter' && doGenerate()}
        />
        <button type="button" className="v2-btn v2-btn-primary" disabled={generating} onClick={doGenerate}>
          {generating ? 'Finding a real pattern…' : 'Plan pillar from our accounts'}
        </button>
      </div>

      {error && <div className="v2-form-message error" style={{ marginBottom: '0.9rem' }}>{error}</div>}

      {pillars === null ? (
        <div className="v2-skeleton-row" style={{ height: 100 }} />
      ) : pillars.length === 0 ? (
        <div className="v2-card"><div className="v2-state">No content pillars planned yet.</div></div>
      ) : (
        pillars.map(p => <PillarCard key={p.id} summary={p} userEmail={user?.email} onChanged={load} />)
      )}
    </div>
  )
}

// ---------- Tab exports ----------

export function LinkedInPostsTab() {
  return <PlatformOpportunitiesList platform="linkedin" />
}

export function LinkedInArticlesTab() {
  return <PlatformOpportunitiesList platform="linkedin_article" />
}

export function BlogsTab() {
  return (
    <div>
      <PlatformOpportunitiesList platform="blog" />
      <div style={{ marginTop: '2rem' }}>
        <ContentClustersSection />
      </div>
    </div>
  )
}
