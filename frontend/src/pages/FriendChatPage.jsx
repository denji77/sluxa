import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { getFriendMessages, sendFriendMessage } from '../api/friends'
import { useToast } from '../components/Toast/ToastProvider'

function formatTime(iso) {
  // Backend timestamps are UTC without a zone suffix
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function FriendChatPage() {
  const { friendshipId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [friend, setFriend] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const lastIdRef = useRef(0)
  const bottomRef = useRef(null)
  const pollBusyRef = useRef(false)

  const appendMessages = useCallback((incoming) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id))
  }, [])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      if (pollBusyRef.current) return
      pollBusyRef.current = true
      try {
        const res = await getFriendMessages(friendshipId, lastIdRef.current)
        if (cancelled) return
        setFriend(res.data.friend)
        appendMessages(res.data.messages)
      } catch (error) {
        if (!cancelled && loading) {
          toast.error(error.response?.data?.detail || 'Could not load this chat.')
          navigate('/friends')
        }
      } finally {
        pollBusyRef.current = false
        if (!cancelled) setLoading(false)
      }
    }

    lastIdRef.current = 0
    setMessages([])
    setLoading(true)
    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendshipId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const res = await sendFriendMessage(friendshipId, content)
      appendMessages([res.data])
      setInput('')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Message failed to send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 glass sticky top-0 z-20">
        <motion.button
          onClick={() => navigate('/friends')}
          className="p-2 rounded-xl glass-card text-gray-400 hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {(friend?.display_name || '?').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{friend?.display_name || 'Friend'}</p>
          {friend?.email && <p className="text-gray-500 text-xs truncate">{friend.email}</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-[var(--theme-primary)] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 font-medium">No messages yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Say hi to {friend?.display_name || 'your friend'} 👋
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  m.mine
                    ? 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)] text-white rounded-br-md'
                    : 'glass-card text-gray-100 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`text-[10px] mt-1 ${m.mine ? 'text-white/70' : 'text-gray-500'}`}>
                  {formatTime(m.created_at)}
                </p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-white/10 glass flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${friend?.display_name || ''}...`}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--theme-primary)]/50 transition-colors"
        />
        <motion.button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </motion.button>
      </form>
    </div>
  )
}
