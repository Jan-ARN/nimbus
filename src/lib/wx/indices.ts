// Entscheidungs-Indizes: kleine „soll ich…?"-Antworten. Reine Funktionen.
// Phase 1: Schneegrenze + Wäsche-/Trocknungsindex. (Gewitter, Nebel, Feuer,
// GDD, Rad/Lauf folgen in Phase 2.)

/** Höhe, oberhalb derer Niederschlag als Schnee fällt (~200 m unter der
 *  Frostgrenze — der Schmelzweg). Fällt es im Tal (unter snowLineM) als Regen. */
export function snowLine(freezingLevelM: number): {
  freezingLevelM: number
  snowLineM: number
} {
  return { freezingLevelM, snowLineM: Math.max(0, freezingLevelM - 200) }
}

export interface DryingInputs {
  /** Referenz-Verdunstung ET₀ (mm) der Stunde */
  et0Mm: number | null
  relativeHumidityPct: number | null
  windKmh: number | null
  precipProbPct: number | null
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/**
 * Wäsche-/Trocknungsindex 0..100. Steigt mit ET₀ und Wind, fällt mit Feuchte
 * und Regenwahrscheinlichkeit. Monoton in allen vier Größen.
 */
export function dryingIndex(inp: DryingInputs): number {
  const et0 = inp.et0Mm ?? 0
  const rh = inp.relativeHumidityPct ?? 60
  const prob = inp.precipProbPct ?? 0
  const wind = inp.windKmh ?? 0

  const dryPower = clamp01(et0 / 0.5) // ET₀ ~0,5 mm/h ⇒ kräftiges Trocknen
  const windBoost = 0.7 + 0.3 * clamp01(wind / 20)
  const humidity = 1 - rh / 100
  const rain = 1 - prob / 100

  return Math.round(100 * clamp01(dryPower * windBoost * humidity * rain))
}
