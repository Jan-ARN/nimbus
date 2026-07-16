// Kategorie-Tabellen (reine Werte + Enum-Keys, keine Labels/Farben — die liegen
// in format.ts mit i18n). So bleibt der Rechen-Kern sprach- und UI-frei.

export type UtciCategory =
  | 'extremeCold'
  | 'veryStrongCold'
  | 'strongCold'
  | 'moderateCold'
  | 'slightCold'
  | 'noStress'
  | 'moderateHeat'
  | 'strongHeat'
  | 'veryStrongHeat'
  | 'extremeHeat'

// Obergrenze (°C UTCI) je Kategorie, aufsteigend. Amtliche 10 Stufen (Bröde 2012).
const UTCI_BANDS: { key: UtciCategory; max: number }[] = [
  { key: 'extremeCold', max: -40 },
  { key: 'veryStrongCold', max: -27 },
  { key: 'strongCold', max: -13 },
  { key: 'moderateCold', max: 0 },
  { key: 'slightCold', max: 9 },
  { key: 'noStress', max: 26 },
  { key: 'moderateHeat', max: 32 },
  { key: 'strongHeat', max: 38 },
  { key: 'veryStrongHeat', max: 46 },
  { key: 'extremeHeat', max: Infinity },
]

/** UTCI (°C) → Stress-Kategorie. */
export function utciCategory(utci: number): UtciCategory {
  for (const b of UTCI_BANDS) if (utci < b.max) return b.key
  return 'extremeHeat'
}
