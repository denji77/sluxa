export default function TypingIndicator({ characterName, characterAvatar }) {
  return (
    <div className="flex items-end gap-2.5 justify-start message-animate">
      {/* Avatar with pulse effect */}
      <div className="flex-shrink-0 mb-1 relative">
        {characterAvatar ? (
          <img 
            src={characterAvatar} 
            alt={characterName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/30 avatar-pulse"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-purple-500/30 avatar-pulse">
            {characterName?.[0] || '?'}
          </div>
        )}
      </div>

      {/* Typing bubble */}
      <div className="ai-message-style rounded-2xl rounded-bl-sm px-5 py-4">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
          <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
        </div>
      </div>
    </div>
  )
}
