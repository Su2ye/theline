export function getPairHue(pairStartTimestamp: number): number {
  // Base hue from pair date (hash-like), drifts slowly over time
  const baseHue = (pairStartTimestamp / (1000 * 60 * 60 * 24)) % 360
  const daysSincePair = (Date.now() - pairStartTimestamp) / (1000 * 60 * 60 * 24)
  const hueShift = (daysSincePair * 0.3) % 360
  return (baseHue + hueShift) % 360
}

export function hslString(hue: number, saturation: number, lightness: number, alpha = 1): string {
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
}
