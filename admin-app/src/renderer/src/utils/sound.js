// Sound files go in: src/renderer/public/sounds/
//   message.mp3 — new chat message
//   order.mp3   — new order available

function _beep(freqs, duration = 0.15, gap = 0.18) {
  try {
    const ctx = new AudioContext()
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * gap
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t)
      osc.stop(t + duration)
    })
  } catch {}
}

const FALLBACK = {
  message: () => _beep([880, 880, 880]),
  order:   () => _beep([550, 770]),
  global:  () => _beep([660, 880], 0.12, 0.14),
}

export function playSound(type) {
  const audio = new Audio(`./sounds/${type}.mp3`)
  audio.volume = 0.75
  audio.play().catch(() => FALLBACK[type]?.())
}
