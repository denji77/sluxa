import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Users, Check, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createGroupChat } from '../../api/groupChats'

function Avatar({ name, avatarUrl, size = 36 }) {
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
            />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        }}>
            {(name || '?').slice(0, 2).toUpperCase()}
        </div>
    )
}

export default function CreateGroupChatModal({ characters, onClose }) {
    const navigate = useNavigate()
    const [selected, setSelected] = useState([]) // array of character ids (preserves order)
    const [title, setTitle] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    const toggle = (charId) => {
        setSelected(prev =>
            prev.includes(charId)
                ? prev.filter(id => id !== charId)
                : [...prev, charId]
        )
        setError('')
    }

    const handleCreate = async () => {
        if (selected.length < 2) {
            setError('Select at least 2 characters.')
            return
        }
        try {
            setCreating(true)
            const res = await createGroupChat({ character_ids: selected, title: title.trim() || undefined })
            onClose()
            navigate(`/group-chat/${res.data.id}`)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create group chat.')
        } finally {
            setCreating(false)
        }
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16,
                }}
                onClick={e => { if (e.target === e.currentTarget) onClose() }}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    style={{
                        width: '100%', maxWidth: 500,
                        background: 'rgba(18, 18, 30, 0.97)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 20,
                        padding: 24,
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                        maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 10,
                                background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Users size={20} color="#fff" />
                            </div>
                            <div>
                                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>New Group Chat</h2>
                                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>Select 2–6 characters</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Title input */}
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Room title (optional)"
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14,
                            marginBottom: 16, outline: 'none', width: '100%', boxSizing: 'border-box',
                        }}
                    />

                    {/* Character grid */}
                    <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16, paddingRight: 4 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {characters.map(char => {
                                const isSelected = selected.includes(char.id)
                                const orderIndex = selected.indexOf(char.id)
                                return (
                                    <motion.div
                                        key={char.id}
                                        onClick={() => toggle(char.id)}
                                        whileTap={{ scale: 0.96 }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                                            background: isSelected ? 'rgba(var(--theme-primary-rgb, 139,92,246),0.15)' : 'rgba(255,255,255,0.04)',
                                            border: isSelected ? '1.5px solid var(--theme-primary)' : '1.5px solid rgba(255,255,255,0.07)',
                                            transition: 'all 0.15s ease',
                                            position: 'relative',
                                        }}
                                    >
                                        <Avatar name={char.name} avatarUrl={char.avatar_url} size={36} />
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {char.name}
                                            </div>
                                            <div style={{ color: '#6b7280', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {char.description?.slice(0, 40)}...
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div style={{
                                                position: 'absolute', top: 6, right: 6, width: 18, height: 18,
                                                background: 'var(--theme-primary)', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700,
                                            }}>
                                                {orderIndex + 1}
                                            </div>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Selected summary */}
                    {selected.length > 0 && (
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, textAlign: 'center' }}>
                            Turn order: {selected.map(id => characters.find(c => c.id === id)?.name).join(' → ')}
                        </div>
                    )}

                    {error && (
                        <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</p>
                    )}

                    {/* Create button */}
                    <motion.button
                        onClick={handleCreate}
                        disabled={selected.length < 2 || creating}
                        whileHover={{ scale: selected.length >= 2 ? 1.02 : 1 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: selected.length >= 2 ? 'pointer' : 'not-allowed',
                            background: selected.length >= 2
                                ? 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))'
                                : 'rgba(255,255,255,0.08)',
                            color: selected.length >= 2 ? '#fff' : '#6b7280',
                            fontSize: 15, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {creating ? (
                            <><Loader2 size={18} className="animate-spin" /> Creating...</>
                        ) : (
                            <><Check size={18} /> Create Group Chat ({selected.length} characters)</>
                        )}
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
