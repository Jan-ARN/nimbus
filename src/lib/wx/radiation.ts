// Mittlere Strahlungstemperatur (MRT) — die Modellierungsentscheidung hinter UTCI.
// v1: sonnenkorrigiertes Modell nach Thorsson et al. (2007) / RayMan-Stil für eine
// aufrecht stehende Person. v0-Fallback: MRT = Lufttemperatur (nachts / ohne
// Strahlungsdaten) — ehrliche Degradation statt erfundener Genauigkeit.

const SIGMA = 5.67e-8 // Stefan-Boltzmann W/m²K⁴
const EPS_P = 0.97 // Emissionsgrad Kleidung/Haut
const ABS_K = 0.7 // Kurzwellen-Absorption des Körpers
const DEFAULT_ALBEDO = 0.2 // Boden-Rückstrahlung (Gras/Asphalt-Mittel)

export interface MrtInputs {
  /** Lufttemperatur (°C) */
  tdb: number
  /** globale Kurzwellenstrahlung horizontal (W/m²) */
  shortwave: number | null
  /** diffuse Kurzwellenstrahlung (W/m²) */
  diffuse: number | null
  /** direkte Normal-Bestrahlungsstärke (W/m², senkrecht zum Strahl) */
  directNormal: number | null
  /** Sonnenhöhe (° über Horizont) */
  solarElevationDeg: number
  /** Boden-Albedo (Standard 0,2) */
  albedo?: number
}

/** Fanger-Projektionsflächenfaktor einer stehenden Person über Sonnenhöhe. */
function projectedAreaFactor(solarElevationDeg: number): number {
  const a = solarElevationDeg
  return 0.308 * Math.cos((Math.PI / 180) * a * (0.998 - (a * a) / 50000))
}

/**
 * MRT (°C). Ohne Sonne/Strahlung → Lufttemperatur (v0). Mit Strahlung → v1:
 * absorbierte Kurzwelle (diffus + bodenreflektiert + direkter Strahl auf die
 * Projektionsfläche) auf isotrope Langwelle bei Lufttemperatur aufaddiert und
 * über Stefan-Boltzmann zurückgerechnet.
 */
export function meanRadiantTemp(inp: MrtInputs): number {
  const { tdb, solarElevationDeg: elev } = inp
  const sw = inp.shortwave ?? 0
  const diff = inp.diffuse ?? 0
  const dni = inp.directNormal ?? 0
  const albedo = inp.albedo ?? DEFAULT_ALBEDO

  // v0-Fallback: keine (nutzbare) Sonne → reine Lufttemperatur-Strahlungsumgebung.
  if (elev <= 0 || (sw <= 0 && diff <= 0 && dni <= 0)) return tdb

  const fp = Math.max(0, projectedAreaFactor(elev))
  // Kurzwellen-Strahlungsflussdichte auf die Person (3-Richtungs-Vereinfachung):
  // diffus (Sichtfaktor 0,5) + bodenreflektiert (0,5) + direkter Strahl (fp).
  const sStr = ABS_K * (0.5 * diff + 0.5 * albedo * sw + fp * dni)

  const tkA = tdb + 273.15
  const tmrtK = Math.pow(Math.pow(tkA, 4) + sStr / (EPS_P * SIGMA), 0.25)
  return tmrtK - 273.15
}
