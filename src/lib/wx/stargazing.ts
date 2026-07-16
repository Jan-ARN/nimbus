// Sterngucker-Bewertung einer (dunklen) Stunde. Reiner Kern; die Dunkelheits-
// Gate (Sonne < −18°) und der Mondstand kommen aus astro.ts und werden im
// Karten-Assembly je Stunde berechnet.
export interface StargazeInput {
  /** Wolken je Schicht (%). Tiefe/mittlere Wolken blocken stärker als Zirren. */
  cloudLowPct: number | null
  cloudMidPct: number | null
  cloudHighPct: number | null
  /** beleuchteter Mondanteil 0..1 */
  moonIllumination: number
  /** Mond über Horizont? (nur dann überstrahlt er) */
  moonUp: boolean
  /** Aerosol-Proxy: PM2.5 (µg/m³) für die Transparenz */
  aerosolPm25: number | null
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Sterngucker-Score 0..100 (nur sinnvoll in astronomischer Dunkelheit). */
export function stargazeScore(inp: StargazeInput): number {
  const low = inp.cloudLowPct ?? 0
  const mid = inp.cloudMidPct ?? 0
  const high = inp.cloudHighPct ?? 0
  // Schicht-Transmission: tiefe/mittlere Wolken sind (nahezu) opak, Zirren nur
  // halb-durchlässig. 100 % tiefe Bewölkung ⇒ Himmel dicht → clear = 0.
  const clear = clamp01((1 - low / 100) * (1 - mid / 100) * (1 - 0.5 * (high / 100)))
  const moon = inp.moonUp ? 1 - 0.7 * clamp01(inp.moonIllumination) : 1
  const aero = inp.aerosolPm25 == null ? 1 : 1 - 0.4 * clamp01((inp.aerosolPm25 - 10) / 40)
  return Math.round(clear * moon * aero * 100)
}
