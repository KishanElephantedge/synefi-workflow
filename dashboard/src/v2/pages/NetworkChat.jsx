import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLatestNetworkChat, startNewNetworkChat, sendNetworkChatMessage, formatApiError } from '../api.js'
import { IconChevronLeft, IconMessageCircle, IconMic, IconSend } from '../icons.jsx'

// Full-page assistant over the GTM partner network -- deliberately a PAGE, not the collapsed bar
// the Content copilot uses. The questions it exists for ("I have a meeting with this person, what
// should I talk about", "who is struggling with what", "who is the best fit for us") produce long,
// quote-heavy answers that a sidebar makes unreadable.
//
// It reads two sources at once: each partner's GTM University profile, and all 10,652 messages
// from the GTM Partners community Slack. The formal profile says who someone claims to be; Slack
// says what is actually going on with them week to week.

const SUGGESTIONS = [
  'Who is Sarah Allen-Short? Give me the full picture.',
  'I have a meeting with Don Drury — what should I talk about?',
  'Who in the network is struggling to get clients right now?',
  'Which partners are the best fit for us to work with, and why?',
  'What are people saying about pricing and referral fees?',
  "What's actually going on in this community?",
]

const URL_RE = /(https?:\/\/[^\s<>()[\]{}"']+)/g

// Links matter here: partners share their own sites, LinkedIn profiles, booking links and docs in
// Slack, and a URL rendered as dead text makes the answer far less useful than it should be.
function linkify(text, keyPrefix) {
  return String(text).split(URL_RE).map((part, i) => (
    URL_RE.test(part) && part.startsWith('http')
      ? <a key={`${keyPrefix}-${i}`} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  ))
}

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let listItems = null
  const flushList = () => { if (listItems) { blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>); listItems = null } }
  const renderInline = (line, key) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${key}-b${i}`}>{part.slice(2, -2)}</strong>
      : <span key={`${key}-t${i}`}>{linkify(part, `${key}-${i}`)}</span>
  ))
  lines.forEach((line, i) => {
    const heading = line.match(/^(#{1,3})\s+(.*)/)
    const bullet = line.match(/^[-*]\s+(.*)/)
    const quote = line.match(/^>\s?(.*)/)
    if (heading) {
      flushList()
      const Tag = heading[1].length === 1 ? 'h4' : heading[1].length === 2 ? 'h5' : 'h6'
      blocks.push(<Tag key={i} style={{ margin: '0.5rem 0 0.25rem' }}>{renderInline(heading[2], i)}</Tag>)
    } else if (bullet) {
      if (!listItems) listItems = []
      listItems.push(<li key={i}>{renderInline(bullet[1], i)}</li>)
    } else if (quote) {
      flushList()
      blocks.push(<blockquote key={i} className="v2-net-chat-quote">{renderInline(quote[1], i)}</blockquote>)
    } else if (line.trim() === '') {
      flushList()
      blocks.push(<br key={i} />)
    } else {
      flushList()
      blocks.push(<span key={i}>{renderInline(line, i)}<br /></span>)
    }
  })
  flushList()
  return blocks
}

const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export default function NetworkChat() {
  const navigate = useNavigate()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    getLatestNetworkChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages || [])
      setLoaded(true)
    }).catch(e => { setError(formatApiError(e)); setLoaded(true) })
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  function startNewChat() {
    startNewNetworkChat().then(res => {
      setConversationId(res.conversation_id)
      setMessages([])
      setError('')
    }).catch(e => setError(formatApiError(e)))
  }

  function send(preset) {
    const text = (preset ?? input).trim()
    if (!text || sending || !conversationId) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    setError('')
    sendNetworkChatMessage(conversationId, text)
      .then(res => setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]))
      .catch(e => setError(formatApiError(e)))
      .finally(() => setSending(false))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function toggleVoice() {
    if (!SpeechRecognitionImpl) return
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const recognition = new SpeechRecognitionImpl()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onresult = e => setInput(prev => (prev ? `${prev} ` : '') + e.results[0][0].transcript)
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="v2-net-chat-page">
      <div className="v2-net-chat-header">
        <button type="button" className="v2-ai-widget-link" onClick={() => navigate('/v2/relationships?section=network')}>
          <IconChevronLeft width={16} height={16} /> Back to Network
        </button>
        <button type="button" className="v2-ai-widget-link" onClick={startNewChat}>New conversation</button>
      </div>

      <div className="v2-net-chat-messages">
        {loaded && messages.length === 0 && (
          <div className="v2-net-chat-empty">
            <IconMessageCircle width={32} height={32} />
            <h3>Ask about the GTM partner network</h3>
            <p className="v2-placeholder-note">
              I can see all 183 partners we track and every message from the GTM Partners community
              Slack — 10,652 across 25 channels. I answer from what people actually wrote, and I quote
              them with the channel and date so you can check it.
            </p>
            <div className="v2-cs-suggestion-row">
              {SUGGESTIONS.map(s => (
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
            <div className="v2-ai-message-bubble v2-ai-message-typing">Reading the network…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="v2-form-message error" style={{ margin: '0 1rem' }}>{error}</div>}

      <div className="v2-net-chat-input-row">
        <textarea
          rows={1}
          placeholder="Ask anything about the partners or the community…"
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
