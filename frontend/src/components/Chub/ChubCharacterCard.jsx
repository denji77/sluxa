import { Star, MessageCircle, Users, Check, ExternalLink, Sparkles } from 'lucide-react'

export default function ChubCharacterCard({ character, onImport, importing, imported }) {
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  return (
    <div className="glass rounded-xl border border-white/10 hover:border-purple-500/50 hover:bg-white/5 transition-all duration-200 p-4 cursor-pointer group">
      <div className="flex gap-4">
        {/* Avatar */}
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt={character.name}
            className="w-20 h-20 rounded-xl object-cover flex-shrink-0 ring-2 ring-purple-500/20"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 ring-2 ring-purple-500/20">
            {character.name[0]}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate flex items-center gap-2">
                {character.name}
                {character.verified && (
                  <span className="text-blue-400" title="Verified">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </h3>
              {character.tagline && (
                <p className="text-sm text-gray-400 truncate">{character.tagline}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-400 mt-2 line-clamp-2">
            {character.description || 'No description available'}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1" title="Rating">
              <Star className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400/80">{character.rating?.toFixed(1) || '0.0'}</span>
            </span>
            <span className="flex items-center gap-1" title="Chats">
              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
              {formatNumber(character.nChats || 0)}
            </span>
            <span className="flex items-center gap-1" title="Messages">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              {formatNumber(character.nMessages || 0)}
            </span>
            <span className="text-gray-500">
              {formatNumber(character.nTokens || 0)} tokens
            </span>
          </div>

          {/* Topics/Tags */}
          {character.topics && character.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {character.topics.slice(0, 4).map((topic, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/20"
                >
                  {topic}
                </span>
              ))}
              {character.topics.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-gray-500">
                  +{character.topics.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <a
          href={`https://chub.ai/characters/${character.fullPath}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-gray-500 hover:text-purple-400 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View on Chub.ai
        </a>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onImport(character)
          }}
          disabled={importing || imported}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            imported
              ? 'bg-emerald-500/20 text-emerald-400 cursor-default border border-emerald-500/30'
              : importing
              ? 'bg-white/5 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
          }`}
        >
          {imported ? (
            <>
              <Check className="w-4 h-4" />
              Imported
            </>
          ) : importing ? (
            'Importing...'
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Import & Chat
            </>
          )}
        </button>
      </div>
    </div>
  )
}
