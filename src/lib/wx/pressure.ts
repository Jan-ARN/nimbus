// Luftdruck-Dynamik für „Wetterfühligkeit". Es zählt die ÄNDERUNG, nicht der
// Absolutwert: der größte 24-h-Abfall + die schnellste 3-h-Rate. Reiner Kern.

/**
 * Größter Druckabfall (hPa) von einem Zeitpunkt zu einem SPÄTEREN innerhalb
 * `windowH` Stunden (positiv = Abfall). Erfasst auch Dellen, die sich später
 * erholen. Nulls werden übersprungen.
 */
export function maxRollingDrop(series: (number | null)[], windowH = 24): number {
  let max = 0
  for (let i = 0; i < series.length; i++) {
    const s0 = series[i]
    if (s0 == null || Number.isNaN(s0)) continue
    const end = Math.min(series.length - 1, i + windowH)
    let minLater = Infinity
    for (let j = i + 1; j <= end; j++) {
      const v = series[j]
      if (v != null && !Number.isNaN(v) && v < minLater) minLater = v
    }
    if (minLater < Infinity) max = Math.max(max, s0 - minLater)
  }
  return max
}

/** Schnellster 3-Stunden-Abfall (hPa/3 h) über die Reihe. */
export function maxRate3h(series: (number | null)[]): number {
  let max = 0
  for (let i = 0; i + 3 < series.length; i++) {
    const a = series[i]
    const b = series[i + 3]
    if (a != null && b != null && !Number.isNaN(a) && !Number.isNaN(b)) {
      max = Math.max(max, a - b)
    }
  }
  return max
}
