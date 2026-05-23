import { useRef, useEffect } from 'react'
import type { LineStats } from '../types'
import { noise2D } from '../utils/noise'
import { getPairHue, hslString } from '../utils/color'

interface Props {
  stats: LineStats
  pullOffset?: number
  meetFlash?: number
}

interface Vis {
  thickness: number; alpha: number; sat: number; light: number; jitterAmp: number; hue: number
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function lerpVis(from: Vis, to: Vis, t: number): Vis {
  return {
    thickness: lerp(from.thickness, to.thickness, t),
    alpha: lerp(from.alpha, to.alpha, t),
    sat: lerp(from.sat, to.sat, t),
    light: lerp(from.light, to.light, t),
    jitterAmp: lerp(from.jitterAmp, to.jitterAmp, t),
    hue: lerp(from.hue, to.hue, t),
  }
}

const INITIAL_CHARS = '你我他她心念等伴牵缘'

function pickChar(seed: number): string {
  return INITIAL_CHARS[Math.abs(seed) % INITIAL_CHARS.length]
}

interface Particle { x: number; y: number; vx: number; vy: number; size: number; life: number }

export default function LineCanvas({ stats, pullOffset = 0, meetFlash = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const timeRef = useRef<number>(0)
  const statsRef = useRef(stats)
  const pullRef = useRef(pullOffset)
  const flashRef = useRef(0)
  const currentRef = useRef<Vis | null>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const rectRef = useRef({ w: 0, h: 0 })
  const particlesRef = useRef<Particle[]>([])

  statsRef.current = stats
  pullRef.current = pullOffset

  useEffect(() => {
    if (meetFlash) flashRef.current = 1
  }, [meetFlash])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function updateSize() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      rectRef.current = { w: rect.width, h: rect.height }
      const pw = Math.round(rect.width * dpr)
      const ph = Math.round(rect.height * dpr)
      if (sizeRef.current.w !== pw || sizeRef.current.h !== ph) {
        sizeRef.current = { w: pw, h: ph, dpr }
        canvas!.width = pw
        canvas!.height = ph
      }
    }

    function bezY(frac: number, h: number, midY: number, t: number, ja: number): number {
      const b = 4 * (frac - 0.5) * (frac - 0.5) * h * 0.15
      const nx = noise2D(frac * 10, t * 0.7) * ja * 4
      const ny = noise2D(frac * 10 + 100, t * 0.6) * ja * 4
      return midY + b + nx + ny - ja * 2
    }

    function targetVis(s: LineStats): Vis {
      const base = getPairHue(s.pairStartDate)
      const days = s.daysSinceLastMeet
      let t = Math.min(1 + s.recentMeetDates.length * 1.5, 8)
      let a = 1; let sat = 65; let lt = 55; let ja = 3

      switch (s.lineState) {
        case 'warning': a = 0.7; sat = 45; lt = 42; ja = 7; t *= 0.75; break
        case 'critical': a = 0.4; sat = 25; lt = 32; ja = 11; t = 1; break
        case 'disconnected': a = 0.25; sat = 0; lt = 40; ja = 2; t = 0.5; break
      }

      const warmth = days != null && days <= 60 ? lerp(220, 10, (60 - days) / 60) : base
      return { thickness: t, alpha: a, sat, light: lt, jitterAmp: ja, hue: warmth }
    }

    function initParticles(w: number, h: number, my: number): Particle[] {
      const pts: Particle[] = []
      for (let i = 0; i < 20; i++) {
        pts.push({
          x: w * 0.1 + Math.random() * w * 0.8,
          y: my + (Math.random() - 0.5) * h * 0.25,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 0.4 + Math.random() * 1.4,
          life: 0.3 + Math.random() * 0.7,
        })
      }
      return pts
    }

    const draw = () => {
      const { dpr } = sizeRef.current
      const rw = rectRef.current.w
      const rh = rectRef.current.h
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rw, rh)

      const t = timeRef.current
      timeRef.current = t + 0.005
      const s = statsRef.current

      // Init particles lazily
      if (particlesRef.current.length === 0 && rw > 0) {
        particlesRef.current = initParticles(rw, rh, rh * 0.5)
      }

      // Target visual state
      const target = targetVis(s)
      if (!currentRef.current) currentRef.current = { ...target }
      currentRef.current = lerpVis(currentRef.current, target, 0.03)
      const vs = currentRef.current

      const po = pullRef.current
      const pullY = po * 0.3
      const sx = rw * 0.08
      const ex = rw * 0.92
      const midY = rh * 0.5 + pullY
      const color = hslString(vs.hue, vs.sat, vs.light, vs.alpha)
      const disconnected = s.lineState === 'disconnected'

      // Particles
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy
        p.life = Math.max(0, p.life - 0.0004)
        if (p.life <= 0) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.life * vs.alpha * 0.4})`
        ctx.fill()
      }

      // Flash
      if (flashRef.current > 0) {
        const f = flashRef.current
        ctx.beginPath()
        ctx.arc((sx + ex) / 2, midY, 30 + f * 60, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,220,180,${f * 0.12})`
        ctx.fill()
        flashRef.current = Math.max(0, f - 0.015)
      }

      // Line
      ctx.shadowColor = color
      ctx.shadowBlur = disconnected ? 2 : 12
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = vs.thickness
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const segments = 80
      for (let i = 0; i <= segments; i++) {
        const frac = i / segments
        const x = sx + (ex - sx) * frac
        const y = bezY(frac, rh, midY, t, vs.jitterAmp)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Endpoints
      const charA = '我'
      const charB = pickChar(s.pairStartDate)
      const ey0 = bezY(0, rh, midY, t, vs.jitterAmp)
      const ey1 = bezY(1, rh, midY, t, vs.jitterAmp)

      for (const [x, y, ch] of [[sx, ey0, charA], [ex, ey1, charB]] as [number, number, string][]) {
        const r = Math.max(vs.thickness * 2.2, 6)
        ctx.shadowBlur = disconnected ? 4 : 20
        ctx.shadowColor = color
        ctx.beginPath()
        ctx.arc(x, y, r + 2, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(15,15,15,0.88)'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = color
        ctx.font = `600 ${Math.round(r * 0.8)}px -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(ch, x, y + 0.5)
      }

      ctx.shadowBlur = 0
      rafRef.current = requestAnimationFrame(draw)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', updateSize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />
  )
}
