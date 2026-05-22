import { useRef, useEffect } from 'react'
import type { LineStats } from '../types'
import { noise2D } from '../utils/noise'
import { getPairHue, hslString } from '../utils/color'

interface Props {
  stats: LineStats
  pullOffset?: number
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export default function LineCanvas({ stats, pullOffset = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const timeRef = useRef<number>(0)
  const statsRef = useRef(stats)
  const pullRef = useRef(pullOffset)
  const sizeRef = useRef({ w: 0, h: 0 })

  statsRef.current = stats
  pullRef.current = pullOffset

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (sizeRef.current.w !== w || sizeRef.current.h !== h) {
        sizeRef.current = { w, h }
        canvas!.width = w
        canvas!.height = h
      }
    }

    function computeY(frac: number, h: number, midY: number, t: number, jitterAmp: number): number {
      const bezBase = 4 * (frac - 0.5) * (frac - 0.5) * h * 0.15
      const nx = noise2D(frac * 10, t * 0.7) * jitterAmp * 4
      const ny = noise2D(frac * 10 + 100, t * 0.6) * jitterAmp * 4
      return midY + bezBase + nx + ny - jitterAmp * 2
    }

    const draw = () => {
      resizeCanvas()
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      const t = timeRef.current
      timeRef.current = t + 0.005

      const s = statsRef.current
      const po = pullRef.current
      const hue = getPairHue(s.pairStartDate)
      const { lineState, recentMeetDates } = s

      const thirtyDaysAgo = Date.now() - THIRTY_DAYS
      const recentMeets = recentMeetDates.filter(d => d > thirtyDaysAgo).length

      let thickness = Math.min(1 + recentMeets * 1.5, 8)
      let alpha = 1
      let sat = 65
      let light = 55
      let jitterAmp = 3

      switch (lineState) {
        case 'warning':
          alpha = 0.65; sat = 40; light = 40; jitterAmp = 8; thickness *= 0.7; break
        case 'critical':
          alpha = 0.35; sat = 20; light = 30; jitterAmp = 12; thickness = 1; break
        case 'disconnected':
          alpha = 0.2; sat = 0; light = 40; jitterAmp = 2; thickness = 0.5; break
      }

      const pullY = po * 0.3
      const startX = w * 0.1
      const endX = w * 0.9
      const midY = h * 0.5 + pullY
      const color = hslString(hue, sat, light, alpha)
      const segments = 80

      ctx.shadowColor = color
      ctx.shadowBlur = lineState === 'disconnected' ? 2 : 12

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = thickness
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let i = 0; i <= segments; i++) {
        const frac = i / segments
        const x = startX + (endX - startX) * frac
        const y = computeY(frac, h, midY, t, jitterAmp)

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }

      ctx.stroke()

      // Endpoint dots
      const firstY = computeY(0, h, midY, t, jitterAmp)
      const lastY = computeY(1, h, midY, t, jitterAmp)

      for (const [x, y] of [[startX, firstY], [endX, lastY]] as [number, number][]) {
        ctx.shadowBlur = lineState === 'disconnected' ? 3 : 18
        ctx.beginPath()
        ctx.arc(x, y, thickness * 1.8, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }

      ctx.shadowBlur = 0
      rafRef.current = requestAnimationFrame(draw)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: 'none' }}
    />
  )
}
