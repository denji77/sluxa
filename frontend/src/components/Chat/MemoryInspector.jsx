import { useState, useEffect } from 'react'
import { Brain, Trash2, X, AlertTriangle } from 'lucide-react'
import { getMemories, deleteMemory, clearChatMemories } from '../../api/memories'
import { motion, AnimatePresence } from 'framer-motion'

export default function MemoryInspector({ chatId, isOpen, onClose }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchMemories = async () => {
    try {
      setLoading(true)
      const res = await getMemories(chatId)
      setMemories(res.data.memories)
    } catch (err) {
      setError('Failed to load memories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchMemories()
    }
  }, [isOpen, chatId])

  const handleDelete = async (messageId) => {
    try {
      await deleteMemory(chatId, messageId)
      setMemories(prev => prev.filter(m => m.message_id !== messageId))
    } catch (err) {
      alert('Failed to delete memory')
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure? This will wipe the AI\'s long-term memory for this chat.')) return
    try {
      await clearChatMemories(chatId)
      setMemories([])
    } catch (err) {
      alert('Failed to clear memories')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400">
                <Brain className="w-5 h-5" />
                <h2 className="text-lg font-semibold text-white">Neural Memory</h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-center text-gray-500 py-8">Scanning neural pathways...</div>
              ) : memories.length === 0 ? (
                <div className="text-center text-gray-500 py-8 flex flex-col items-center gap-2">
                  <Brain className="w-12 h-12 opacity-20" />
                  <p>No long-term memories formed yet.</p>
                  <p className="text-sm">Chat more to build episodic memory.</p>
                </div>
              ) : (
                memories.map(memory => (
                  <div key={memory.message_id} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 group hover:border-purple-500/30 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className={`text-xs uppercase tracking-wider font-bold mb-1 block ${
                          memory.role === 'user' ? 'text-blue-400' : 'text-purple-400'
                        }`}>
                          {memory.role}
                        </span>
                        <p className="text-gray-300 text-sm line-clamp-3">{memory.content_preview}</p>
                        <p className="text-gray-600 text-xs mt-2">
                          Formed: {new Date(memory.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(memory.message_id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Forget this memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {memories.length > 0 && (
              <div className="p-4 border-t border-gray-800 bg-gray-900/50 rounded-b-xl flex justify-between items-center">
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  Deleted memories cannot be recovered.
                </div>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Wipe All Memory
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
