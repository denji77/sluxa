import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Globe, ArrowLeft, ChevronDown, Filter, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChubCharacters } from '../hooks/useChubCharacters'
import { useChats } from '../hooks/useChats'
import ChubCharacterCard from '../components/Chub/ChubCharacterCard'
import ChubCharacterModal from '../components/Chub/ChubCharacterModal'

export default function ChubBrowsePage() {
  const navigate = useNavigate()
  const { 
    characters, 
    loading, 
    error, 
    hasMore, 
    search, 
    loadMore, 
    getDetails, 
    importCharacter,
    reset 
  } = useChubCharacters()
  const { startChat } = useChats()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [characterDetails, setCharacterDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedIds, setImportedIds] = useState(new Set())
  const [excludeNsfw, setExcludeNsfw] = useState(true)

  // Initial search on mount
  useEffect(() => {
    search('', 1, excludeNsfw)
  }, [])

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (searchTimeout) clearTimeout(searchTimeout)
    
    setSearchTimeout(setTimeout(() => {
      reset()
      search(value, 1, excludeNsfw)
    }, 500))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    reset()
    search(searchQuery, 1, excludeNsfw)
  }

  const handleCharacterClick = async (character) => {
    setSelectedCharacter(character)
    setCharacterDetails(null)
    setLoadingDetails(true)
    
    try {
      const details = await getDetails(character.id)
      setCharacterDetails(details)
    } catch (err) {
      console.error('Failed to get character details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleImport = async (character) => {
    try {
      setImporting(true)
      
      // Import the character
      const importedChar = await importCharacter(character.id)
      setImportedIds(prev => new Set([...prev, character.id]))
      
      // Start a chat with the imported character
      const chat = await startChat(importedChar.id)
      
      // Close modal and navigate to chat
      setSelectedCharacter(null)
      navigate(`/chat/${chat.id}`)
      
    } catch (err) {
      console.error('Failed to import character:', err)
      alert(err.message || 'Failed to import character')
    } finally {
      setImporting(false)
    }
  }

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore()
    }
  }

  return (
    <motion.div 
      className="max-w-4xl mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center gap-4 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={() => navigate('/')}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors glass-card"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </motion.button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="relative">
              <Globe className="w-7 h-7 text-purple-400" />
              <div className="absolute inset-0 blur-lg bg-purple-500/30" />
            </div>
            Browse Chub.ai
          </h1>
          <p className="text-gray-400 mt-1">
            Discover thousands of AI characters
          </p>
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.form 
        onSubmit={handleSearch} 
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex gap-3">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search characters..."
              className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500
                       focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all input-glow"
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium
                     hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Search
          </motion.button>
        </div>
        
        {/* Filter */}
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer group">
            <input
              type="checkbox"
              checked={excludeNsfw}
              onChange={(e) => {
                setExcludeNsfw(e.target.checked)
                reset()
                search(searchQuery, 1, e.target.checked)
              }}
              className="w-4 h-4 rounded border-gray-600 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="group-hover:text-gray-300 transition-colors">Safe mode (exclude NSFW)</span>
          </label>
        </div>
      </motion.form>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {loading && characters.length === 0 ? (
        <motion.div 
          className="flex flex-col items-center justify-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            <div className="absolute inset-0 blur-xl bg-purple-500/30 animate-pulse" />
          </div>
          <p className="text-gray-400 mt-4">Searching characters...</p>
        </motion.div>
      ) : characters.length === 0 ? (
        <motion.div 
          className="text-center py-16"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-gray-300 font-medium">No characters found</p>
          <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
        </motion.div>
      ) : (
        <>
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {characters.map((character, index) => (
              <motion.div 
                key={character.id} 
                onClick={() => handleCharacterClick(character)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ChubCharacterCard
                  character={character}
                  onImport={handleImport}
                  importing={importing && selectedCharacter?.id === character.id}
                  imported={importedIds.has(character.id)}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Load More */}
          {hasMore && (
            <motion.div 
              className="flex justify-center mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.button
                onClick={handleLoadMore}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 glass-card rounded-xl text-gray-300 
                         hover:text-white disabled:opacity-50 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    Load More Characters
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </>
      )}

      {/* Character Detail Modal */}
      <ChubCharacterModal
        character={selectedCharacter}
        details={characterDetails}
        loading={loadingDetails}
        onClose={() => setSelectedCharacter(null)}
        onImport={handleImport}
        importing={importing}
      />
    </motion.div>
  )
}
