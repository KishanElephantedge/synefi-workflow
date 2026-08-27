import { useEffect, useRef, useState } from 'react'
import { getLatestV2Chat, startNewV2Chat, sendV2ChatMessage, formatApiError } from '../api.js'
import { IconMessageCircle, IconMic, IconSend, IconX } from '../icons.jsx'

// Minimal, dependency-free markdown rendering -- same approach as the legacy V1 widget
// (src/components/ChatWidget.jsx), duplicated rather than imported since V2 deliberately owns
// its own layout/rendering with nothing shared from V1 (see V2App.jsx's own docstring).
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let listItems = null

  const flushList = () => {
    if (listItems) {
      blocks.push(<ul key={`ul-${blocks.length}`}>{listItems}</ul>)
      listItems = null
    }
  }

  const renderInline = (line) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))
  }

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

// Full read/write GTM-OS assistant (2026-08-27, explicit instruction) -- persists across V2 page
// navigation (mounted once in V2AppShell, not per-page). Voice input via the browser's native
// Web Speech API -- no library, no server-side speech integration; gracefully hides the mic
// button in browsers that don't support it (e.g. Firefox) rather than showing a dead control.
export default function V2AiWidget() {
  const [open, setOpen] = useState(false)
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
    if (!open || loaded) return
    getLatestV2Chat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
      setLoaded(true)
    }).catch(() => {})
  }, [open, loaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const startNewChat = () => {
    startNewV2Chat().then(res => {
      setConversationId(res.conversation_id)
      setMessages(res.messages)
    }).catch(() => {})
  }

  const downloadCsv = (csv) => {
    const blob = new Blob([atob(csv.content_base64)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csv.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const send = (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending || !conversationId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    sendV2ChatMessage(conversationId, text)
      .then(res => {
        setMessages(prev => [...prev, {
          role: 'assistant', content: res.reply, tools_used: res.tools_used, csv: res.csv,
          created_at: new Date().toISOString(),
        }])
      })
      .catch(err => {
        setMessages(prev => [...prev, { role: 'assistant', content: formatApiError(err), created_at: new Date().toISOString() }])
      })
      .finally(() => setSending(false))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const toggleVoice = () => {
    if (!SpeechRecognitionImpl) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = new SpeechRecognitionImpl()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join(' ').trim()
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = (event) => {
      setVoiceError(event.error === 'not-allowed' ? 'Microphone access denied.' : 'Voice input failed -- try again.')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setVoiceError(null)
    setListening(true)
    recognition.start()
  }

  return (
    <div className="v2-ai-widget-wrap">
      {open && (
        <div className="v2-ai-widget-panel">
          <div className="v2-ai-widget-header">
            <strong>AI Assistant</strong>
            <div className="v2-ai-widget-header-actions">
              <button type="button" className="v2-ai-widget-link" onClick={startNewChat}>New chat</button>
              <button type="button" className="v2-ai-widget-close" onClick={() => setOpen(false)} aria-label="Close">
                <IconX width={16} height={16} />
              </button>
            </div>
          </div>
          <div className="v2-ai-widget-messages">
            {messages.length === 0 && (
              <p className="v2-placeholder-note" style={{ padding: '1rem' }}>
                Full read/write access to GTM-OS -- ask a question, or give an instruction like "add a decision-maker for Acme Co" or "record today's meeting with Acme as won, $5,000, outbound." Use the mic for voice input.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`v2-ai-message v2-ai-message-${m.role}`}>
                <div className="v2-ai-message-bubble">
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                  {m.csv && (
                    <button type="button" className="v2-btn" style={{ marginTop: '0.4rem' }} onClick={() => downloadCsv(m.csv)}>
                      Download {m.csv.filename}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="v2-ai-message v2-ai-message-assistant">
                <div className="v2-ai-message-bubble v2-ai-message-typing">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {voiceError && <div className="v2-form-message error" style={{ margin: '0 1rem' }}>{voiceError}</div>}
          <div className="v2-ai-widget-input-row">
            <textarea
              rows={1}
              placeholder="Ask a question or give an instruction..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            {SpeechRecognitionImpl && (
              <button
                type="button"
                className={`v2-ai-widget-mic${listening ? ' listening' : ''}`}
                onClick={toggleVoice}
                disabled={sending}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                title={listening ? 'Stop voice input' : 'Voice input'}
              >
                <IconMic width={16} height={16} />
              </button>
            )}
            <button type="button" className="v2-ai-widget-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send">
              <IconSend width={16} height={16} />
            </button>
          </div>
        </div>
      )}
      <button type="button" className="v2-ai-widget-bubble" onClick={() => setOpen(o => !o)} aria-label="AI assistant">
        {open ? <IconX width={22} height={22} /> : <IconMessageCircle width={26} height={26} />}
      </button>
    </div>
  )
}
