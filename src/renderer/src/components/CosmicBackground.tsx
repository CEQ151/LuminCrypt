import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
  hue: number
}

interface CosmicBackgroundProps {
  bgImageUrl?: string | null
}

export default function CosmicBackground({ bgImageUrl }: CosmicBackgroundProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef<number>(0)
  const timeRef = useRef(0)

  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.floor((width * height) / 12000)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      const isStar = Math.random() > 0.85
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: isStar ? Math.random() * 2 + 1 : Math.random() * 1.2 + 0.3,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        hue: Math.random() > 0.7 ? 280 + Math.random() * 40 : 190 + Math.random() * 20,
      })
    }
    return particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      particlesRef.current = initParticles(rect.width, rect.height)
    }

    resize()

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseout', onMouseLeave)
    window.addEventListener('resize', resize)

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      timeRef.current += 1

      ctx.clearRect(0, 0, w, h)

      // Large ambient nebula and aurora glow fields
      const nebula1 = ctx.createRadialGradient(w * 0.18, h * 0.2, 0, w * 0.18, h * 0.2, w * 0.46)
      nebula1.addColorStop(0, 'rgba(125, 211, 252, 0.04)')
      nebula1.addColorStop(1, 'transparent')
      ctx.fillStyle = nebula1
      ctx.fillRect(0, 0, w, h)

      const nebula2 = ctx.createRadialGradient(w * 0.78, h * 0.18, 0, w * 0.78, h * 0.18, w * 0.3)
      nebula2.addColorStop(0, 'rgba(139, 147, 255, 0.03)')
      nebula2.addColorStop(1, 'transparent')
      ctx.fillStyle = nebula2
      ctx.fillRect(0, 0, w, h)

      const nebula3 = ctx.createRadialGradient(w * 0.72, h * 0.78, 0, w * 0.72, h * 0.78, w * 0.28)
      nebula3.addColorStop(0, 'rgba(110, 231, 183, 0.025)')
      nebula3.addColorStop(1, 'transparent')
      ctx.fillStyle = nebula3
      ctx.fillRect(0, 0, w, h)

      const particles = particlesRef.current
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Twinkle
        const twinkle = Math.sin(timeRef.current * p.twinkleSpeed + p.twinklePhase) * 0.5 + 0.5
        const currentOpacity = p.opacity * (0.4 + twinkle * 0.6)

        // Mouse interaction - particles drift away from cursor
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001)
        if (dist < 120) {
          const force = (120 - dist) / 120
          p.speedX += (dx / dist) * force * 0.02
          p.speedY += (dy / dist) * force * 0.02
        }

        // Apply friction
        p.speedX *= 0.995
        p.speedY *= 0.995

        // Movement
        p.x += p.speedX
        p.y += p.speedY

        // Wrap around
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        // Draw particle
        const isStar = p.size > 1.5
        if (isStar) {
          // Star with cross flare
          ctx.save()
          ctx.globalAlpha = currentOpacity
          ctx.fillStyle = `hsl(${p.hue}, 80%, 75%)`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()

          // Cross flare for bright stars
          ctx.strokeStyle = `hsl(${p.hue}, 60%, 70%)`
          ctx.lineWidth = 0.5
          ctx.globalAlpha = currentOpacity * 0.4
          ctx.beginPath()
          ctx.moveTo(p.x - p.size * 3, p.y)
          ctx.lineTo(p.x + p.size * 3, p.y)
          ctx.moveTo(p.x, p.y - p.size * 3)
          ctx.lineTo(p.x, p.y + p.size * 3)
          ctx.stroke()
          ctx.restore()
        } else {
          // Small dust particle
          ctx.save()
          ctx.globalAlpha = currentOpacity * 0.7
          ctx.fillStyle = `hsl(${p.hue}, 40%, 70%)`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // Draw faint connection lines between nearby particles
      ctx.save()
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i]
          const p2 = particles[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80) {
            ctx.globalAlpha = (1 - dist / 80) * 0.15
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }
      ctx.restore()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseout', onMouseLeave)
      window.removeEventListener('resize', resize)
    }
  }, [initParticles])

  const hasBgImage = !!bgImageUrl

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* User-uploaded background image layer */}
      {bgImageUrl && (
        <img
          key={bgImageUrl}
          src={bgImageUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: 1,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}

      {/* Cosmic layers — hidden when a custom bg image is active */}
      {!hasBgImage && (
        <>
          <div className="cosmic-aurora cosmic-aurora--north" />
          <div className="cosmic-aurora cosmic-aurora--arc" />
          <div className="cosmic-ion-stream cosmic-ion-stream--one" />
          <div className="cosmic-ion-stream cosmic-ion-stream--two" />
          <div className="cosmic-ion-stream cosmic-ion-stream--three" />

          <div className="cosmic-planet cosmic-planet--major">
            <div className="cosmic-planet__atmosphere" />
            <div className="cosmic-planet__core" />
            <div className="cosmic-planet__ring" />
          </div>

          <div className="cosmic-planet cosmic-planet--minor">
            <div className="cosmic-planet__atmosphere" />
            <div className="cosmic-planet__core" />
            <div className="cosmic-planet__ring" />
          </div>
        </>
      )}

      {/* Particle canvas — always shown (draws transparent nebula on custom bg) */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: hasBgImage ? 0.3 : 1,
          transition: 'opacity 0.6s ease',
        }}
      />

      <div className="cosmic-vignette" />
    </div>
  )
}
