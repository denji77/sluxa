import { UserButton } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, Users, Home, Globe, Sparkles, Loader2, Palette, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useApiAuth } from '../../hooks/useApiAuth'
import ThemeSelector from '../Settings/ThemeSelector'
import GradientOrbs from '../Effects/GradientOrbs'

export default function Layout({ children }) {
  const location = useLocation()
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  
  // Set up API auth with Clerk token
  const { isReady } = useApiAuth()
  
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/characters', icon: Users, label: 'Characters' },
    { path: '/chub', icon: Globe, label: 'Chub.ai' },
  ]

  // Check if we're on a chat page for dark theme
  const isChatPage = location.pathname.startsWith('/chat/')

  // Show loading while auth is being set up
  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        {/* Aurora background */}
        <GradientOrbs />
        
        <motion.div 
          className="flex flex-col items-center gap-4 relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <p className="text-gray-400 font-medium">Loading Sluxa...</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Ambient background glow */}
      {!isChatPage && <GradientOrbs />}
      
      {/* Theme Selector Modal */}
      <AnimatePresence>
        {showThemeSelector && (
          <ThemeSelector onClose={() => setShowThemeSelector(false)} />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b ${
        isChatPage 
          ? 'glass border-white/10' 
          : 'glass border-white/5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-accent)] flex items-center justify-center shadow-lg shadow-[var(--theme-primary)]/25">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--theme-primary)] via-[var(--theme-secondary)] to-[var(--theme-accent)] blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              </motion.div>
              <span className="text-xl font-bold gradient-text">Sluxa</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className="relative"
                  >
                    <motion.div
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors duration-200 ${
                        isActive
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </motion.div>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-[var(--theme-primary)]/20 to-[var(--theme-accent)]/20 rounded-xl border border-[var(--theme-primary)]/30"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Profile Button */}
              <Link to="/profile">
                <motion.div
                  className="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Profile settings"
                >
                  <User className="w-4 h-4" />
                </motion.div>
              </Link>
              
              {/* Theme Selector Button */}
              <motion.button
                onClick={() => setShowThemeSelector(true)}
                className="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Change theme"
              >
                <Palette className="w-4 h-4" />
              </motion.button>
              
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 ring-2 ring-[var(--theme-primary)]/30 hover:ring-[var(--theme-primary)]/50 transition-all"
                  }
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/10 z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="relative flex flex-col items-center gap-1 px-4 py-2"
              >
                <motion.div
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? 'text-[var(--theme-primary)]' : 'text-gray-500'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </motion.div>
                {isActive && (
                  <motion.div
                    layoutId="activeMobileTab"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
          
          {/* Mobile Profile Button */}
          <Link
            to="/profile"
            className={`relative flex flex-col items-center gap-1 px-4 py-2 ${
              location.pathname === '/profile' ? 'text-[var(--theme-primary)]' : 'text-gray-500'
            }`}
          >
            <motion.div
              className="flex flex-col items-center gap-1"
              whileTap={{ scale: 0.9 }}
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-medium">Profile</span>
            </motion.div>
            {location.pathname === '/profile' && (
              <motion.div
                layoutId="activeMobileTab"
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)]"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </Link>
          
          {/* Mobile Theme Button */}
          <motion.button
            onClick={() => setShowThemeSelector(true)}
            className="relative flex flex-col items-center gap-1 px-4 py-2 text-gray-500"
            whileTap={{ scale: 0.9 }}
          >
            <Palette className="w-5 h-5" />
            <span className="text-xs font-medium">Theme</span>
          </motion.button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 relative z-10 overflow-hidden ${isChatPage ? '' : 'pb-20 md:pb-0 overflow-y-auto'}`}>
        {children}
      </main>
    </div>
  )
}
