import { X, User, FileText, Calendar, Tag } from 'lucide-react'

export default function CharacterInfoModal({ character, isOpen, onClose }) {
  if (!isOpen || !character) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg glass rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Avatar */}
          <div className="absolute -bottom-12 left-6">
            {character.avatar_url ? (
              <img 
                src={character.avatar_url} 
                alt={character.name}
                className="w-24 h-24 rounded-2xl object-cover ring-4 ring-[#0f0f18] shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-[#0f0f18] shadow-xl">
                {character.name?.[0] || '?'}
              </div>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="pt-16 pb-6 px-6">
          <h2 className="text-2xl font-bold text-white mb-1">{character.name}</h2>
          
          {character.tagline && (
            <p className="text-gray-400 text-sm mb-4">{character.tagline}</p>
          )}
          
          {/* Stats */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
            {character.created_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Created {new Date(character.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          {/* Description */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Description
              </h3>
              <div className="bg-white/5 rounded-xl p-4 max-h-48 overflow-y-auto">
                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {character.description || 'No description available.'}
                </p>
              </div>
            </div>
            
            {character.greeting && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Greeting
                </h3>
                <div className="bg-white/5 rounded-xl p-4 max-h-32 overflow-y-auto">
                  <p className="text-gray-300 text-sm italic whitespace-pre-wrap leading-relaxed">
                    "{character.greeting}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
