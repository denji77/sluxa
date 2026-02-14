import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, Loader2, Globe, Sparkles, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChats } from '../hooks/useChats'
import { useCharacters } from '../hooks/useCharacters'
import ChatListItem from '../components/Chat/ChatListItem'
import CharacterCard from '../components/Characters/CharacterCard'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export default function HomePage() {
  const navigate = useNavigate()
  const { chats, loading: chatsLoading, deleteChat } = useChats()
  const { characters, loading: charactersLoading } = useCharacters()
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [creatingChat, setCreatingChat] = useState(false)
  const { startChat } = useChats()

  const handleStartChat = async (character) => {
    if (creatingChat) return
    
    try {
      setCreatingChat(true)
      const chat = await startChat(character.id)
      navigate(`/chat/${chat.id}`)
    } catch (error) {
      console.error('Failed to start chat:', error)
      alert('Failed to start chat. Please try again.')
    } finally {
      setCreatingChat(false)
    }
  }

  const handleDeleteChat = async (chatId) => {
    try {
      await deleteChat(chatId)
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat. Please try again.')
    }
  }

  return (
    <motion.div 
      className="max-w-6xl mx-auto px-4 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8 text-center sm:text-left">
        <h1 className="text-4xl font-bold text-white flex items-center gap-3 justify-center sm:justify-start">
          <div className="relative">
            <Sparkles className="w-10 h-10 text-[var(--theme-primary)]" />
            <div className="absolute inset-0 blur-xl bg-[var(--theme-primary)]/30" />
          </div>
          Welcome to <span className="gradient-text">Sluxa</span>
        </h1>
        <p className="text-gray-400 mt-3 text-lg">Your AI character chat companion</p>
      </motion.div>

      {/* Stats Bar */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active Chats', value: chats.length, icon: MessageSquare },
          { label: 'Characters', value: characters.length, icon: Zap },
          { label: 'Messages Today', value: '∞', icon: TrendingUp },
        ].map((stat, i) => (
          <div key={i} className="glass-card rounded-xl p-4 text-center">
            <stat.icon className="w-5 h-5 mx-auto mb-2 text-[var(--theme-primary)]" />
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* Chub.ai Banner */}
      <motion.div 
        variants={itemVariants}
        onClick={() => navigate('/chub')}
        className="mb-8 relative overflow-hidden rounded-2xl cursor-pointer group"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-accent)]" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        
        <div className="relative p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <Globe className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Browse Chub.ai Characters</h2>
              <p className="text-white/80 mt-1">
                Discover thousands of community-created AI characters
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-6 py-3 bg-white/20 rounded-xl text-white font-medium 
                         group-hover:bg-white/30 transition-colors backdrop-blur-sm">
            Explore
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                      translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Chats */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Recent Chats
            </h2>
          </div>

          {chatsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
                <div className="absolute inset-0 blur-xl bg-[var(--theme-primary)]/30 animate-pulse" />
              </div>
            </div>
          ) : chats.length === 0 ? (
            <motion.div 
              className="glass-card rounded-2xl p-8 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--theme-primary)]/20 to-[var(--theme-accent)]/20 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[var(--theme-primary)]" />
              </div>
              <p className="text-gray-300 font-medium">No chats yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Select a character below to start chatting
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {chats.slice(0, 5).map((chat, index) => (
                <ChatListItem 
                  key={chat.id} 
                  chat={chat} 
                  onDelete={handleDeleteChat}
                  index={index}
                />
              ))}
              {chats.length > 5 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  And {chats.length - 5} more chats...
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Characters */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--theme-accent)]" />
              Start New Chat
            </h2>
            <motion.button
              onClick={() => navigate('/characters')}
              className="text-sm text-[var(--theme-primary)] hover:text-[var(--theme-accent)] flex items-center gap-1 transition-colors"
              whileHover={{ x: 4 }}
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>

          {charactersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
                <div className="absolute inset-0 blur-xl bg-[var(--theme-primary)]/30 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {characters.slice(0, 4).map((character, index) => (
                <div 
                  key={character.id}
                  onClick={() => handleStartChat(character)}
                  className={`cursor-pointer ${creatingChat ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <CharacterCard
                    character={character}
                    selected={selectedCharacter?.id === character.id}
                    onSelect={setSelectedCharacter}
                    index={index}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
