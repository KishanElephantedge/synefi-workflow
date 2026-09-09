import { useEffect, useRef, useState } from 'react'
import { getMarketIntelligence, getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../v2/api.js'

// Real partner-facing Content Intelligence -- mirrors v2/pages/ContentStrategy.jsx's structure
// (collapsible chat + trending-topics tiers, same real data/tenant-scoped API calls) but is its
// OWN component, not a reuse of that file: ContentStrategy.jsx imports v2/icons.jsx and relies on
// v2.css's dark-first tokens, which V2AppShell deliberately keeps isolated to /v2 routes (see
// that file's own comment). Reusing it here would leak V2 theming into the partner shell's light
// theme. Same data, same api.js functions (already tenant-agnostic relative calls, scoped
// automatically via setActiveTenant in PartnerApp), independent presentation.

const TREND_META = {
  emerging: { tier: 'strong' },
  accelerating: { tier: 'strong' },
  persistent: { tier: 'some' },
  stable: { tier: 'some' },
  declining: { tier: 'declining' },
  insufficient_evidence: { tier: 'insufficient' },
}

const SECTION_DEF = [
  { tier: 'strong', title: 'Trending now', blurb: 'Real, recent, independent activity -- worth writing about.' },
  { tier: 'some', title: 'Holding steady', blurb: "Real activity, but not new -- it's persisted or leveled off." },
  { tier: 'declining', title: 'Cooling off', blurb: 'Activity is real but fading.' },
  { tier: 'insufficient', title: 'Not yet trending', blurb: 'Too little evidence so far to call a trend -- watching.' },
]

const PROMPT_SUGGESTIONS = [
  'What should we write about this week?',
  'Which topic is the best fit for my audience right now?',
  'Write a LinkedIn post for the top topic',
]

// Minimal, dependency-free markdown -- same approach as ContentStrategy.jsx's own, duplicated
// rather than shared since each chat surface owns its own rendering.
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

function MaximizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    </svg>
  )
}

function MinimizeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M21 16h-3a2 2 0 0 0-2 2v3M8 21v-3a2 2 0 0 0-2-2H3" />
    </svg>
  )
}

