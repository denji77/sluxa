import { useState, useRef, useEffect } from 'react'
import { Send, BookOpen, MessageCircle } from 'lucide-react'

export default function MessageInput({ onSend, disabled, characterName, chatMode, onModeChange }) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)
  const isDescriptive = chatMode === 'descriptive'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [message])

  return (
    <div className="glass border-t border-white/10 px-4 py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-3">
          {/* Mode Toggle Button */}
          <button
            type="button"
            onClick={() => onModeChange && onModeChange(isDescriptive ? 'normal' : 'descriptive')}
            className="flex items-center justify-center gap-1.5 px-3 h-12 rounded-xl bg-gradient-to-br from-[var(--theme-primary)]/20 to-[var(--theme-accent)]/20 border border-[var(--theme-primary)]/30 hover:border-[var(--theme-primary)]/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={isDescriptive ? 'Descriptive Mode (Roleplay) - Click to switch' : 'Normal Mode (Chat) - Click to switch'}
          >
            {isDescriptive ? (
              <>
                <BookOpen className="w-5 h-5 text-[var(--theme-primary)]" />
                <span className="text-xs text-[var(--theme-primary)] font-medium hidden sm:inline">RP</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 text-[var(--theme-accent)]" />
                <span className="text-xs text-[var(--theme-accent)] font-medium hidden sm:inline">Chat</span>
              </>
            )}
          </button>

          {/* Input container */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${characterName || 'character'}...`}
              disabled={disabled}
              rows={1}
              className="w-full resize-none rounded-2xl bg-white/5 border border-white/10 
                       px-4 py-3 pr-4 text-white placeholder-gray-500
                       focus:outline-none focus:border-[var(--theme-primary)]/50 input-glow
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-btn flex items-center justify-center w-12 h-12 rounded-xl
                     text-white disabled:opacity-30 disabled:cursor-not-allowed
                     disabled:shadow-none disabled:transform-none
                     focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Helper text */}
        <p className="text-center text-xs text-gray-600 mt-3">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono text-[10px]">Shift + Enter</kbd> for new line
        </p>
      </form>
    </div>
  )
}
