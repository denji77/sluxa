import ReactMarkdown from 'react-markdown'
import { Check, CheckCheck, Copy, RotateCcw, Heart, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function MessageBubble({ 
  message, 
  isUser, 
  characterName, 
  characterAvatar, 
  animationDelay = 0,
  onRegenerate,
  isLast 
}) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <motion.div 
      className={`group flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: animationDelay,
        ease: [0.16, 1, 0.3, 1]
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* AI Avatar with glow effect */}
      {!isUser && (
        <motion.div 
          className="flex-shrink-0 mb-1 relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: animationDelay }}
        >
          {/* Avatar glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
          
          {characterAvatar ? (
            <img 
              src={characterAvatar} 
              alt={characterName}
              className="relative w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/20"
            />
          ) : (
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/20">
              {characterName?.[0] || '?'}
            </div>
          )}
        </motion.div>
      )}

      <div className="flex flex-col gap-1 max-w-[75%] md:max-w-[65%] relative">
        {/* Message bubble with 3D effect */}
        <motion.div
          className={`relative rounded-2xl px-4 py-3 ${
            isUser
              ? 'text-white rounded-br-sm'
              : 'text-gray-100 rounded-bl-sm'
          }`}
          style={{
            background: isUser 
              ? 'var(--theme-user-bubble)' 
              : 'var(--theme-ai-bubble)',
            boxShadow: isUser
              ? '0 4px 24px rgba(139, 92, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 -1px 0 rgba(0, 0, 0, 0.1) inset'
              : '0 4px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
            border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="message-content text-[15px]">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic opacity-90">{children}</em>,
                code: ({ inline, children }) => 
                  inline ? (
                    <code className={`px-1.5 py-0.5 rounded-md text-sm font-mono ${
                      isUser ? 'bg-white/20' : 'bg-black/30'
                    }`}>
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-black/40 text-gray-100 p-3 rounded-xl text-sm overflow-x-auto my-2 font-mono border border-white/5">
                      {children}
                    </code>
                  ),
                a: ({ href, children }) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`underline decoration-1 underline-offset-2 transition-colors ${
                      isUser ? 'text-purple-200 hover:text-white' : 'text-purple-400 hover:text-purple-300'
                    }`}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {/* Timestamp and read status */}
          <div className={`flex items-center justify-end gap-1.5 mt-2 ${
            isUser ? 'text-purple-200/70' : 'text-gray-500'
          }`}>
            <span className="text-[11px]">{formatTime(message.created_at)}</span>
            {isUser && (
              <CheckCheck className="w-3.5 h-3.5 text-purple-200/70" />
            )}
          </div>
        </motion.div>

        {/* Message actions - positioned absolutely */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={`absolute -bottom-7 flex items-center gap-1 ${isUser ? 'right-0' : 'left-0'}`}
            >
              <button
                onClick={copyToClipboard}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              
              {!isUser && (
                <>
                  <button
                    onClick={() => setLiked(!liked)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${
                      liked ? 'text-pink-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title="Like message"
                  >
                    <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                  </button>
                  
                  {isLast && onRegenerate && (
                    <button
                      onClick={onRegenerate}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
                      title="Regenerate response"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer for user messages to align with AI avatar space */}
      {isUser && <div className="w-8 flex-shrink-0" />}
    </motion.div>
  )
}
