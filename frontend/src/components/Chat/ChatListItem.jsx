import { Link } from 'react-router-dom'
import { MessageSquare, Clock, Trash2, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ChatListItem({ chat, onDelete, index = 0 }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const handleDelete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this chat?')) {
      onDelete(chat.id)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        to={`/chat/${chat.id}`}
        className="block glass-card rounded-xl p-4 group relative overflow-hidden"
      >
        {/* Gradient hover effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-pink-500/0 
                      opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="flex items-start gap-4 relative">
          {/* Character Avatar with online indicator */}
          <div className="relative flex-shrink-0">
            {chat.character_avatar ? (
              <img
                src={chat.character_avatar}
                alt={chat.character_name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold ring-2 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
                {chat.character_name?.[0] || '?'}
              </div>
            )}
            {/* Online dot */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0c0c14]" />
          </div>

          {/* Chat Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                {chat.character_name}
              </h3>
              <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {formatTime(chat.updated_at)}
              </span>
            </div>
            
            <p className="text-sm text-gray-400 truncate mt-0.5">
              {chat.title}
            </p>
            
            {chat.last_message && (
              <p className="text-sm text-gray-500 truncate mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                {chat.last_message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all 
                       opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
              title="Delete chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 
                                   group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
