import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

// Minimal, dependency-free markdown rendering -- just enough for what Claude's chat replies
// actually use (bold, headers, bullet lists), so **text** and # headers render instead of
// showing the raw markdown characters. Not a general markdown parser.
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
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
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

// Floating AI chat widget -- Elephant Edge only. Persists across page navigation (rendered
// once at the AppShell level, not per-route) since it's a real conversation, not a per-page
// widget. Tenant-scoped history (see ChatConversation in the backend), not per-user -- this
// backend has no user identity concept at all.
export default function ChatWidget() {
  const { tenantSlug } = useParams()
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge' || !open || loaded) return
    client.get('/chat/latest').then(res => {
      setConversationId(res.data.conversation_id)
      setMessages(res.data.messages)
      setLoaded(true)
    }).catch(() => {})
  }, [tenantSlug, open, loaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  if (tenantSlug !== 'elephant-edge') return null

  const startNewChat = () => {
    client.post('/chat/new').then(res => {
      setConversationId(res.data.conversation_id)
      setMessages(res.data.messages)
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

  const send = () => {
    const text = input.trim()
    if (!text || sending || !conversationId) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    client.post(`/chat/conversations/${conversationId}/messages`, { message: text })
      .then(res => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: res.data.reply,
          tools_used: res.data.tools_used,
          csv: res.data.csv,
          created_at: new Date().toISOString(),
        }])
      })
      .catch(err => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: err.response?.data?.detail || 'Something went wrong reaching the assistant.',
          created_at: new Date().toISOString(),
        }])
      })
      .finally(() => setSending(false))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-widget-wrap">
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <strong>Ask the platform</strong>
            <div className="chat-widget-header-actions">
              <button type="button" className="link-button" onClick={startNewChat}>New chat</button>
              <button type="button" className="chat-widget-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          <div className="chat-widget-messages">
            {messages.length === 0 && (
              <p className="hint" style={{ padding: '1rem' }}>
                Ask about companies, decision-makers, replies, or anything on this platform -- e.g. "how many companies did we find yesterday?"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-message chat-message-${m.role}`}>
                <div className="chat-message-bubble">
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                  {m.csv && (
                    <button type="button" className="chat-csv-download" onClick={() => downloadCsv(m.csv)}>
                      Download {m.csv.filename}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-message chat-message-assistant">
                <div className="chat-message-bubble chat-message-typing">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="chat-widget-input-row">
            <textarea
              rows={1}
              placeholder="Ask a question or give an instruction..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button type="button" onClick={send} disabled={sending || !input.trim()}>Send</button>
          </div>
        </div>
      )}
      <button type="button" className="chat-widget-bubble" onClick={() => setOpen(o => !o)} aria-label="AI chat">
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ) : (
          <svg className="h-6 w-6" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.17 0-2.29-.2-3.31-.55L3 21l1.55-4.69C3.57 15.09 3 13.6 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        )}
      </button>
    </div>
  )
}
