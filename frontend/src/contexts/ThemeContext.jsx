import { createContext, useContext, useState, useEffect } from 'react'

const themes = {
  cosmic: {
    name: 'Cosmic Purple',
    primary: '#8b5cf6',
    secondary: '#ec4899',
    accent: '#06b6d4',
    userBubble: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 35%, #a855f7 70%, #c026d3 100%)',
    aiBubble: 'rgba(255, 255, 255, 0.04)',
    background: '#06060a',
  },
  ocean: {
    name: 'Ocean Depths',
    primary: '#06b6d4',
    secondary: '#3b82f6',
    accent: '#10b981',
    userBubble: 'linear-gradient(135deg, #0891b2 0%, #0284c7 50%, #0369a1 100%)',
    aiBubble: 'rgba(6, 182, 212, 0.08)',
    background: '#030712',
  },
  sunset: {
    name: 'Sunset Glow',
    primary: '#f97316',
    secondary: '#ef4444',
    accent: '#eab308',
    userBubble: 'linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #db2777 100%)',
    aiBubble: 'rgba(249, 115, 22, 0.08)',
    background: '#0c0a09',
  },
  forest: {
    name: 'Forest Night',
    primary: '#10b981',
    secondary: '#14b8a6',
    accent: '#84cc16',
    userBubble: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)',
    aiBubble: 'rgba(16, 185, 129, 0.08)',
    background: '#022c22',
  },
  rose: {
    name: 'Rose Gold',
    primary: '#f43f5e',
    secondary: '#ec4899',
    accent: '#f472b6',
    userBubble: 'linear-gradient(135deg, #e11d48 0%, #db2777 50%, #c026d3 100%)',
    aiBubble: 'rgba(244, 63, 94, 0.08)',
    background: '#0f0708',
  },
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('slusha-theme')
    return saved || 'cosmic'
  })

  const theme = themes[currentTheme]

  useEffect(() => {
    localStorage.setItem('slusha-theme', currentTheme)
    
    // Apply CSS variables
    const root = document.documentElement
    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-user-bubble', theme.userBubble)
    root.style.setProperty('--theme-ai-bubble', theme.aiBubble)
    root.style.setProperty('--theme-background', theme.background)
  }, [currentTheme, theme])

  const value = {
    currentTheme,
    setTheme: setCurrentTheme,
    theme,
    themes,
    availableThemes: Object.keys(themes),
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export { themes }
