import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getContentSuggestions, getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../v2/api.js'

// One tab per real way the system finds something to post about -- each origin from the
// backend maps into exactly one tab. A short, partner-facing (not dev-facing) line sits at
// the top of each tab instead of one long paragraph explaining all of them at once.
const SUGGESTION_TABS = [
  { key: 'trend', origins: ['trend'], label: 'Market Trend', blurb: "What's trending in your market right now." },
  { key: 'competitor', origins: ['competitor'], label: 'Competitor Activity', blurb: 'What your competitors are publishing.' },
  { key: 'pipeline', origins: ['account_intelligence', 'pipeline_signal'], label: 'Your Pipeline', blurb: 'Patterns from the companies you’re targeting.' },
  { key: 'voice', origins: ['authentic_voice'], label: 'Your Voice', blurb: 'More of what you already talk about.' },
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

function SuggestedTopicCard({ suggestion, onAsk }) {
  return (
    <div className={'partnerSuggestedCard' + (suggestion.recommended ? ' recommended' : '')}>
      {suggestion.recommended && <div className="partnerRecommendedBadge">Recommended</div>}
      <div className="partnerSuggestedHeadline">{suggestion.headline}</div>
      <p className="partnerSuggestedWhyNow">{suggestion.why_now}</p>
      <button
        type="button"
        className="partnerTopicGenerateDraftBtn"
        onClick={() => onAsk('Write a LinkedIn post about "' + suggestion.headline + '" -- ' + suggestion.suggested_angle)}
      >
        Generate Draft
      </button>
    </div>
  )
}

function SuggestedTopicsPanel({ refreshKey, onAsk }) {
  const [suggestions, setSuggestions] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(SUGGESTION_TABS[0].key)

  useEffect(() => {
    getContentSuggestions().then(data => setSuggestions(data.suggestions)).catch(err => setError(formatApiError(err)))
  }, [refreshKey])

  if (error) {
    return <div className="partnerCardWrap"><div className="partnerErrorState">Could not load suggestions: {error}</div></div>
  }
  if (suggestions === null) {
    return <div className="partnerCardWrap"><div className="partnerLoadingState">Finding what to suggest…</div></div>
  }

  const tab = SUGGESTION_TABS.find(t => t.key === activeTab) || SUGGESTION_TABS[0]
  const tabSuggestions = suggestions.filter(s => tab.origins.includes(s.origin))

  return (
    <div className="partnerSuggestedTopicsSection">
      <h2 className="partnerSuggestedTopicsHeading">What should you post today?</h2>

      <div className="partnerSuggestionTabBar">
        {SUGGESTION_TABS.map(t => {
          const count = suggestions.filter(s => t.origins.includes(s.origin)).length
          return (
            <button
              key={t.key}
              type="button"
              className={'partnerSuggestionTab' + (activeTab === t.key ? ' active' : '')}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}{count > 0 && <span className="partnerTopicPillCount">{count}</span>}
            </button>
          )
        })}
      </div>

      <p className="partnerSuggestionTabBlurb">{tab.blurb}</p>

      {tabSuggestions.length === 0 ? (
        <div className="partnerContentEmptyBoard">
          <span className="partnerContentAvatar partnerContentAvatarLg"><SparkleIcon /></span>
          <p>Nothing here yet.</p>
          <button type="button" className="partnerSuggestionChip" onClick={() => onAsk('What should we write about this week?')}>
            What should we write about this week?
          </button>
        </div>
      ) : (
        <div className="partnerSuggestedTopicsGrid">
          {tabSuggestions.map(s => (
            <SuggestedTopicCard key={s.content_opportunity_id} suggestion={s} onAsk={onAsk} />
          ))}
        </div>
      )}
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

      {/* What should you post today -- tabbed by source, strongest suggestion flagged */}
      <SuggestedTopicsPanel refreshKey={refreshKey} onAsk={askChat} />
    </div>
  )
}
