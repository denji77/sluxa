import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getGroupChat, sendGroupMessage, deleteGroupChat, getAmbientMessage } from '../api/groupChats'
import GroupChatHeader from '../components/Chat/GroupChatHeader'
import GroupMessageBubble from '../components/Chat/GroupMessageBubble'

// ─── Colors ─────────────────────────────────────────────────────────────

const COLORS = [
    'var(--theme-primary)', 'var(--theme-secondary)', 'var(--theme-accent)',
    '#f97316', '#06b6d4', '#a855f7',
]

// ─── Single char typing indicator ────────────────────────────────────────

function SingleCharTyping({ charName, charAvatar, charId }) {
    const color = COLORS[(charId || 0) % COLORS.length]
    return (
        <motion.div
            key={`typing-${charId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 20px' }}
        >
            {charAvatar ? (
                <img src={charAvatar} alt={charName}
                    style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${color}`, flexShrink: 0 }} />
            ) : (
                <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: `${color}33`, border: `1.5px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color,
                }}>
                    {(charName || '?').slice(0, 2).toUpperCase()}
                </div>
            )}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                    <motion.div key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.12 }}
                        style={{ width: 5, height: 5, borderRadius: '50%', background: color }}
                    />
                ))}
            </div>
            <span style={{ color: '#6b7280', fontSize: 11 }}>{charName} is typing…</span>
        </motion.div>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(res => setTimeout(res, ms))
const typingDuration = (content = '', multiplier = 1.0) =>
    Math.min(3000, Math.max(1000, content.length * 18)) * multiplier

// ─── GroupChatPage ───────────────────────────────────────────────────────

export default function GroupChatPage() {
    const { groupChatId } = useParams()
    const navigate = useNavigate()
    const bottomRef = useRef(null)
    const sendLockRef = useRef(false)

    const [groupChat, setGroupChat] = useState(null)
    const [messages, setMessages] = useState([])
    const [reactions, setReactions] = useState({}) // { messageId: [{emoji, charName, charId}] }
    const [readReceipts, setReadReceipts] = useState({}) // { messageId: [{charName, charId}] }
    const [loading, setLoading] = useState(true)
    const [input, setInput] = useState('')
    const [error, setError] = useState(null)
    const [chatMode, setChatMode] = useState(
        () => localStorage.getItem('chatMode') || 'descriptive'
    )
    const [typingChar, setTypingChar] = useState(null)

    const handleModeChange = (m) => {
        setChatMode(m)
        localStorage.setItem('chatMode', m)
    }

    const fetchGroupChat = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await getGroupChat(groupChatId)
            setGroupChat(res.data)
            setMessages(res.data.messages || [])
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load group chat.')
            if (err.response?.status === 404) navigate('/')
        } finally {
            setLoading(false)
        }
    }, [groupChatId, navigate])

    useEffect(() => { fetchGroupChat() }, [fetchGroupChat])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, typingChars])

    // ── Staggered reveal queue with hesitation, reaction, interrupt ──────

    const revealQueue = useCallback(async (aiMessages) => {
        for (let i = 0; i < aiMessages.length; i++) {
            const msg = aiMessages[i]
            const preDelay = Math.max(400, msg.delay_ms || 0)

            // ── HESITATION: show typing, wait, hide, NO message ──
            if (msg.role === 'hesitation') {
                await sleep(preDelay)
                const typingObj = {
                    charName: msg.character_name,
                    charAvatar: msg.character_avatar,
                    charId: msg.character_id,
                }
                setTypingChars(prev => [...prev, typingObj])
                await sleep(msg.hesitation_ms || 1500)
                setTypingChars(prev => prev.filter(c => c.charId !== msg.character_id))
                continue
            }

            // ── REACTION: no typing indicator, just attach emoji ──
            if (msg.role === 'reaction') {
                await sleep(preDelay)
                const targetId = msg.reacting_to_message_id
                if (targetId) {
                    setReactions(prev => ({
                        ...prev,
                        [targetId]: [
                            ...(prev[targetId] || []),
                            {
                                emoji: msg.content,
                                charName: msg.character_name,
                                charId: msg.character_id,
                            },
                        ],
                    }))
                }
                continue
            }

            // ── LEFT ON READ: visual indicator, no typing, no response ──
            if (msg.role === 'left_on_read') {
                await sleep(preDelay)
                const targetId = msg.reacting_to_message_id
                if (targetId) {
                    setReadReceipts(prev => ({
                        ...prev,
                        [targetId]: [
                            ...(prev[targetId] || []),
                            {
                                charName: msg.character_name,
                                charId: msg.character_id,
                            },
                        ],
                    }))
                }
                continue
            }

            // ── INTERRUPT: show immediately, mid-typing ──
            if (msg.interrupt) {
                // Don't wait for pre-delay, pop in immediately
                await sleep(Math.min(preDelay, 300))
                setMessages(prev => [...prev, msg])
                continue
            }

            // ── NORMAL RESPOND: delay → typing → message ──
            const processMessage = async () => {
                await sleep(preDelay)
                const typingObj = {
                    charName: msg.character_name,
                    charAvatar: msg.character_avatar,
                    charId: msg.character_id,
                }
                setTypingChars(prev => [...prev, typingObj])

                await sleep(typingDuration(msg.content, msg.typing_multiplier))

                setTypingChars(prev => prev.filter(c => c.charId !== msg.character_id))
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev
                    return [...prev, msg]
                })
            }

            if (msg.concurrent) {
                processMessage() // DO NOT await, run in background
                continue
            } else {
                await processMessage() // Wait for it to finish
            }
        }
    }, [])

    // ── Send message ────────────────────────────────────────────────────

    const handleSend = async () => {
        if (sendLockRef.current || !input.trim()) return
        sendLockRef.current = true

        const text = input.trim()
        setInput('')

        const tempId = `temp-${Date.now()}`
        const tempMsg = {
            id: tempId,
            group_chat_id: parseInt(groupChatId),
            character_id: null,
            character_name: null,
            character_avatar: null,
            content: text,
            role: 'user',
            created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, tempMsg])

        try {
            const res = await sendGroupMessage(groupChatId, text, chatMode)
            const aiMessages = res.data

            // Sync temp user message ID with real DB ID so reactions can target it
            if (aiMessages.length > 0 && aiMessages[0].user_message_id) {
                const realId = aiMessages[0].user_message_id
                setMessages(prev =>
                    prev.map(m => m.id === tempId ? { ...m, id: realId } : m)
                )
            }

            await revealQueue(aiMessages)
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId))
            alert(err.response?.data?.detail || 'Failed to send message.')
        } finally {
            sendLockRef.current = false
            resetAmbientTimer() // Reset ambient timer after each send
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this group chat?')) return
        try {
            await deleteGroupChat(groupChatId)
            navigate('/')
        } catch {
            alert('Failed to delete group chat.')
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // ── Ambient chat timer ────────────────────────────────────────────

    const ambientTimerRef = useRef(null)
    const ambientLockRef = useRef(false)

    const resetAmbientTimer = useCallback(() => {
        if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current)
        // Random delay: 60-90 seconds of silence
        const delay = 60000 + Math.random() * 30000
        ambientTimerRef.current = setTimeout(async () => {
            // Don't fire if user is typing, sending, or ambient already running
            if (sendLockRef.current || ambientLockRef.current) return
            ambientLockRef.current = true
            try {
                const res = await getAmbientMessage(groupChatId)
                const msg = res.data
                if (msg && msg.id) {
                    // Show typing indicator, then reveal
                    const typingObj = {
                        charName: msg.character_name,
                        charAvatar: msg.character_avatar,
                        charId: msg.character_id,
                    }
                    setTypingChars(prev => [...prev, typingObj])
                    await sleep(typingDuration(msg.content || '', msg.typing_multiplier))
                    setTypingChars(prev => prev.filter(c => c.charId !== msg.character_id))
                    setMessages(prev => [...prev, msg])
                }
            } catch {
                // Silently ignore — ambient is best-effort
            } finally {
                ambientLockRef.current = false
                resetAmbientTimer() // Schedule next ambient
            }
        }, delay)
    }, [groupChatId])

    // Start ambient timer when chat loads, clear on unmount
    useEffect(() => {
        if (!loading && groupChat) resetAmbientTimer()
        return () => {
            if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current)
        }
    }, [loading, groupChat, resetAmbientTimer])

    const isSending = typingChars.length > 0 || sendLockRef.current

    // ── Render ──────────────────────────────────────────────────────────

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    if (error) return (
        <div className="h-full flex items-center justify-center flex-col gap-4">
            <p className="text-red-400">{error}</p>
            <button onClick={() => navigate('/')} className="text-primary-500">← Go home</button>
        </div>
    )

    return (
        <div className="h-full flex flex-col chat-bg" style={{ overflow: 'hidden' }}>
            <GroupChatHeader
                groupChat={groupChat}
                onDelete={handleDelete}
                chatMode={chatMode}
                onModeChange={handleModeChange}
            />

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.length === 0 && typingChars.length === 0 && (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 8, color: '#4b5563',
                    }}>
                        <div style={{ fontSize: 36 }}>💬</div>
                        <p style={{ fontSize: 14 }}>Start the conversation!</p>
                        <p style={{ fontSize: 12 }}>{groupChat?.participants?.length} characters</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => {
                        const next = messages[i + 1]
                        const isLastInGroup = !next || next.character_id !== msg.character_id
                        const msgReactions = reactions[msg.id] || []
                        const msgReadReceipts = readReceipts[msg.id] || []
                        return (
                            <GroupMessageBubble
                                key={msg.id}
                                message={msg}
                                isLastInGroup={isLastInGroup}
                                reactions={msgReactions}
                                readReceipts={msgReadReceipts}
                            />
                        )
                    })}
                </AnimatePresence>

                {typingChars.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {typingChars.map(tc => (
                            <SingleCharTyping
                                key={tc.charId}
                                charName={tc.charName}
                                charAvatar={tc.charAvatar}
                                charId={tc.charId}
                            />
                        ))}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSending}
                        placeholder={isSending ? 'Characters are responding…' : 'Message the group…'}
                        rows={1}
                        style={{
                            flex: 1, resize: 'none',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 14, padding: '10px 14px',
                            color: '#fff', fontSize: 14, outline: 'none',
                            maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                            boxSizing: 'border-box',
                        }}
                        onInput={e => {
                            e.target.style.height = 'auto'
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                        }}
                    />
                    <motion.button
                        onClick={handleSend}
                        disabled={isSending || !input.trim()}
                        whileHover={{ scale: isSending || !input.trim() ? 1 : 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: 44, height: 44, borderRadius: 12, border: 'none',
                            cursor: isSending || !input.trim() ? 'not-allowed' : 'pointer',
                            background: isSending || !input.trim()
                                ? 'rgba(255,255,255,0.08)'
                                : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                            color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.2s ease',
                            boxShadow: isSending || !input.trim() ? 'none' : '0 4px 16px var(--theme-primary)40',
                        }}
                    >
                        {isSending ? <Square size={15} /> : <Send size={16} />}
                    </motion.button>
                </div>
                <p style={{ color: '#374151', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                    {isSending ? 'Characters are deciding…' : 'Not all characters respond every time'}
                </p>
            </div>
        </div>
    )
}
