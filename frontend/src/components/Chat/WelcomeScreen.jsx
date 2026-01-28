import { motion } from 'framer-motion'
import { Sparkles, MessageCircle, Wand2, Heart } from 'lucide-react'

export default function WelcomeScreen({ characterName, characterAvatar, onSendMessage }) {
  const suggestions = [
    { text: 'Hello! Tell me about yourself', icon: MessageCircle },
    { text: 'What are your interests?', icon: Heart },
    { text: "Let's play a game!", icon: Wand2 },
  ]

  const handleSuggestionClick = (text) => {
    if (onSendMessage) {
      onSendMessage(text)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div 
        className="text-center max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Animated Avatar */}
        <motion.div 
          className="relative mb-8 inline-block"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
        >
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl opacity-50"
            style={{ 
              background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-accent))',
            }}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          
          {/* Avatar container */}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-accent)] p-1">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#0a0a0f]">
              {characterAvatar ? (
                <img 
                  src={characterAvatar} 
                  alt={characterName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-br from-[var(--theme-primary)]/20 via-[var(--theme-secondary)]/20 to-[var(--theme-accent)]/20">
                  {characterName?.[0] || '?'}
                </div>
              )}
            </div>
          </div>

          {/* Floating sparkles */}
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ 
              y: [-2, 2, -2],
              rotate: [0, 10, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </motion.div>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Meet <span className="gradient-text">{characterName}</span>
          </h2>
          <p className="text-gray-400 leading-relaxed">
            Start a conversation and discover their unique personality. 
            I'm excited to chat with you!
          </p>
        </motion.div>

        {/* Suggested prompts */}
        <motion.div 
          className="mt-8 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            Suggested conversation starters
          </p>
          
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              onClick={() => handleSuggestionClick(suggestion.text)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl 
                       bg-white/5 border border-white/10 
                       hover:bg-white/10 hover:border-[var(--theme-primary)]/30 
                       text-gray-300 hover:text-white
                       transition-all duration-300 group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--theme-primary)]/20 to-[var(--theme-accent)]/20 
                            flex items-center justify-center group-hover:from-[var(--theme-primary)]/30 group-hover:to-[var(--theme-accent)]/30 
                            transition-colors">
                <suggestion.icon className="w-4 h-4 text-[var(--theme-primary)]" />
              </div>
              <span className="text-sm">{suggestion.text}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Typing indicator preview */}
        <motion.div
          className="mt-8 flex items-center justify-center gap-2 text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span className="text-xs">Ready to chat</span>
          <motion.div 
            className="flex gap-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
