import { useCallback, useMemo } from 'react'
import Particles from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

export default function ParticleBackground({ variant = 'default' }) {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine)
  }, [])

  const options = useMemo(() => {
    const baseOptions = {
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        color: {
          value: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899'],
        },
        links: {
          color: '#8b5cf6',
          distance: 150,
          enable: true,
          opacity: 0.1,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.5,
          direction: 'none',
          random: true,
          straight: false,
          outModes: {
            default: 'out',
          },
        },
        number: {
          value: 50,
          density: {
            enable: true,
            area: 800,
          },
        },
        opacity: {
          value: { min: 0.1, max: 0.4 },
          animation: {
            enable: true,
            speed: 0.5,
            minimumValue: 0.1,
          },
        },
        shape: {
          type: 'circle',
        },
        size: {
          value: { min: 1, max: 3 },
        },
      },
      detectRetina: true,
    }

    if (variant === 'chat') {
      return {
        ...baseOptions,
        particles: {
          ...baseOptions.particles,
          number: { value: 30, density: { enable: true, area: 1000 } },
          opacity: { value: { min: 0.05, max: 0.2 } },
          links: { ...baseOptions.particles.links, opacity: 0.05 },
        },
      }
    }

    if (variant === 'hero') {
      return {
        ...baseOptions,
        particles: {
          ...baseOptions.particles,
          number: { value: 80, density: { enable: true, area: 600 } },
          move: { ...baseOptions.particles.move, speed: 1 },
        },
      }
    }

    return baseOptions
  }, [variant])

  return (
    <Particles
      className="absolute inset-0 pointer-events-none"
      init={particlesInit}
      options={options}
    />
  )
}
