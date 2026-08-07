import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

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
                  {m.content}
                  {m.csv && (
                    <button type="button" className="chat-csv-download" onClick={() => downloadCsv(m.csv)}>
                      Download {m.csv.filename}
                    </button>
                  )}
                </div>
                {m.tools_used && m.tools_used.length > 0 && (
                  <div className="chat-message-tools">Used: {[...new Set(m.tools_used)].join(', ')}</div>
                )}
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        )}
      </button>
    </div>
  )
}