function ContentChat({ onTopicsChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef(null)

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
    if (!conversationId) return
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

  const messageList = (
    <div className="partnerContentChatMessages">
      {loaded && messages.length === 0 && (
        <div className="partnerContentChatEmpty">
          <p className="partnerHint" style={{ margin: 0 }}>
            Ask about any trending topic, or a topic of your own -- I'll ground it in real evidence, not a generic idea.
          </p>
          <div className="partnerContentSuggestionRow">
            {PROMPT_SUGGESTIONS.map(s => (
              <button key={s} type="button" className="partnerSuggestionChip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`partnerChatMsg partnerChatMsg-${m.role}`}>
          <div className="partnerChatBubble">{m.role === 'assistant' ? renderMarkdown(m.content) : m.content}</div>
        </div>
      ))}
      {sending && (
        <div className="partnerChatMsg partnerChatMsg-assistant">
          <div className="partnerChatBubble partnerChatTyping">Thinking…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )

  const inputRow = (
    <div className="partnerContentChatInputRow">
      <textarea
        rows={1}
        placeholder="Ask about your content..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onFocus={() => setExpanded(true)}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      <button type="button" className="partnerSendBtn" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">↑</button>
    </div>
  )

  // Fullscreen covers everything right of the fixed 220px sidebar (see .partnerSidebar's own
  // width) -- "the right side window" the user meant, not the whole viewport including nav.
  if (fullscreen) {
    return (
      <div className="partnerContentChatFullscreen">
        <div className="partnerContentChatPanelHead">
          <span>Conversation</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
            <button type="button" className="partnerLinkBtn" onClick={startNewChat}>New conversation</button>
            <button type="button" className="partnerLinkBtn partnerMinimizeBtn" onClick={() => setFullscreen(false)}>
              <MinimizeIcon /> Minimize
            </button>
          </div>
        </div>
        {messageList}
        {inputRow}
      </div>
    )
  }

  return (
    <div className="partnerContentChatShell">
      <button type="button" className="partnerContentChatTrigger" onClick={() => setExpanded(o => !o)}>
        <span className="partnerContentChatTriggerText">
          <strong>Ask about your content</strong>
          <span>What should you publish next -- and why?</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            className="partnerIconBtn"
            role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setFullscreen(true) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setExpanded(true); setFullscreen(true) } }}
            title="Maximize" aria-label="Maximize"
          >
            <MaximizeIcon />
          </span>
          <span className={`partnerChevron${expanded ? ' open' : ''}`}>▾</span>
        </span>
      </button>

      {expanded && (
        <div className="partnerContentChatPanel">
          <div className="partnerContentChatPanelHead">
            <span>Conversation</span>
            <button type="button" className="partnerLinkBtn" onClick={startNewChat}>New conversation</button>
          </div>
          {messageList}
        </div>
      )}

      {inputRow}
    </div>
  )
}

function TopicCard({ topic }) {
  const meta = TREND_META[topic.state] || TREND_META.insufficient_evidence
  const hasAccountEvidence = topic.account_bridge?.linked_account_count > 0
  return (
    <div className={`partnerTopicCard tier-${meta.tier}`}>
      <span className="partnerTopicName">{topic.canonical_name}</span>
      <div className="partnerTopicStats">
        {topic.recent_observation_count > 0 && (
          <span className="partnerTopicStat">{topic.recent_observation_count} mention{topic.recent_observation_count === 1 ? '' : 's'} · {topic.recent_independent_entity_count} source{topic.recent_independent_entity_count === 1 ? '' : 's'}</span>
        )}
        {hasAccountEvidence && (
          <span className="partnerTopicStat partnerTopicStatAccent">{topic.account_bridge.linked_account_count} real account{topic.account_bridge.linked_account_count === 1 ? '' : 's'} circling this</span>
        )}
      </div>
    </div>
  )
}

function TrendingTopics({ refreshKey }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getMarketIntelligence().then(data => setTopics(data.topics)).catch(err => setError(formatApiError(err)))
  }, [refreshKey])

  if (error) {
    return <div className="partnerCardWrap"><div className="partnerErrorState">Couldn't load trending topics: {error}</div></div>
  }
  if (topics === null) {
    return <div className="partnerCardWrap"><div className="partnerLoadingState">Loading...</div></div>
  }
  if (topics.length === 0) {
    return <div className="partnerCardWrap"><div className="partnerEmptyState">Nothing sensed yet -- ask the chat above to check for fresh trends, and real topics will show up here once it finds something.</div></div>
  }

  const byTier = {}
  for (const t of topics) {
    const tier = (TREND_META[t.state] || TREND_META.insufficient_evidence).tier
    ;(byTier[tier] ||= []).push(t)
  }
  for (const tier in byTier) {
    byTier[tier].sort((a, b) => b.recent_observation_count - a.recent_observation_count)
  }

  return (
    <div className="partnerTopicSections">
      {SECTION_DEF.filter(s => byTier[s.tier]?.length).map(section => (
        <div key={section.tier} className="partnerTopicSection">
          <div className="partnerTopicSectionHead">
            <span className={`partnerTopicDot tier-${section.tier}`} />
            <span className="partnerTopicSectionTitle">{section.title}</span>
            <span className="partnerTopicSectionCount">{byTier[section.tier].length}</span>
          </div>
          <p className="partnerTopicSectionBlurb">{section.blurb}</p>
          <div className="partnerTopicGrid">
            {byTier[section.tier].map(t => <TopicCard key={t.content_topic_id} topic={t} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PartnerContent() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Content</h1>
        <p>Content ideas grounded in your real trending topics, competitors, and positioning.</p>
      </div>

      <ContentChat onTopicsChanged={() => setRefreshKey(k => k + 1)} />

      <h2 className="partnerSectionTitle" style={{ marginTop: '1.75rem' }}>Trending topics</h2>
      <TrendingTopics refreshKey={refreshKey} />
    </div>
  )
}
