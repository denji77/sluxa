import { User, Sparkles, MessageCircle, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export default function CharacterCard({ character, onSelect, selected, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={() => onSelect(character)}
      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden group ${
        selected
          ? 'bg-gradient-to-br from-[var(--theme-primary)]/20 to-[var(--theme-accent)]/20 border border-[var(--theme-primary)]/50 ring-2 ring-[var(--theme-primary)]/30'
          : 'glass-card'
      }`}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-primary)]/0 via-[var(--theme-primary)]/10 to-[var(--theme-accent)]/0 
                    opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 
                      bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
      
      <div className="flex items-start gap-4 relative">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {character.avatar_url ? (
            <img
              src={character.avatar_url}
              alt={character.name}
              className={`w-14 h-14 rounded-full object-cover ring-2 transition-all duration-300 ${
                selected ? 'ring-[var(--theme-primary)]/50' : 'ring-[var(--theme-primary)]/20 group-hover:ring-[var(--theme-primary)]/40'
              }`}
            />
          ) : (
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-accent)] 
                          flex items-center justify-center text-white text-xl font-bold ring-2 transition-all duration-300 ${
                            selected ? 'ring-[var(--theme-primary)]/50' : 'ring-[var(--theme-primary)]/20 group-hover:ring-[var(--theme-primary)]/40'
                          }`}>
              {character.name[0]}
            </div>
          )}
          {/* Active indicator */}
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0c0c14]" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate group-hover:text-[var(--theme-primary)] transition-colors">
              {character.name}
            </h3>
            {character.is_default && (
              <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-[var(--theme-primary)]/30 to-[var(--theme-accent)]/30 
                           text-[var(--theme-primary)] rounded-full flex items-center gap-1 border border-[var(--theme-primary)]/30">
                <Sparkles className="w-3 h-3" />
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {character.description?.slice(0, 120)}...
          </p>
          {character.greeting && (
            <p className="text-xs text-gray-500 mt-2 italic truncate flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3 flex-shrink-0" />
              "{character.greeting}"
            </p>
          )}
        </div>

        {/* Chat indicator */}
        <div className={`p-2 rounded-lg transition-all duration-300 ${
          selected 
            ? 'bg-[var(--theme-primary)]/30 text-[var(--theme-primary)]' 
            : 'bg-white/5 text-gray-500 group-hover:bg-[var(--theme-primary)]/20 group-hover:text-[var(--theme-primary)]'
        }`}>
          <Zap className="w-4 h-4" />
        </div>
      </div>
      
      {/* Selected checkmark */}
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </motion.div>
  )
}
