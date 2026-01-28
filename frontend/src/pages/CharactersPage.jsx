import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Users, Globe, Sparkles } from 'lucide-react'
import { useCharacters } from '../hooks/useCharacters'
import { useChats } from '../hooks/useChats'
import CharacterCard from '../components/Characters/CharacterCard'
import CreateCharacterModal from '../components/Characters/CreateCharacterModal'

export default function CharactersPage() {
  const navigate = useNavigate()
  const { characters, loading, createCharacter } = useCharacters()
  const { startChat } = useChats()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingChat, setCreatingChat] = useState(false)

  const handleSelectCharacter = async (character) => {
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

  const handleCreateCharacter = async (characterData) => {
    await createCharacter(characterData)
  }

  const defaultCharacters = characters.filter(c => c.is_default)
  const customCharacters = characters.filter(c => !c.is_default)

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            Characters
          </h1>
          <p className="text-gray-400 mt-2">
            Choose a character to start chatting with
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/chub')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl 
                       hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200"
          >
            <Globe className="w-5 h-5" />
            Browse Chub.ai
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl 
                       hover:bg-white/20 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Create
          </button>
        </div>
      </div>

      {/* Custom Characters */}
      {customCharacters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Your Characters
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {customCharacters.map((character) => (
              <div 
                key={character.id}
                className={creatingChat ? 'opacity-50 pointer-events-none' : ''}
              >
                <CharacterCard
                  character={character}
                  onSelect={handleSelectCharacter}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default Characters */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          {customCharacters.length > 0 ? 'Default Characters' : 'Available Characters'}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {defaultCharacters.map((character) => (
            <div 
              key={character.id}
              className={creatingChat ? 'opacity-50 pointer-events-none' : ''}
            >
              <CharacterCard
                character={character}
                onSelect={handleSelectCharacter}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {characters.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-gray-400">No characters available</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
          >
            Create your first character
          </button>
        </div>
      )}

      {/* Create Character Modal */}
      <CreateCharacterModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCharacter}
      />
    </div>
  )
}
