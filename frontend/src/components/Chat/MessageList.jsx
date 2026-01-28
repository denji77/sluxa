import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import WelcomeScreen from './WelcomeScreen'

export default function MessageList({ messages, isTyping, characterName, characterAvatar, onRegenerate, onSendMessage }) {
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  if (messages.length === 0 && !isTyping) {
    return (
      <WelcomeScreen 
        characterName={characterName}
        characterAvatar={characterAvatar}
        onSendMessage={onSendMessage}
      />
    )
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 relative"
      onScroll={handleScroll}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isUser={message.role === 'user'}
            characterName={characterName}
            characterAvatar={characterAvatar}
            animationDelay={0}
            isLast={index === messages.length - 1 && message.role === 'assistant'}
            onRegenerate={onRegenerate}
          />
        ))}
        
        {isTyping && (
          <TypingIndicator 
            characterName={characterName} 
            characterAvatar={characterAvatar}
          />
        )}
        
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-3 rounded-full bg-purple-500/90 text-white shadow-lg 
                     shadow-purple-500/30 hover:bg-purple-500 hover:scale-105 transition-all z-10"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
