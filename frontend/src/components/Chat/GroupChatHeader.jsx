import { useNavigate } from 'react-router-dom'
import { Trash2, ArrowLeft, Users } from 'lucide-react'
import { motion } from 'framer-motion'

function Avatar({ name, avatarUrl, color, size = 32 }) {
    if (avatarUrl) {
        return (
            <img src={avatarUrl} alt={name}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}`, flexShrink: 0 }} />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: `${color}22`, border: `2px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0,
        }}>
            {(name || '?').slice(0, 2).toUpperCase()}
        </div>
    )
}

const COLORS = [
    'var(--theme-primary)', 'var(--theme-secondary)', 'var(--theme-accent)',
    '#f97316', '#06b6d4', '#a855f7',
]

export default function GroupChatHeader({ groupChat, onDelete, chatMode, onModeChange }) {
    const navigate = useNavigate()
    const participants = groupChat?.participants || []

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'rgba(10, 10, 20, 0.85)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            position: 'sticky', top: 0, zIndex: 10,
        }}>
            {/* Back */}
            <motion.button
                onClick={() => navigate('/')}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, borderRadius: 8 }}
            >
                <ArrowLeft size={20} />
            </motion.button>

            {/* Stacked avatars */}
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
                {participants.slice(0, 4).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: participants.length - i }}>
                        <Avatar
                            name={p.character_name}
                            avatarUrl={p.character_avatar}
                            color={COLORS[i % COLORS.length]}
                            size={34}
                        />
                    </div>
                ))}
                {participants.length > 4 && (
                    <div style={{
                        marginLeft: -10, zIndex: 0, width: 34, height: 34, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.2)',
                    }}>
                        +{participants.length - 4}
                    </div>
                )}
            </div>

            {/* Title and participants */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {groupChat?.title || 'Group Chat'}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} />
                    {participants.map(p => p.character_name).join(', ')}
                </div>
            </div>

            {/* Mode toggle */}
            <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0,
            }}>
                {['descriptive', 'normal'].map(m => (
                    <button
                        key={m}
                        onClick={() => onModeChange(m)}
                        style={{
                            padding: '5px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: chatMode === m ? 'var(--theme-primary)' : 'transparent',
                            color: chatMode === m ? '#fff' : '#6b7280',
                            transition: 'all 0.15s ease', textTransform: 'capitalize',
                        }}
                    >
                        {m === 'descriptive' ? '📖 RP' : '💬 Chat'}
                    </button>
                ))}
            </div>

            {/* Delete */}
            <motion.button
                onClick={onDelete}
                whileHover={{ scale: 1.1, color: '#ef4444' }}
                whileTap={{ scale: 0.95 }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 6 }}
            >
                <Trash2 size={18} />
            </motion.button>
        </div>
    )
}
