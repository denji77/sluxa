import { useState, useEffect } from 'react'
import { X, Loader2, Star, MessageCircle, Download, Sparkles } from 'lucide-react'

export default function ChubCharacterModal({ 
  character, 
  details, 
  loading, 
  onClose, 
  onImport, 
  importing 
}) {
  if (!character) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f18] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start gap-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          {character.avatar_url ? (
            <img
              src={character.avatar_url}
              alt={character.name}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0 ring-2 ring-purple-500/30"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 ring-2 ring-purple-500/30">
              {character.name[0]}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{character.name}</h2>
            {character.tagline && (
              <p className="text-gray-400 mt-1">{character.tagline}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-4 h-4" />
                {character.rating?.toFixed(1) || '0.0'}
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                {character.nChats?.toLocaleString() || 0} chats
              </span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Description
                </h3>
                <p className="text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {details.description || character.description || 'No description available'}
                </p>
              </div>

              {/* Greeting */}
              {details.first_mes && (
                <div>
                  <h3 className="font-semibold text-white mb-2">First Message</h3>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-gray-300 italic">
                    "{details.first_mes}"
                  </div>
                </div>
              )}

              {/* Scenario */}
              {details.scenario && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Scenario</h3>
                  <p className="text-gray-400">{details.scenario}</p>
                </div>
              )}

              {/* Creator */}
              {details.creator && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Creator</h3>
                  <p className="text-gray-400">{details.creator}</p>
                </div>
              )}

              {/* Tags */}
              {details.tags && details.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {details.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-purple-500/10 text-purple-300 rounded-full text-sm border border-purple-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {character.description || 'No additional details available'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-white/10 rounded-xl text-gray-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onImport(character)}
            disabled={importing}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl 
                     hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Import & Start Chat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
