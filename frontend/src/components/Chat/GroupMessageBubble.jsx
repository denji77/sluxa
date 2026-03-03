import { motion } from 'framer-motion'

const COLORS = [
    'var(--theme-primary)',
    'var(--theme-secondary)',
    'var(--theme-accent)',
    '#f97316',
    '#06b6d4',
    '#a855f7',
]

function charColor(charId) {
    return COLORS[(charId || 0) % COLORS.length]
}

function Avatar({ name, avatarUrl, color, size = 30 }) {
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name}
                style={{
                    width: size, height: size, borderRadius: '50%', objectFit: 'cover',
                    border: `2px solid ${color}`, flexShrink: 0,
                }}
            />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: `${color}33`, border: `2px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.35, fontWeight: 700, color, flexShrink: 0,
        }}>
            {(name || '?').slice(0, 2).toUpperCase()}
        </div>
    )
}

// ── Reaction Chips ─────────────────────────────────────────────────

function ReactionChips({ reactions }) {
    if (!reactions || reactions.length === 0) return null
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
                display: 'flex', gap: 4, flexWrap: 'wrap',
                marginTop: 4, paddingLeft: 4,
            }}
        >
            {reactions.map((r, i) => (
                <div
                    key={`${r.charId}-${i}`}
                    title={r.charName}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: 'rgba(255,255,255,0.08)',
                        border: `1px solid ${charColor(r.charId)}30`,
                        borderRadius: 12,
                        padding: '2px 8px',
                        fontSize: 13,
                        cursor: 'default',
                    }}
                >
                    <span>{r.emoji}</span>
                    <span style={{
                        fontSize: 10, color: charColor(r.charId),
                        fontWeight: 600, opacity: 0.8,
                    }}>
                        {r.charName}
                    </span>
                </div>
            ))}
        </motion.div>
    )
}

// ── Main Bubble ────────────────────────────────────────────────────

export default function GroupMessageBubble({
    message,
    isLastInGroup = true,
    reactions = [],
    readReceipts = [],
}) {
    const isUser = message.role === 'user'
    const color = isUser ? 'var(--theme-primary)' : charColor(message.character_id)

    // Quote-reply strip
    const hasReplyTo = !isUser && message.responding_to_char_id && message.responding_to_char_name
    const replyColor = hasReplyTo ? charColor(message.responding_to_char_id) : color

    // Interrupt flash
    const isInterrupt = message.interrupt

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, ...(isInterrupt ? { scale: 1.03 } : {}) }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: isInterrupt ? 0.15 : 0.22 }}
            style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 4,
                padding: '0 12px',
            }}
        >
            {/* Avatar */}
            {!isUser && isLastInGroup && (
                <div style={{ marginBottom: 2 }}>
                    <Avatar
                        name={message.character_name}
                        avatarUrl={message.character_avatar}
                        color={color}
                        size={28}
                    />
                </div>
            )}
            {!isUser && !isLastInGroup && <div style={{ width: 28, flexShrink: 0 }} />}

            <div style={{
                maxWidth: '72%',
                display: 'flex', flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
            }}>

                {/* Character name */}
                {!isUser && isLastInGroup && (
                    <span style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 3, paddingLeft: 4 }}>
                        {message.character_name}
                        {isInterrupt && (
                            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>⚡</span>
                        )}
                    </span>
                )}

                {/* Quote-reply strip */}
                {hasReplyTo && (
                    <div style={{
                        borderLeft: `3px solid ${replyColor}`,
                        background: `${replyColor}12`,
                        borderRadius: '0 8px 8px 0',
                        padding: '4px 10px',
                        marginBottom: 4,
                        maxWidth: '100%',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: replyColor, marginBottom: 2 }}>
                            ↩ {message.responding_to_char_name}
                        </div>
                        <div style={{
                            fontSize: 11, color: '#9ca3af',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', maxWidth: 260,
                        }}>
                            {message.responding_to_preview || '…'}
                        </div>
                    </div>
                )}

                {/* Message bubble */}
                <div style={{
                    background: isUser
                        ? 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))'
                        : 'rgba(255,255,255,0.06)',
                    border: isUser ? 'none' : `1px solid ${color}22`,
                    borderRadius: isUser
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                    padding: '10px 14px',
                    color: '#f0f0f0',
                    fontSize: 14,
                    lineHeight: 1.55,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    backdropFilter: 'blur(4px)',
                    boxShadow: isInterrupt
                        ? `0 0 12px ${color}50, 0 2px 8px rgba(0,0,0,0.4)`
                        : isUser
                            ? `0 2px 12px ${color}40`
                            : '0 1px 6px rgba(0,0,0,0.3)',
                }}>
                    {message.content}
                </div>

                {/* Reaction chips */}
                <ReactionChips reactions={reactions} />

                {/* Read receipts (Feature 3) */}
                {readReceipts && readReceipts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{
                            marginTop: 4,
                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                            fontSize: 11,
                            color: '#9ca3af',
                            fontStyle: 'italic',
                        }}
                    >
                        Read by {readReceipts.map(r => r.charName).join(', ')}
                    </motion.div>
                )}
            </div>
        </motion.div>
    )
}
