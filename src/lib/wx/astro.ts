// Dünner Wrapper um SunCalc (geprüfte Bibliothek) — keine handgeschriebene
// Ephemeride. Liefert Sonnenstand, Dämmerungsfenster (inkl. astronomischer
// Nacht, Sonne < −18°) und Mondstand/-phase für Golden-Window & Sterngucker.
import * as SunCalc from 'suncalc'

const RAD2DEG = 180 / Math.PI

/** Sonnenhöhe (° über Horizont) zu Zeitpunkt/Ort. Negativ = unter Horizont. */
export function solarElevationDeg(date: Date, lat: number, lon: number): number {
  return SunCalc.getPosition(date, lat, lon).altitude * RAD2DEG
}

/** Ist es taghell (Sonne über Horizont)? */
export function isDaylight(date: Date, lat: number, lon: number): boolean {
  return solarElevationDeg(date, lat, lon) > 0
}

export interface TwilightTimes {
  // In hohen Breiten kann eine Dämmerungsschwelle fehlen (Sonne bleibt darüber/darunter).
  sunrise: Date | null
  sunset: Date | null
  civilDusk: Date | null // Sonne −6°
  civilDawn: Date | null
  nightStart: Date | null // astronomische Nacht beginnt (Sonne −18°)
  nightEnd: Date | null
}

/** Sonnen-/Dämmerungszeiten des Tages. */
export function twilight(date: Date, lat: number, lon: number): TwilightTimes {
  const t = SunCalc.getTimes(date, lat, lon)
  return {
    sunrise: t.sunrise,
    sunset: t.sunset,
    civilDusk: t.dusk,
    civilDawn: t.dawn,
    nightStart: t.night,
    nightEnd: t.nightEnd,
  }
}

export interface MoonInfo {
  /** beleuchteter Anteil 0..1 */
  illumination: number
  /** Phase 0..1 (0 = Neumond, 0.5 = Vollmond) */
  phase: number
  /** Mondhöhe (° über Horizont) */
  altitudeDeg: number
  /** Mond über Horizont? */
  up: boolean
}

/** Mondbeleuchtung + -stand. Für den Sterngucker (Mondlicht überstrahlt den Himmel). */
export function moon(date: Date, lat: number, lon: number): MoonInfo {
  const ill = SunCalc.getMoonIllumination(date)
  const pos = SunCalc.getMoonPosition(date, lat, lon)
  return {
    illumination: ill.fraction,
    phase: ill.phase,
    altitudeDeg: pos.altitude * RAD2DEG,
    up: pos.altitude > 0,
  }
}
