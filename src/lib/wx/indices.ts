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

// --- Gewitterpotenzial (aus CAPE) --------------------------------------------
// Grobe CAPE-Bänder (J/kg). < 300 gilt als vernachlässigbar → 'none' (statt des
// im Brief genannten „weak", das bei windstillem Winter irreführend wäre). Ein
// aktiver Gewitter-WMO-Code (95–99) wird in der UI zusätzlich gespiegelt.
export type ThunderLevel = 'none' | 'moderate' | 'strong' | 'extreme'
export function thunderPotential(cape: number | null | undefined): ThunderLevel {
  if (cape == null || cape < 300) return 'none'
  if (cape < 1000) return 'moderate'
  if (cape < 2500) return 'strong'
  return 'extreme'
}

// --- Nebelrisiko -------------------------------------------------------------
// Taupunktspanne (T − Td) klein + wenig Wind + hohe Feuchte → Nebelgefahr.
// Gegen die gemeldete Sichtweite plausibilisiert (schon <1 km ⇒ bereits Nebel).
export type FogLevel = 'none' | 'low' | 'moderate' | 'high'
export interface FogInputs {
  tempC: number | null
  dewpointC: number | null
  windKmh: number | null
  relativeHumidityPct: number | null
  visibilityM: number | null
}
export function fogRisk(inp: FogInputs): FogLevel {
  if (inp.visibilityM != null && inp.visibilityM < 1000) return 'high' // bereits Nebel
  if (inp.tempC == null || inp.dewpointC == null) return 'none'
  const spread = inp.tempC - inp.dewpointC
  const wind = inp.windKmh ?? 0
  const rh = inp.relativeHumidityPct ?? 0
  if (spread < 1.5 && wind < 8 && rh > 92) return 'high'
  if (spread < 2.5 && wind < 12 && rh > 88) return 'moderate'
  if (spread < 4 && rh > 82) return 'low'
  return 'none'
}

// --- Feuer-/Trockenstress ----------------------------------------------------
// Steigt mit Dampfdruckdefizit (VPD), Verdunstung (ET₀), Wind und fallender
// Feuchte. days-since-rain (drySpell) folgt, wenn Outdoors Klimadaten zieht.
export interface FireInputs {
  vpdKpa: number | null
  et0Mm: number | null
  windKmh: number | null
  relativeHumidityPct: number | null
}
export function fireStress(inp: FireInputs): number {
  const vpd = clamp01((inp.vpdKpa ?? 0) / 2.5)
  const et0 = clamp01((inp.et0Mm ?? 0) / 0.5)
  const wind = clamp01((inp.windKmh ?? 0) / 30)
  const dry = clamp01((100 - (inp.relativeHumidityPct ?? 60)) / 100)
  return Math.round(100 * clamp01(0.45 * vpd + 0.2 * et0 + 0.15 * wind + 0.2 * dry))
}

// --- Wachstumsgradtage (GDD) -------------------------------------------------
// Σ max(0, (Tmax+Tmin)/2 − Tbase); Basis 10 °C (viele Kulturpflanzen). Summe
// über die übergebenen Tage (Nulls werden übersprungen).
export function growingDegreeDays(
  tmax: (number | null)[],
  tmin: (number | null)[],
  base = 10,
): number {
  let sum = 0
  for (let i = 0; i < tmax.length; i++) {
    const hi = tmax[i]
    const lo = tmin[i]
    if (hi == null || lo == null) continue
    sum += Math.max(0, (hi + lo) / 2 - base)
  }
  return Math.round(sum)
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
