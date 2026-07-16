// Zusammenbau-Schicht: rohe best_match-Conditions → stündliche UTCI-/Golden-Reihe
// + „Jetzt"-Zusammenfassung + bestes Fenster. REINE Funktion (die Mathematik lebt
// in @/lib/wx), damit Outdoors-View, Conditions-Hero und der Theme-Hook dieselbe
// Ableitung teilen. `now` wird hereingereicht → testbar, kein verstecktes Date.
import type { ConditionsResponse } from '@/api/weather'
import {
  meanRadiantTemp,
  utci,
  utciCategory,
  goldenScoreHour,
  findBestWindow,
  snowLine,
  dryingIndex,
  solarElevationDeg,
  type UtciCategory,
  type GoldenWindow,
} from '@/lib/wx'
import { relativeSpreadBand, type EnsembleHourlySpread } from '@/lib/series'

const HORIZON_H = 48 // Golden-Window über die nächsten 2 Tage — deckt sich mit dem Streifen

export interface OutdoorHour {
  iso: string
  tempC: number | null
  utci: number | null
  category: UtciCategory | null
  golden: number
  solarElevationDeg: number
}

export interface OutdoorsData {
  hours: OutdoorHour[]
  goldenScores: number[]
  goldenWindow: GoldenWindow | null
  current: {
    iso: string
    tempC: number | null
    utci: number | null
    category: UtciCategory | null
    /** relatives Unsicherheitsband (°C) aus der Ensemble-Streuung */
    band: { lo: number; hi: number } | null
    golden: number
  } | null
  snowLineM: number | null
  freezingLevelM: number | null
  drying: number | null
}

interface PlaceLL {
  lat: number
  lon: number
}

function col(h: ConditionsResponse['hourly'], key: string): (number | null)[] {
  const a = h?.[key]
  return Array.isArray(a) ? (a as (number | null)[]) : []
}

function nearestIndex(time: string[], now: Date): number {
  const t = now.getTime()
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < time.length; i++) {
    const diff = Math.abs(new Date(time[i]).getTime() - t)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

export function buildOutdoors(
  cond: ConditionsResponse | undefined,
  place: PlaceLL,
  now: Date,
  spread?: EnsembleHourlySpread,
): OutdoorsData {
  const empty: OutdoorsData = {
    hours: [],
    goldenScores: [],
    goldenWindow: null,
    current: null,
    snowLineM: null,
    freezingLevelM: null,
    drying: null,
  }
  const h = cond?.hourly
  const time = (h?.time as string[] | undefined) ?? []
  if (time.length === 0) return empty

  const temp = col(h, 'temperature_2m')
  const rh = col(h, 'relative_humidity_2m')
  const dew = col(h, 'dew_point_2m')
  const wind = col(h, 'wind_speed_10m')
  const gust = col(h, 'wind_gusts_10m')
  const cloud = col(h, 'cloud_cover')
  const vis = col(h, 'visibility')
  const sun = col(h, 'sunshine_duration')
  const precip = col(h, 'precipitation')
  const precipProb = col(h, 'precipitation_probability')
  const sw = col(h, 'shortwave_radiation')
  const diff = col(h, 'diffuse_radiation')
  const dni = col(h, 'direct_normal_irradiance')
  const et0 = col(h, 'et0_fao_evapotranspiration')
  const frost = col(h, 'freezing_level_height')

  const now0 = nearestIndex(time, now)
  const end = Math.min(time.length, now0 + HORIZON_H)

  // Ensemble-Streuung an den Conditions-Zeitraster ausrichten (nach ISO-Stunde).
  const spreadIdx = new Map<string, number>()
  if (spread) spread.time.forEach((iso, i) => spreadIdx.set(iso.slice(0, 13), i))

  const hours: OutdoorHour[] = []
  const goldenScores: number[] = []
  for (let i = now0; i < end; i++) {
    const tdb = temp[i]
    const elev = solarElevationDeg(new Date(time[i]), place.lat, place.lon)
    let u: number | null = null
    if (tdb != null) {
      const tmrt = meanRadiantTemp({
        tdb,
        shortwave: sw[i],
        diffuse: diff[i],
        directNormal: dni[i],
        solarElevationDeg: elev,
      })
      u = utci({
        tdb,
        tr: tmrt,
        windKmh: wind[i] ?? 0,
        dewpointC: dew[i] ?? undefined,
        rhPct: rh[i] ?? undefined,
      })
    }
    const golden = goldenScoreHour({
      utci: u,
      solarElevationDeg: elev,
      cloudCoverPct: cloud[i],
      sunshineFraction: sun[i] != null ? (sun[i] as number) / 3600 : null,
      precipitationMm: precip[i],
      precipProbPct: precipProb[i],
      visibilityM: vis[i],
      windKmh: wind[i],
      gustKmh: gust[i],
    })
    hours.push({
      iso: time[i],
      tempC: tdb,
      utci: u,
      category: u != null ? utciCategory(u) : null,
      golden,
      solarElevationDeg: elev,
    })
    goldenScores.push(golden)
  }

  const goldenWindow = findBestWindow(
    goldenScores,
    hours.map((x) => x.iso),
  )

  const first = hours[0] ?? null
  let band: { lo: number; hi: number } | null = null
  if (spread && first?.utci != null) {
    const si = spreadIdx.get(first.iso.slice(0, 13))
    if (si != null) band = relativeSpreadBand(spread, si, first.utci)
  }

  const fl = frost[now0]
  return {
    hours,
    goldenScores,
    goldenWindow,
    current: first
      ? {
          iso: first.iso,
          tempC: first.tempC,
          utci: first.utci,
          category: first.category,
          band,
          golden: first.golden,
        }
      : null,
    snowLineM: fl != null ? snowLine(fl).snowLineM : null,
    freezingLevelM: fl ?? null,
    drying: dryingIndex({
      et0Mm: et0[now0],
      relativeHumidityPct: rh[now0],
      windKmh: wind[now0],
      precipProbPct: precipProb[now0],
    }),
  }
}

/** Nur die aktuelle UTCI (für den Theme-Hook) — leichtgewichtig. */
export function currentConditionUtci(
  cond: ConditionsResponse | undefined,
  place: PlaceLL,
  now: Date,
): number | null {
  return buildOutdoors(cond, place, now).current?.utci ?? null
}
