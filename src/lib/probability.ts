// Ehrliche Wahrscheinlichkeits-Kommunikation — reine Funktionen.
//
// Zwei belegte Befunde aus der Forschung:
//  1) Blanke Worte („wahrscheinlich") werden regressiv Richtung 50 % gelesen; das
//     IPCC hängt darum an jedes Wort eine Zahlenspanne (Budescu et al. 2009,
//     IPCC AR5 Uncertainty Guidance). → kalibrierte Wort-Chips MIT Spanne.
//  2) Prozente sind mehrdeutig (Zeit? Fläche?); natürliche Häufigkeiten mit
//     genannter Bezugsklasse („an X von N Läufen") sind eindeutiger
//     (Gigerenzer et al. 2005).

// IPCC-AR5-Kalibrierungsskala (einseitig, Richtung „Ereignis tritt ein").
export interface VerbalTerm {
  key: string // i18n-Schlüssel (probability.term.*)
  lo: number // Untergrenze der Spanne (%)
  hi: number // Obergrenze der Spanne (%)
}

const SCALE: { min: number; key: string; lo: number; hi: number }[] = [
  { min: 0.99, key: 'virtuallyCertain', lo: 99, hi: 100 },
  { min: 0.9, key: 'veryLikely', lo: 90, hi: 100 },
  { min: 0.66, key: 'likely', lo: 66, hi: 100 },
  { min: 0.33, key: 'aboutAsLikely', lo: 33, hi: 66 },
  { min: 0.1, key: 'unlikely', lo: 10, hi: 33 },
  { min: 0.01, key: 'veryUnlikely', lo: 1, hi: 10 },
  { min: 0, key: 'exceptionallyUnlikely', lo: 0, hi: 1 },
]

/** Kalibriertes Wahrscheinlichkeits-Wort samt Zahlenspanne für p ∈ [0,1]. */
export function verbalProbability(p: number): VerbalTerm {
  const clamped = Math.max(0, Math.min(1, p))
  for (const s of SCALE) {
    if (clamped >= s.min) return { key: s.key, lo: s.lo, hi: s.hi }
  }
  return { key: 'exceptionallyUnlikely', lo: 0, hi: 1 }
}

/** Natürliche Häufigkeit: p → „rund COUNT von N". */
export function naturalFrequency(p: number, n: number): number {
  return Math.round(Math.max(0, Math.min(1, p)) * n)
}
