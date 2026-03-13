'use client'
import { useEffect, useRef } from 'react'

const HEADER_HEIGHT = 64
const NUM_FLAKES = 27

function randomFlake(canvasWidth, canvasHeight, randomY = false) {
  return {
    x: Math.random() * canvasWidth,
    y: randomY ? Math.random() * canvasHeight : -20,
    size: Math.random() * 36 + 16,
    speed: Math.random() * 0.4 + 0.15,
    swayAmp: Math.random() * 0.4 + 0.1,
    swayOffset: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.01,
  }
}

export default function Snow() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight - HEADER_HEIGHT
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = (window.innerHeight - HEADER_HEIGHT) + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const img = new Image()
    img.src = '/snowflake.png'

    let flakes = []
    let animId
    let t = 0

    const init = () => {
      flakes = Array.from({ length: NUM_FLAKES }, () =>
        randomFlake(canvas.width, canvas.height, true)
      )
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const fadeStart = canvas.height * 0.55
      const fadeEnd = canvas.height * 0.92

      for (const f of flakes) {
        let alpha = 0.85
        if (f.y > fadeStart) {
          alpha = 0.85 * (1 - (f.y - fadeStart) / (fadeEnd - fadeStart))
          alpha = Math.max(0, alpha)
        }

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(f.x, f.y)
        ctx.rotate(f.rotation)
        ctx.drawImage(img, -f.size / 2, -f.size / 2, f.size, f.size)
        ctx.restore()

        f.y += f.speed
        f.x += Math.sin(t * 0.015 + f.swayOffset) * f.swayAmp
        f.rotation += f.rotSpeed

        if (f.y > fadeEnd || f.x < -30 || f.x > canvas.width + 30) {
          Object.assign(f, randomFlake(canvas.width, canvas.height, false))
        }
      }

      t++
      animId = requestAnimationFrame(draw)
    }

    img.onload = () => {
      init()
      draw()
    }

    // If image fails to load, still init (won't draw anything visible)
    img.onerror = () => init()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed pointer-events-none"
      style={{
        position: 'fixed',
        top: HEADER_HEIGHT,
        left: 0,
        zIndex: 5,
      }}
    />
  )
}
