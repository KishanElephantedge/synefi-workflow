import { useEffect, useRef, useState } from 'react'
import { getMarketIntelligence, getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../api.js'
import { IconAlertTriangle, IconMessageCircle, IconMic, IconSend, IconChevronDown } from '../icons.jsx'

// Same real six states MarketTrends.jsx reads from evaluate_topic_trend() -- reused verbatim,
// never a paraphrase or a second scoring system. Grouped into tiers below rather than shown
// individually per-card (2026-08-28 explicit feedback) -- the section a topic lands in already
// says its state; cards differentiate only by real numbers (see TopicCard).
const TREND_META = {
  emerging: { tier: 'strong' },
  accelerating: { tier: 'strong' },
  persistent: { tier: 'some' },
  stable: { tier: 'some' },
  declining: { tier: 'declining' },
  insufficient_evidence: { tier: 'insufficient' },
}

const PROMPT_SUGGESTIONS = [
  'What should we write about this week?',
  'Which topic is the best revenue bet right now?',
  'Write a LinkedIn post for the top topic',
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

// The original "content strategy copilot" vision (progress-log.md), redesigned (2026-08-28) as a
// collapsed bar by default -- opens into a full conversation on first send/click, rather than
// occupying a large fixed panel before anyone's asked it anything.
function ContentStrategistChat({ onTopicsChanged }) {
  const [expanded, setExpanded] = useState(false)
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
    if (!expanded || loaded) return
    getLatestContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [expanded, loaded])

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
    if (!text || sending) return
    setExpanded(true)
    if (!conversationId) return // waiting on getLatestContentChat -- rare race, user can resend
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    sendContentChatMessage(conversationId, text)
      .then(res => {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply, tools_used: res.tools_used, created_at: new Date().toISOString() }])
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
    <div className="v2-cs-chat-shell">
      <button type="button" className="v2-cs-chat-trigger" onClick={() => setExpanded(o => !o)}>
        <span className="v2-cs-chat-trigger-icon"><IconMessageCircle width={20} height={20} /></span>
        <span className="v2-cs-chat-trigger-text">
          <strong>Ask the Content Strategist</strong>
          <span>What should we publish next -- and why will it actually move revenue?</span>
        </span>
        <IconChevronDown width={18} height={18} className={`v2-cs-chat-chevron${expanded ? ' open' : ''}`} />
      </button>

      {expanded && (
        <div className="v2-cs-chat-panel">
          <div className="v2-cs-chat-panel-header">
            <span className="v2-kv-label" style={{ margin: 0 }}>Conversation</span>
            <button type="button" className="v2-ai-widget-link" onClick={startNewChat}>New conversation</button>
          </div>
          <div className="v2-cs-chat-messages">
            {loaded && messages.length === 0 && (
              <div className="v2-cs-chat-empty">
                <p className="v2-placeholder-note" style={{ margin: 0 }}>
                  I ground every call in real evidence -- observation counts, independent sources, and which real target accounts are already circling a topic. Ask why, and I'll show the numbers.
                </p>
                <div className="v2-cs-suggestion-row">
                  {PROMPT_SUGGESTIONS.map(s => (
                    <button key={s} type="button" className="v2-cs-suggestion-chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
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
        </div>
      )}

      <div className="v2-cs-chat-input-row">
        <textarea
          rows={1}
          placeholder="Ask your content strategist..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => setExpanded(true)}
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

const SECTION_DEF = [
  { tier: 'strong', title: 'Trending now', blurb: 'Real, recent, independent activity -- worth writing about.' },
  { tier: 'some', title: 'Holding steady', blurb: "Real activity, but not new -- it's persisted or leveled off." },
  { tier: 'declining', title: 'Cooling off', blurb: 'Activity is real but fading.' },
  { tier: 'insufficient', title: 'Not yet trending', blurb: 'Too little evidence so far to call a trend -- watching.' },
]

// A topic card's ONLY differentiators are real numbers already computed server-side: how many
// independent sources are talking about it right now, and how many real target accounts are
// already circling it (the closest real proxy this system has to "this is closer to revenue,"
// per the strategist's own reasoning). No invented rank, no fake score.
function TopicCard({ topic }) {
  const meta = TREND_META[topic.state] || TREND_META.insufficient_evidence
  const hasAccountEvidence = topic.account_bridge?.linked_account_count > 0
  return (
    <div className={`v2-cs-topic-card tier-${meta.tier}`}>
      <span className="v2-cs-topic-name">{topic.canonical_name}</span>
      <div className="v2-cs-topic-stats">
        {topic.recent_observation_count > 0 && (
          <span className="v2-cs-topic-stat">{topic.recent_observation_count} mention{topic.recent_observation_count === 1 ? '' : 's'} · {topic.recent_independent_entity_count} source{topic.recent_independent_entity_count === 1 ? '' : 's'}</span>
        )}
        {hasAccountEvidence && (
          <span className="v2-cs-topic-stat v2-cs-topic-stat-accent">{topic.account_bridge.linked_account_count} real account{topic.account_bridge.linked_account_count === 1 ? '' : 's'} circling this</span>
        )}
      </div>
    </div>
  )
}

// Grouped by real tier into labeled sections, not a flat ranked grid -- a rank number implies a
// precision this data doesn't have (2026-08-28 explicit feedback), so tier grouping plus the real
// observation/account-bridge counts on each card are the only differentiators, all real.
function TrendingTopicsList() {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)

  const load = () => getMarketIntelligence().then(data => setTopics(data.topics)).catch(err => setError(formatApiError(err)))

  useEffect(() => { load() }, [])

  if (error) {
    return <div className="v2-card"><div className="v2-state v2-state-error"><IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} /><div>Couldn't load trending topics: {error}</div></div></div>
  }
  if (topics === null) {
    return (
      <div className="v2-cs-topic-grid">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 70 }} />)}
      </div>
    )
  }
  if (topics.length === 0) {
    return <div className="v2-card"><div className="v2-state">No topics are configured yet for this tenant.</div></div>
  }

  const byTier = {}
  for (const t of topics) {
    const tier = (TREND_META[t.state] || TREND_META.insufficient_evidence).tier
    ;(byTier[tier] ||= []).push(t)
  }
  // Within a tier, real observation count is the one real number available to order by --
  // never an invented composite score.
  for (const tier in byTier) {
    byTier[tier].sort((a, b) => b.recent_observation_count - a.recent_observation_count)
  }

  return (
    <div className="v2-cs-topic-sections">
      {SECTION_DEF.filter(s => byTier[s.tier]?.length).map(section => (
        <div key={section.tier} className="v2-cs-topic-section">
          <div className="v2-cs-topic-section-head">
            <span className={`v2-cs-topic-section-dot tier-${section.tier}`} />
            <span className="v2-cs-topic-section-title">{section.title}</span>
            <span className="v2-cs-topic-section-count">{byTier[section.tier].length}</span>
          </div>
          <p className="v2-cs-topic-section-blurb">{section.blurb}</p>
          <div className={`v2-cs-topic-grid${section.tier === 'insufficient' ? ' compact' : ''}`}>
            {byTier[section.tier].map(t => <TopicCard key={t.content_topic_id} topic={t} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ContentStrategy() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="v2-cs-page">
      <ContentStrategistChat onTopicsChanged={() => setRefreshKey(k => k + 1)} />

      <div className="v2-section-title" style={{ marginTop: '1.75rem' }}>Trending topics</div>
      <TrendingTopicsList key={refreshKey} />
    </div>
  )
}
