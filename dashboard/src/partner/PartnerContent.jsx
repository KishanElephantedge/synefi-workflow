import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getMarketIntelligence, getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../v2/api.js'

const TREND_META = {
  emerging: { tier: 'strong', label: 'Emerging', momentum: 'High momentum' },
  accelerating: { tier: 'strong', label: 'Accelerating', momentum: 'Surging' },
  persistent: { tier: 'some', label: 'Persistent', momentum: 'Holding steady' },
  stable: { tier: 'some', label: 'Stable', momentum: 'Steady' },
  declining: { tier: 'declining', label: 'Cooling off', momentum: 'Fading' },
  insufficient_evidence: { tier: 'insufficient', label: 'Watching', momentum: 'Early detection' },
}

const SECTION_DEF = [
  { tier: 'all', title: 'All Topics' },
  { tier: 'strong', title: 'Trending now' },
  { tier: 'some', title: 'Holding steady' },
  { tier: 'declining', title: 'Cooling off' },
  { tier: 'insufficient', title: 'Not yet trending' },
]

const PROMPT_SUGGESTIONS = [
  'What should we write about this week?',
  'Which topic is the best fit for my audience right now?',
  'Write a LinkedIn post for the top topic',
]

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let listItems = null
  const flushList = () => { if (listItems) { blocks.push(<ul key={'ul-' + blocks.length}>{listItems}</ul>); listItems = null } }
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

function SparkleIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l1.8 5.6L19.4 9.4 13.8 11.2 12 17 10.2 11.2 4.6 9.4 10.2 7.6z" />
      <path d="M19 15l.8 2.4L22 18l-2.2.6L19 21l-.8-2.4L16 18l2.2-.6z" opacity="0.7" />
    </svg>
  )
}

function SendIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function CloseIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function SparklineSvg({ tier }) {
  if (tier === 'strong') {
    return (
      <svg width="60" height="20" viewBox="0 0 60 20" fill="none" className="partnerSparkline">
        <path d="M2 17 C 15 17, 24 12, 34 8 C 42 4, 48 6, 58 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="58" cy="3" r="2" fill="currentColor" />
      </svg>
    )
  }
  if (tier === 'some') {
    return (
      <svg width="60" height="20" viewBox="0 0 60 20" fill="none" className="partnerSparkline">
        <path d="M2 11 C 15 7, 25 14, 36 10 C 45 7, 50 12, 58 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="58" cy="9" r="2" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" fill="none" className="partnerSparkline">
      <path d="M2 9 L 18 10 L 36 10 L 58 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="58" cy="11" r="1.5" fill="currentColor" />
    </svg>
  )
}

const ContentChat = forwardRef(function ContentChat({ onTopicsChanged, isPanelOpen, setIsPanelOpen }, ref) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!isPanelOpen || loaded) return
    getLatestContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [isPanelOpen, loaded])

  useEffect(() => {
    if (isPanelOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, sending, isPanelOpen])

  const startNewChat = () => {
    startNewContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
    }).catch(() => {})
  }

  const send = (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return
    setIsPanelOpen(true)
    if (!conversationId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    sendContentChatMessage(conversationId, text)
      .then(res => {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply, tools_used: res.tools_used, created_at: new Date().toISOString() }])
        onTopicsChanged?.()
      })
      .catch(err => {
        setMessages(prev => [...prev, { role: 'assistant', content: formatApiError(err), created_at: new Date().toISOString() }])
      })
      .finally(() => setSending(false))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  useImperativeHandle(ref, () => ({
    ask: (text) => send(text),
    open: () => setIsPanelOpen(true),
  }))

  return (
    <>
      {/* Top Search Capsule & Prompt Badges */}
      <div className="partnerExecSearchCapsuleWrapper">
        <div className="partnerExecSearchCapsule" onClick={() => setIsPanelOpen(true)}>
          <div className="partnerExecSearchPill">
            <SparkleIcon />
            <span>AI Copilot</span>
          </div>
          <input
            type="text"
            className="partnerExecSearchInput"
            placeholder="What would you like to plan or write about today?"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            onFocus={() => setIsPanelOpen(true)}
          />
          <button
            type="button"
            className="partnerExecSendMiniBtn"
            onClick={(e) => { e.stopPropagation(); send() }}
            disabled={!input.trim() || sending}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>

        <div className="partnerExecPromptChips">
          {PROMPT_SUGGESTIONS.map(s => (
            <button key={s} type="button" className="partnerExecPromptChip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Slide-over backdrop overlay */}
      {isPanelOpen && <div className="partnerExecDrawerOverlay" onClick={() => setIsPanelOpen(false)} />}

      {/* Side Slide-Over Copilot Drafting Panel */}
      <div className={'partnerExecSideDrawer' + (isPanelOpen ? ' open' : '')}>
        <div className="partnerExecDrawerHead">
          <div className="partnerExecDrawerTitle">
            <SparkleIcon />
            <span>AI Copilot Drafting</span>
          </div>
          <div className="partnerExecDrawerHeadActions">
            <button type="button" className="partnerLinkBtn" onClick={startNewChat}>New chat</button>
            <button type="button" className="partnerExecCloseBtn" onClick={() => setIsPanelOpen(false)} aria-label="Close drawer">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="partnerExecDrawerBody">
          <div className="partnerContentChatMessages">
            {loaded && messages.length === 0 && (
              <div className="partnerContentChatEmpty">
                <p className="partnerHint" style={{ margin: 0 }}>
                  Ask about any trending topic, or a topic of your own — I will ground it in real web evidence and target accounts.
                </p>
                <div className="partnerContentSuggestionRow">
                  {PROMPT_SUGGESTIONS.map(s => (
                    <button key={s} type="button" className="partnerSuggestionChip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={'partnerChatMsg partnerChatMsg-' + m.role}>
                <div className="partnerChatBubble">{m.role === 'assistant' ? renderMarkdown(m.content) : m.content}</div>
              </div>
            ))}
            {sending && (
              <div className="partnerChatMsg partnerChatMsg-assistant">
                <div className="partnerChatBubble partnerChatTyping">Generating response…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="partnerExecDrawerFooter">
          <div className="partnerContentChatInputRow">
            <textarea
              rows={1}
              placeholder="Ask your content copilot..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              type="button"
              className="partnerSendBtn"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </>
  )
})

function TopicTableRow({ topic, onAsk }) {
  const meta = TREND_META[topic.state] || TREND_META.insufficient_evidence
  const hasAccountEvidence = topic.account_bridge?.linked_account_count > 0
  const hasMentions = topic.recent_observation_count > 0

  return (
    <div className="partnerTopicTableRow">
      {/* Col 1: Topic Identity */}
      <div className="partnerTopicTableCol partnerTopicTableColName">
        <span className="partnerTopicTableIcon"><SparkleIcon /></span>
        <div className="partnerTopicTableTitles">
          <span className="partnerTopicTableName">{topic.canonical_name}</span>
          <span className="partnerTopicTableTag">{meta.label}</span>
        </div>
      </div>

      {/* Col 2: Momentum Trajectory */}
      <div className="partnerTopicTableCol partnerTopicTableColTrajectory">
        <SparklineSvg tier={meta.tier} />
        <span className={'partnerTopicTrajectoryLabel tier-' + meta.tier}>
          {meta.tier === 'strong' ? '↗ High' : meta.tier === 'some' ? '→ Steady' : '· Watching'}
        </span>
      </div>

      {/* Col 3: Evidence Badges */}
      <div className="partnerTopicTableCol partnerTopicTableColEvidence">
        <div className="partnerTopicEvidenceList">
          {hasMentions ? (
            <span className="partnerTopicEvidenceItem">
              <strong>{topic.recent_observation_count}</strong> mentions · <strong>{topic.recent_independent_entity_count}</strong> sources
            </span>
          ) : (
            <span className="partnerTopicEvidenceItem partnerTopicEvidenceWatching">
              Tracking web signals & search volume
            </span>
          )}
          {hasAccountEvidence && (
            <span className="partnerTopicEvidenceItem partnerTopicEvidenceAccent">
              <strong>{topic.account_bridge.linked_account_count}</strong> accounts circling
            </span>
          )}
        </div>
      </div>

      {/* Col 4: Action */}
      <div className="partnerTopicTableCol partnerTopicTableColAction">
        <button
          type="button"
          className="partnerTopicGenerateDraftBtn"
          onClick={() => onAsk('Write a LinkedIn post about "' + topic.canonical_name + '"')}
        >
          Generate Draft
        </button>
      </div>
    </div>
  )
}

function TrendingTopicsFeed({ refreshKey, onAsk }) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('all')

  useEffect(() => {
    getMarketIntelligence().then(data => setTopics(data.topics)).catch(err => setError(formatApiError(err)))
  }, [refreshKey])

  if (error) {
    return <div className="partnerCardWrap"><div className="partnerErrorState">Could not load trending topics: {error}</div></div>
  }
  if (topics === null) {
    return <div className="partnerCardWrap"><div className="partnerLoadingState">Loading topics…</div></div>
  }
  if (topics.length === 0) {
    return (
      <div className="partnerContentEmptyBoard">
        <span className="partnerContentAvatar partnerContentAvatarLg"><SparkleIcon /></span>
        <p>No topics sensed yet. Ask the copilot above to check for fresh trends, and real topics will appear here.</p>
        <button type="button" className="partnerSuggestionChip" onClick={() => onAsk('What should we write about this week?')}>
          What should we write about this week?
        </button>
      </div>
    )
  }

  const filteredTopics = topics.filter(t => {
    if (selectedFilter === 'all') return true
    const tier = (TREND_META[t.state] || TREND_META.insufficient_evidence).tier
    return tier === selectedFilter
  })

  return (
    <div className="partnerTopicFeedContainer">
      {/* Segmented Filter Pills */}
      <div className="partnerTopicSegmentedBar">
        <span className="partnerTopicSegmentedLabel">SEGMENTED FEED</span>
        <div className="partnerTopicSegmentedPills">
          {SECTION_DEF.map(sec => {
            const count = sec.tier === 'all' 
              ? topics.length 
              : topics.filter(t => (TREND_META[t.state] || TREND_META.insufficient_evidence).tier === sec.tier).length
            if (sec.tier !== 'all' && count === 0) return null
            const isActive = selectedFilter === sec.tier
            return (
              <button
                key={sec.tier}
                type="button"
                className={'partnerTopicSegmentedPill' + (isActive ? ' active' : '')}
                onClick={() => setSelectedFilter(sec.tier)}
              >
                {sec.title} <span className="partnerTopicPillCount">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Structured Table Feed */}
      <div className="partnerTopicTable">
        <div className="partnerTopicTableHeader">
          <span className="partnerTopicHeaderColName">Topic name</span>
          <span className="partnerTopicHeaderColTrajectory">Momentum Trajectory</span>
          <span className="partnerTopicHeaderColEvidence">Evidence</span>
          <span className="partnerTopicHeaderColAction"></span>
        </div>

        <div className="partnerTopicTableBody">
          {filteredTopics.map(t => (
            <TopicTableRow key={t.content_topic_id} topic={t} onAsk={onAsk} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PartnerContent() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const chatRef = useRef(null)

  const askChat = (text) => {
    setIsPanelOpen(true)
    chatRef.current?.ask(text)
  }

  return (
    <div className="partnerExecFeedPage">
      {/* Top Header with title and New Post CTA */}
      <div className="partnerExecTopBar">
        <div className="partnerExecTitleArea">
          <h1 className="partnerExecHeading">Trending LinkedIn Topics</h1>
          <p className="partnerExecSubheading">Real-time market sensing grounded in observation counts, competitor angles, and target accounts.</p>
        </div>
        <div className="partnerExecTopActions">
          <button
            type="button"
            className="partnerExecNewPostBtn"
            onClick={() => askChat('Draft a high-impact LinkedIn post based on current trends')}
          >
            + New Post
          </button>
        </div>
      </div>

      {/* AI Copilot Search Capsule & suggestions */}
      <ContentChat
        ref={chatRef}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        onTopicsChanged={() => setRefreshKey(k => k + 1)}
      />

      {/* Executive Structured Feed Table */}
      <TrendingTopicsFeed refreshKey={refreshKey} onAsk={askChat} />
    </div>
  )
}
