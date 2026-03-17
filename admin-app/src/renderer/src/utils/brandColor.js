function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

export function applyBrandColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return
  const [r, g, b] = hexToRgb(hex)
  const [h, s] = rgbToHsl(r, g, b)

  const brandShades = {
    50:  hslToRgb(h, Math.max(s * 0.4, 15), 97),
    100: hslToRgb(h, Math.max(s * 0.55, 20), 93),
    200: hslToRgb(h, Math.max(s * 0.7, 28), 87),
    500: hslToRgb(h, s, 61),
    600: hslToRgb(h, Math.min(s + 3, 100), 53),
    700: hslToRgb(h, Math.min(s + 6, 100), 43),
    800: hslToRgb(h, Math.min(s + 9, 100), 33),
    900: hslToRgb(h, Math.min(s + 12, 100), 22),
  }

  // Background tones — same hue, very low saturation, very dark
  const bgBase    = hslToRgb(h, Math.min(s * 0.12, 18), 7)
  const bgSurface = hslToRgb(h, Math.min(s * 0.18, 22), 12)

  const root = document.documentElement
  for (const [shade, [rv, gv, bv]] of Object.entries(brandShades)) {
    root.style.setProperty(`--brand-${shade}`, `${rv} ${gv} ${bv}`)
  }
  root.style.setProperty('--bg-base',    `${bgBase[0]} ${bgBase[1]} ${bgBase[2]}`)
  root.style.setProperty('--bg-surface', `${bgSurface[0]} ${bgSurface[1]} ${bgSurface[2]}`)
}
