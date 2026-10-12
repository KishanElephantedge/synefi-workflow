import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getLatestContentChat, startNewContentChat, sendContentChatMessage, formatApiError } from '../v2/api.js'
import { renderMarkdown, SparkleIcon, SendIcon } from './PartnerContent.jsx'

// Full-page drafting (2026-10-12, explicit instruction) -- "Generate Draft" used to open the
// small AI Copilot slide-over drawer, which wasn't big enough to actually read/edit a draft
// comfortably. This is the same chat mechanism (one real conversation, same backend endpoints)
// rendered as its own page instead, reached via the accounts-detail click-through pattern
// (useNavigate from the suggestion card, basePath + /content/draft, the initial ask carried in
// router state so it's sent automatically the moment the page opens).
export default function PartnerContentDraft({ basePath = '/partner' }) {
  const location = useLocation()
  const initialPrompt = location.state?.prompt || null
  const headline = location.state?.headline || null

  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const autoSentRef = useRef(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    getLatestContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const send = (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending || !conversationId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    sendContentChatMessage(conversationId, text)
      .then(res => {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply, tools_used: res.tools_used, created_at: new Date().toISOString() }])
      })
      .catch(err => {
        setMessages(prev => [...prev, { role: 'assistant', content: formatApiError(err), created_at: new Date().toISOString() }])
      })
      .finally(() => setSending(false))
  }

  // Auto-send the suggestion's own draft request the moment a real conversation exists --
  // once only, even if conversationId/loaded re-fire (e.g. a fast-refresh in dev).
  useEffect(() => {
    if (loaded && conversationId && initialPrompt && !autoSentRef.current) {
      autoSentRef.current = true
      send(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, conversationId, initialPrompt])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const startNewChat = () => {
    autoSentRef.current = true // a fresh chat should never replay the suggestion that brought us here
    startNewContentChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
    }).catch(() => {})
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="partnerDraftPage">
      <div className="partnerDraftPageHead">
        <Link className="partnerBackLink" to={`${basePath}/content`}>← Back to content</Link>
        <div className="partnerDraftPageTitleRow">
          <SparkleIcon />
          <h1 className="partnerExecHeading" style={{ fontSize: '20px', margin: 0 }}>
            {headline || 'Drafting with your AI Copilot'}
          </h1>
        </div>
        <button type="button" className="partnerLinkBtn" onClick={startNewChat}>New chat</button>
      </div>

      <div className="partnerDraftPageBody">
        <div className="partnerContentChatMessages partnerDraftPageMessages">
          {!loaded && <div className="partnerLoadingState">Loading…</div>}
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

      <div className="partnerDraftPageFooter">
        <div className="partnerContentChatInputRow">
          <textarea
            rows={2}
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
  )
}
