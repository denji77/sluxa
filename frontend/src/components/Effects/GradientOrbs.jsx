import { motion } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'

export default function GradientOrbs() {
  const { currentTheme } = useTheme()
  
  // Get theme colors for orbs
  const getOrbColors = () => {
    const colors = {
      cosmic: {
        primary: 'rgba(139, 92, 246, 0.3)',
        secondary: 'rgba(236, 72, 153, 0.25)',
        tertiary: 'rgba(6, 182, 212, 0.2)',
        accent: 'rgba(99, 102, 241, 0.2)',
      },
      ocean: {
        primary: 'rgba(6, 182, 212, 0.3)',
        secondary: 'rgba(14, 165, 233, 0.25)',
        tertiary: 'rgba(59, 130, 246, 0.2)',
        accent: 'rgba(34, 197, 94, 0.2)',
      },
      sunset: {
        primary: 'rgba(249, 115, 22, 0.3)',
        secondary: 'rgba(244, 63, 94, 0.25)',
        tertiary: 'rgba(234, 179, 8, 0.2)',
        accent: 'rgba(236, 72, 153, 0.2)',
      },
      forest: {
        primary: 'rgba(34, 197, 94, 0.3)',
        secondary: 'rgba(16, 185, 129, 0.25)',
        tertiary: 'rgba(6, 182, 212, 0.2)',
        accent: 'rgba(132, 204, 22, 0.2)',
      },
      rose: {
        primary: 'rgba(236, 72, 153, 0.3)',
        secondary: 'rgba(244, 63, 94, 0.25)',
        tertiary: 'rgba(139, 92, 246, 0.2)',
        accent: 'rgba(249, 115, 22, 0.2)',
      },
    }
    return colors[currentTheme] || colors.cosmic
  }
  
  const orbColors = getOrbColors()
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary orb */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${orbColors.primary} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          top: '-10%',
          left: '-10%',
        }}
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Secondary orb */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${orbColors.secondary} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          bottom: '-10%',
          right: '-10%',
        }}
        animate={{
          x: [0, -80, -40, 0],
          y: [0, -60, -120, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Tertiary orb */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${orbColors.tertiary} 0%, transparent 70%)`,
          filter: 'blur(50px)',
          top: '40%',
          right: '20%',
        }}
        animate={{
          x: [0, -50, 50, 0],
          y: [0, 80, -40, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Small accent orb */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${orbColors.accent} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          bottom: '30%',
          left: '10%',
        }}
        animate={{
          x: [0, 60, 30, 0],
          y: [0, -40, 60, 0],
          scale: [0.9, 1.1, 1, 0.9],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
