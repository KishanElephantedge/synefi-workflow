import { useEffect, useRef, useState } from 'react'
import { useTenant } from '../../context/TenantContext.jsx'
import {
  getContentOpportunities, reviewContentOpportunity, generateContentOpportunityDraft,
  getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError,
} from '../api.js'
import { IconAlertTriangle, IconMessageCircle, IconMic, IconSend } from '../icons.jsx'

const ORIGIN_LABEL = { trend: 'Trend search', competitor: 'Competitor content' }
const PLATFORMS = [
  { key: 'blog', label: 'Blog' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'X / Twitter' },
]

// ---- Minimal, dependency-free markdown rendering -- same approach as V2AiWidget.jsx, duplicated
// rather than shared since each chat surface owns its own rendering (see that file's own note). ----
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let listItems = null
  const flushList = () => { if (listItems) { blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>); listItems = null } }
  const renderInline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))
  lines.forEach((line, i) => {
    const heading = line.match(/^(#{1,3})\s+(.*)/)
    const bullet = line.match(/^[-*]\s+(.*)/)
    if (heading) {
      flushList()
      const Tag = heading[1].length === 1 ? 'h4' : heading[1].length === 2 ? 'h5' : 'h6'
      blocks.push(<Tag key={i} style={{ margin: '0.3rem 0' }}>{renderInline(heading[2])}</Tag>)
    } else if (bullet) {
      if (!listItems) listItems = []
      listItems.push(<li key={i}>{renderInline(bullet[1])}</li>)
    } else if (line.trim() === '') {
      flushList()
      blocks.push(<br key={i} />)
    } else {
      flushList()
      blocks.push(<span key={i}>{renderInline(line)}<br /></span>)
    }
  })
  flushList()
  return blocks
}

const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

// The original "content strategy copilot" vision (progress-log.md) -- a senior content
// strategist mentoring a junior writer, real evidence-grounded, real tools (see
// app/gtm_os/chat/content_chat_tools.py). Inline, not floating -- this IS the page's job, not a
// side widget on top of it.
function ContentStrategistChat({ onOpportunitiesChanged }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    getLatestContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  const startNewChat = () => {
    startNewContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
    }).catch(() => {})
  }

  const send = (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending || !conversationId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    sendContentChatMessage(conversationId, text)
      .then(res => {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply, tools_used: res.tools_used, created_at: new Date().toISOString() }])
        // Any content-changing tool (generate/review) may have run -- refresh the real board below.
        onOpportunitiesChanged()
      })
      .catch(err => {
        setMessages(prev => [...prev, { role: 'assistant', content: formatApiError(err), created_at: new Date().toISOString() }])
      })
      .finally(() => setSending(false))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const toggleVoice = () => {
    if (!SpeechRecognitionImpl) return
    if (listening) { recognitionRef.current?.stop(); return }
    const recognition = new SpeechRecognitionImpl()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join(' ').trim()
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = (event) => setVoiceError(event.error === 'not-allowed' ? 'Microphone access denied.' : 'Voice input failed -- try again.')
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setVoiceError(null)
    setListening(true)
    recognition.start()
  }

  return (
    <div className="v2-card v2-cs-chat">
      <div className="v2-cs-chat-header">
        <div className="v2-cs-chat-header-title">
          <IconMessageCircle width={18} height={18} />
          <strong>Content Strategist</strong>
        </div>
        <button type="button" className="v2-ai-widget-link" onClick={startNewChat}>New conversation</button>
      </div>
      <div className="v2-cs-chat-messages">
        {loaded && messages.length === 0 && (
          <p className="v2-placeholder-note" style={{ padding: '0.5rem 0' }}>
            Ask me things like "what should we write about this week?", "why does that topic matter right now?", or "write a LinkedIn post for the Sales OS opportunity." I only ever ground suggestions in real evidence -- ask why, and I'll show you.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`v2-ai-message v2-ai-message-${m.role}`}>
            <div className="v2-ai-message-bubble">{m.role === 'assistant' ? renderMarkdown(m.content) : m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="v2-ai-message v2-ai-message-assistant">
            <div className="v2-ai-message-bubble v2-ai-message-typing">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {voiceError && <div className="v2-form-message error" style={{ margin: '0 0 0.5rem' }}>{voiceError}</div>}
      <div className="v2-cs-chat-input-row">
        <textarea
          rows={1}
          placeholder="Ask your content strategist..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        {SpeechRecognitionImpl && (
          <button type="button" className={`v2-ai-widget-mic${listening ? ' listening' : ''}`} onClick={toggleVoice} disabled={sending} title={listening ? 'Stop voice input' : 'Voice input'}>
            <IconMic width={20} height={20} strokeWidth={2.5} />
          </button>
        )}
        <button type="button" className="v2-ai-widget-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">
          <IconSend width={20} height={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

function ContentOpportunityCard({ opportunity, onChanged }) {
  const { user } = useTenant()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [showChangesForm, setShowChangesForm] = useState(false)
  const [activePlatform, setActivePlatform] = useState('blog')

  const review = async (action) => {
    if (action === 'request_changes' && !note.trim()) { setShowChangesForm(true); return }
    setBusy(true)
    setError(null)
    try {
      await reviewContentOpportunity(opportunity.id, { action, reviewedBy: user?.email, note: note.trim() || null })
      onChanged()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const generateDraft = async (platform) => {
    setBusy(true)
    setError(null)
    try {
      const result = await generateContentOpportunityDraft(opportunity.id, platform)
      if (result.status !== 'ok') setError(result.reason || result.error || `Couldn't generate a draft (${result.status}).`)
      onChanged()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const drafts = opportunity.drafts || {}
  const activeDraft = drafts[activePlatform]

  return (
    <div className="v2-card v2-cs-opportunity-card">
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{opportunity.topic_name || `Topic #${opportunity.content_topic_id}`}</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <span className="v2-badge v2-badge-neutral">{ORIGIN_LABEL[opportunity.origin] || opportunity.origin}</span>
          <span className="v2-badge v2-badge-info">{opportunity.status.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="v2-kv-label" style={{ marginTop: '0.6rem' }}>Why now</div>
      <p style={{ fontSize: '0.9rem', color: 'var(--v2-text)', marginTop: 4 }}>{opportunity.why_now}</p>

      <div className="v2-kv-label">Suggested angle</div>
      <p style={{ fontSize: '0.9rem', color: 'var(--v2-text)', marginTop: 4, marginBottom: 0 }}>{opportunity.suggested_angle}</p>

      {opportunity.cited_urls?.length > 0 && (
        <div className="v2-mi-chip-row" style={{ marginTop: '0.6rem' }}>
          {opportunity.cited_urls.map(url => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="v2-mi-chip">{new URL(url).hostname}</a>
          ))}
        </div>
      )}

      {opportunity.review_note && (
        <p className="v2-placeholder-note" style={{ marginTop: '0.6rem' }}>Note: {opportunity.review_note}</p>
      )}

      {error && <div className="v2-form-message error" style={{ marginTop: '0.6rem' }}>{error}</div>}

      {opportunity.status === 'candidate' && (
        <div className="v2-btn-row" style={{ marginTop: '0.8rem' }}>
          <button type="button" className="v2-btn v2-btn-primary" disabled={busy} onClick={() => review('approve')}>Approve</button>
          <button type="button" className="v2-btn" disabled={busy} onClick={() => review('reject')}>Reject</button>
          <button type="button" className="v2-btn" disabled={busy} onClick={() => review('request_changes')}>Request changes</button>
        </div>
      )}
      {showChangesForm && opportunity.status === 'candidate' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
          <input className="v2-input" type="text" style={{ flex: 1 }} value={note} onChange={e => setNote(e.target.value)} placeholder="What needs to change?" />
          <button type="button" className="v2-btn v2-btn-primary" disabled={busy || !note.trim()} onClick={() => review('request_changes')}>Submit</button>
        </div>
      )}

      {opportunity.status === 'approved' && (
        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--v2-border)' }}>
          <div className="v2-config-tabs" style={{ marginBottom: '0.6rem' }}>
            {PLATFORMS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`v2-config-tab${activePlatform === p.key ? ' active' : ''}`}
                onClick={() => setActivePlatform(p.key)}
              >
                {p.label}{drafts[p.key] ? ' ✓' : ''}
              </button>
            ))}
          </div>
          {activeDraft ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--v2-text)', whiteSpace: 'pre-wrap' }}>{activeDraft}</p>
          ) : (
            <p className="v2-placeholder-note">No {PLATFORMS.find(p => p.key === activePlatform)?.label} draft yet.</p>
          )}
          <button type="button" className="v2-btn" disabled={busy} onClick={() => generateDraft(activePlatform)} style={{ marginTop: '0.5rem' }}>
            {activeDraft ? `Regenerate ${PLATFORMS.find(p => p.key === activePlatform)?.label} draft` : `Generate ${PLATFORMS.find(p => p.key === activePlatform)?.label} draft`}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ContentStrategy() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => getContentOpportunities().then(res => setData(res.opportunities)).catch(err => setError(formatApiError(err)))

  useEffect(() => { load() }, [])

  return (
    <div className="v2-cs-page">
      <div className="v2-page-eyebrow">Real, evidence-grounded content ideas -- suggested, explained, and drafted per platform</div>

      <ContentStrategistChat onOpportunitiesChanged={load} />

      <div className="v2-section-title" style={{ marginTop: '1.5rem' }}>Content opportunities</div>

      {error ? (
        <div className="v2-card"><div className="v2-state v2-state-error"><IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} /><div>Couldn't load content opportunities: {error}</div></div></div>
      ) : data === null ? (
        <div className="v2-skeleton-row" style={{ height: 160 }} />
      ) : data.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">No content opportunities yet -- these only get generated once a topic has enough real, recent, independent evidence. Try asking the strategist above what's trending.</div>
        </div>
      ) : (
        <div className="v2-cs-opportunity-grid">
          {data.map(o => <ContentOpportunityCard key={o.id} opportunity={o} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}
