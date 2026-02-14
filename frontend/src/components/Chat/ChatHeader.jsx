import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2, MoreVertical, Info, BookOpen, MessageCircle, Brain, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import CharacterInfoModal from './CharacterInfoModal'
import MemoryInspector from './MemoryInspector'
import { getFormattedTime, isSynced } from '../../utils/timeSync'

export default function ChatHeader({ chat, onDelete, chatMode, onModeChange }) {
  const character = chat?.character
  const [showMenu, setShowMenu] = useState(false)
  const [showCharacterInfo, setShowCharacterInfo] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [currentTime, setCurrentTime] = useState(getFormattedTime())

  // Live clock — update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getFormattedTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isDescriptive = chatMode === 'descriptive'

  return (
    <div className="glass border-b border-white/10 px-4 py-3 relative z-10">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-all duration-200 group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              {character?.avatar_url ? (
                <img 
                  src={character.avatar_url} 
                  alt={character.name}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-purple-500/30"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg ring-2 ring-purple-500/30">
                  {character?.name?.[0] || '?'}
                </div>
              )}
              {/* Online indicator */}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0f0f18] online-indicator" />
            </div>
            
            <div>
              <h2 className="font-semibold text-white text-base">{character?.name || 'Unknown'}</h2>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                Online
                <span className="text-gray-500 ml-1">·</span>
                <Clock className="w-3 h-3 text-gray-400" />
                <span className={`text-gray-400 ${isSynced() ? '' : 'opacity-60'}`}>{currentTime}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-20">
          <button
            onClick={() => setShowMemory(true)}
            className="p-2 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-xl transition-all"
            title="View Neural Memory"
          >
            <Brain className="w-5 h-5" />
          </button>

          {/* Chat Mode Toggle — Neubrutalism style */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Mode toggle clicked, current mode:', chatMode, 'onModeChange:', typeof onModeChange)
              if (onModeChange) {
                onModeChange(isDescriptive ? 'normal' : 'descriptive')
              } else {
                console.error('onModeChange is not defined!')
              }
            }}
            className={`flex items-center justify-center gap-1.5 px-3 h-9 font-medium text-white transition-all cursor-pointer rounded-lg ${
              isDescriptive
                ? 'bg-purple-500 shadow-[3px_3px_0px_rgba(168,85,247,0.4)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]'
                : 'bg-pink-500 shadow-[3px_3px_0px_rgba(236,72,153,0.4)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]'
            }`}
            title={isDescriptive ? 'Switch to Normal mode' : 'Switch to Descriptive mode'}
          >
            {isDescriptive ? (
              <>
                <BookOpen className="w-4 h-4" />
                <span className="text-xs font-semibold hidden sm:inline">RP</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs font-semibold hidden sm:inline">Chat</span>
              </>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-20">
                  {/* Mobile Mode Toggle */}
                  <button
                    onClick={() => {
                      onModeChange(isDescriptive ? 'normal' : 'descriptive')
                      setShowMenu(false)
                    }}
                    className="sm:hidden w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    {isDescriptive ? (
                      <>
                        <MessageCircle className="w-4 h-4 text-[var(--theme-accent)]" />
                        Switch to Normal Mode
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4 text-[var(--theme-primary)]" />
                        Switch to Descriptive Mode
                      </>
                    )}
                  </button>
                  
                  {/* Current Mode Indicator */}
                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-xs text-gray-500">Current Mode</p>
                    <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5">
                      {isDescriptive ? (
                        <>
                          <BookOpen className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                          Descriptive (Roleplay)
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                          Normal (Chat)
                        </>
                      )}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowCharacterInfo(true)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    View Character Info
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onDelete()
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Chat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Character Info Modal */}
      <CharacterInfoModal
        character={character}
        isOpen={showCharacterInfo}
        onClose={() => setShowCharacterInfo(false)}
      />
      <MemoryInspector
        chatId={chat?.id}
        isOpen={showMemory}
        onClose={() => setShowMemory(false)}
      />
    </div>
  )
}
