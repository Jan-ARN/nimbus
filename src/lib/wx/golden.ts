// Golden-Window-Bewertung: jede kommende Stunde 0..100 „schön draußen".
// Multiplikatives Gating (geometrisches Mittel) → ein harter K.-o. (Regen,
// Dunkelheit, Nebel) zieht die Stunde gegen 0, egal wie mild es ist. Ehrlich:
// eine warme Regenstunde ist nicht „golden".
//
// Komfort-Band (Produktentscheidung): UTCI 18–26 °C = angenehm.

const PLEASANT_LO = 18
const PLEASANT_HI = 26
const THERMAL_MARGIN = 8 // °C Auslauf bis Score 0

export interface GoldenHourInputs {
  /** UTCI (°C) oder null, wenn nicht berechenbar */
  utci: number | null
  /** Sonnenhöhe (°) */
  solarElevationDeg: number
  cloudCoverPct: number | null
  /** Sonnenscheinanteil der Stunde 0..1 (aus sunshine_duration/3600), optional */
  sunshineFraction?: number | null
  precipitationMm: number | null
  precipProbPct: number | null
  visibilityM: number | null
  windKmh: number | null
  gustKmh: number | null
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function ramp(x: number, zero: number, one: number): number {
  return clamp01((x - zero) / (one - zero))
}

/** Thermischer Teil-Score: 1 im Wohlfühlband, Kosinus-Abfall über THERMAL_MARGIN. */
function thermalScore(utci: number | null): number {
  if (utci == null) return 0 // ohne Komfort-Urteil nichts als „golden" ausgeben
  if (utci >= PLEASANT_LO && utci <= PLEASANT_HI) return 1
  const d = utci < PLEASANT_LO ? PLEASANT_LO - utci : utci - PLEASANT_HI
  if (d >= THERMAL_MARGIN) return 0
  return 0.5 * (1 + Math.cos((Math.PI * d) / THERMAL_MARGIN))
}

/** Teil-Scores einer Stunde (0..1). Exportiert für Erklär-/Test-Zwecke. */
export function goldenFactors(inp: GoldenHourInputs): Record<string, number> {
  const daylight = ramp(inp.solarElevationDeg, 0, 6)
  const sun =
    inp.sunshineFraction != null
      ? clamp01(inp.sunshineFraction)
      : inp.cloudCoverPct != null
        ? Math.max(0.2, 1 - 0.7 * (inp.cloudCoverPct / 100))
        : 1
  const dry =
    inp.precipitationMm != null && inp.precipitationMm > 0.1
      ? 0
      : inp.precipProbPct != null
        ? clamp01(1 - 0.8 * (inp.precipProbPct / 100))
        : 1
  const fogFree = inp.visibilityM == null ? 1 : ramp(inp.visibilityM, 500, 4000)
  const windScore = inp.windKmh == null ? 1 : 1 - ramp(inp.windKmh, 12, 35)
  const gustScore = inp.gustKmh == null ? 1 : 1 - ramp(inp.gustKmh, 25, 55)
  return {
    thermal: thermalScore(inp.utci),
    daylight,
    sun,
    dry,
    fogFree,
    calm: Math.min(windScore, gustScore),
  }
}

/** Golden-Score einer Stunde: 0..100 (geometrisches Mittel der Teil-Scores). */
export function goldenScoreHour(inp: GoldenHourInputs): number {
  const f = Object.values(goldenFactors(inp))
  let prod = 1
  for (const v of f) prod *= v
  return Math.round(Math.pow(prod, 1 / f.length) * 100)
}

export interface GoldenWindow {
  startIdx: number
  endIdx: number
  startIso: string
  endIso: string
  meanScore: number
  hours: number
}

/**
 * Bestes zusammenhängendes Fenster mit Score ≥ threshold. Wählt das längste,
 * bei Gleichstand das mit dem höheren Mittel. null = nichts qualifiziert sich.
 */
export function findBestWindow(
  scores: number[],
  time: string[],
  threshold = 65,
): GoldenWindow | null {
  let best: GoldenWindow | null = null
  let i = 0
  while (i < scores.length) {
    if (scores[i] < threshold) {
      i++
      continue
    }
    let j = i
    let sum = 0
    while (j < scores.length && scores[j] >= threshold) {
      sum += scores[j]
      j++
    }
    const hours = j - i
    const mean = sum / hours
    if (
      !best ||
      hours > best.hours ||
      (hours === best.hours && mean > best.meanScore)
    ) {
      best = {
        startIdx: i,
        endIdx: j - 1,
        startIso: time[i],
        endIso: time[j - 1],
        meanScore: Math.round(mean),
        hours,
      }
    }
    i = j
  }
  return best
}
