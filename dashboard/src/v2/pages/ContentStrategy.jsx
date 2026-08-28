import { useEffect, useRef, useState } from 'react'
import { getMarketIntelligence, getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../api.js'
import { IconAlertTriangle, IconMessageCircle, IconMic, IconSend, IconTrendingUp, IconTrendingDown, IconMinus } from '../icons.jsx'

// Same real six states as MarketTrends.jsx's TREND_META -- reused verbatim, never a paraphrase or
// a second scoring system. This list is intentionally minimal (name + state only): the actual
// why-now/angle/draft content only ever comes from the chat above, on request, in whatever format
// is asked for -- not pre-rendered here (2026-08-28 explicit instruction).
const TREND_META = {
  emerging: { label: 'Emerging', Icon: IconTrendingUp, tier: 'strong' },
  accelerating: { label: 'Accelerating', Icon: IconTrendingUp, tier: 'strong' },
  persistent: { label: 'Persistent', Icon: IconMinus, tier: 'some' },
  stable: { label: 'Stable', Icon: IconMinus, tier: 'some' },
  declining: { label: 'Declining', Icon: IconTrendingDown, tier: 'declining' },
  insufficient_evidence: { label: 'Insufficient evidence', Icon: IconMinus, tier: 'insufficient' },
}
const TIER_TONE = { strong: 'tone-success-solid', some: 'tone-info-soft', declining: 'tone-warning-solid', insufficient: 'tone-neutral' }
const TIER_RANK = { strong: 3, some: 2, declining: 1, insufficient: 0 }

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
function ContentStrategistChat({ onTopicsChanged }) {
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
        // A generation/sensing tool may have run -- refresh the real trending-topics list below.
        onTopicsChanged()
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
            Ask me things like "what should we write about this week?", "why does that topic matter right now?", or "write a LinkedIn post for the Sales OS topic." I only ever ground suggestions in real evidence -- ask why, and I'll show you.
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

// Plain, minimal list -- name + real trend state only, nothing else. The actual why-now/angle/
// draft content is deliberately never shown here; it only ever comes from the chat above, on
// request, in whatever format is asked for (2026-08-28 explicit instruction).
function TrendingTopicsList() {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)

  const load = () => getMarketIntelligence().then(data => setTopics(data.topics)).catch(err => setError(formatApiError(err)))

  useEffect(() => { load() }, [])

  if (error) {
    return <div className="v2-card"><div className="v2-state v2-state-error"><IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} /><div>Couldn't load trending topics: {error}</div></div></div>
  }
  if (topics === null) {
    return <div className="v2-skeleton-row" style={{ height: 120 }} />
  }
  if (topics.length === 0) {
    return <div className="v2-card"><div className="v2-state">No topics are configured yet for this tenant.</div></div>
  }

  const sorted = [...topics].sort((a, b) => TIER_RANK[(TREND_META[b.state] || TREND_META.insufficient_evidence).tier] - TIER_RANK[(TREND_META[a.state] || TREND_META.insufficient_evidence).tier])

  return (
    <div className="v2-cs-topic-list">
      {sorted.map(t => {
        const meta = TREND_META[t.state] || TREND_META.insufficient_evidence
        const Icon = meta.Icon
        return (
          <div key={t.content_topic_id} className="v2-cs-topic-row">
            <span className="v2-cs-topic-name">{t.canonical_name}</span>
            <span className={`v2-status-pill ${TIER_TONE[meta.tier]}`}>
              <Icon width={12} height={12} />
              {meta.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ContentStrategy() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="v2-cs-page">
      <div className="v2-page-eyebrow">Ask your content strategist -- suggestions and drafts are grounded in the real topics below, in whatever format you ask for</div>

      <ContentStrategistChat onTopicsChanged={() => setRefreshKey(k => k + 1)} />

      <div className="v2-section-title" style={{ marginTop: '1.5rem' }}>Trending topics</div>
      <TrendingTopicsList key={refreshKey} />
    </div>
  )
}
