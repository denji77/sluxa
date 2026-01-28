import { motion, AnimatePresence } from 'framer-motion'
import { X, Palette, Check } from 'lucide-react'
import { useTheme, themes } from '../../contexts/ThemeContext'

export default function ThemeSelector({ isOpen, onClose }) {
  const { currentTheme, setTheme } = useTheme()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md glass rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Theme Settings</h2>
                <p className="text-sm text-gray-400">Personalize your experience</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Theme Grid */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400 mb-4">Choose a color theme that matches your style</p>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(themes).map(([key, theme]) => (
                <motion.button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`relative p-4 rounded-xl border transition-all ${
                    currentTheme === key
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Color preview */}
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-6 h-6 rounded-full shadow-lg"
                      style={{ background: theme.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-lg"
                      style={{ background: theme.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full shadow-lg"
                      style={{ background: theme.accent }}
                    />
                  </div>
                  
                  {/* Theme name */}
                  <p className="text-sm font-medium text-white text-left">{theme.name}</p>
                  
                  {/* Selected indicator */}
                  {currentTheme === key && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
          
          {/* Preview */}
          <div className="p-6 border-t border-white/10">
            <p className="text-xs text-gray-500 mb-3">Preview</p>
            <div className="flex gap-3">
              <div 
                className="flex-1 p-3 rounded-xl text-sm text-white shadow-lg"
                style={{ background: themes[currentTheme].userBubble }}
              >
                Your message
              </div>
              <div 
                className="flex-1 p-3 rounded-xl text-sm text-gray-300 border border-white/10"
                style={{ background: themes[currentTheme].aiBubble }}
              >
                AI response
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
