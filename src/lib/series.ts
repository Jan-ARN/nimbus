// Hilfsfunktionen zum Aufbereiten der Open-Meteo-Antworten.
import type { ForecastResponse, EnsembleResponse } from '@/api/weather'

export type NumArr = (number | null)[]

function asNums(v: unknown): NumArr {
  return Array.isArray(v) ? (v as NumArr) : []
}
function asStr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : []
}

// Open-Meteo suffixt Variablen NUR bei mehreren Modellen ("temperature_2m_icon_seamless").
// Bei einem einzigen Modell kommt der Key ohne Suffix ("temperature_2m").
// Dieser Helfer nimmt zuerst den suffigierten, sonst den nackten Key.
export function pickVar(
  src: Record<string, unknown> | undefined,
  base: string,
  modelId: string,
): NumArr {
  if (!src) return []
  const suffixed = src[`${base}_${modelId}`]
  if (Array.isArray(suffixed)) return suffixed as NumArr
  return asNums(src[base])
}

// --- Multi-Modell-Stundenreihen ----------------------------------------------
export interface ModelSeries {
  modelId: string
  temperature: NumArr
  pressure: NumArr
}

export interface HourlyBundle {
  time: string[]
  models: ModelSeries[]
}

export function extractHourly(res: ForecastResponse, modelIds: string[]): HourlyBundle {
  const h = res.hourly ?? {}
  return {
    time: asStr(h.time),
    models: modelIds.map((id) => ({
      modelId: id,
      temperature: pickVar(h, 'temperature_2m', id),
      pressure: pickVar(h, 'surface_pressure', id),
    })),
  }
}

// --- Multi-Modell-Tageswerte -------------------------------------------------
export interface DailyModel {
  modelId: string
  max: NumArr
  min: NumArr
}
export interface DailyBundle {
  time: string[]
  models: DailyModel[]
}

export function extractDaily(res: ForecastResponse, modelIds: string[]): DailyBundle {
  const d = res.daily ?? {}
  return {
    time: asStr(d.time),
    models: modelIds.map((id) => ({
      modelId: id,
      max: pickVar(d, 'temperature_2m_max', id),
      min: pickVar(d, 'temperature_2m_min', id),
    })),
  }
}

// Index des Stundenschritts, der "jetzt" am nächsten ist.
export function nearestHourIndex(time: string[]): number {
  const now = Date.now()
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < time.length; i++) {
    const diff = Math.abs(new Date(time[i]).getTime() - now)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

// --- Ensemble → Tages-Aggregat (Mittel + Streuband) --------------------------
export interface EnsembleDay {
  date: string // ISO-Tag
  median: number // erwarteter Tages-Höchstwert (Median der Member-Höchstwerte) — robust gg. Ausreißer
  mean: number // Mittel der Member-Höchstwerte (kann von wenigen warmen Läufen verzerrt werden)
  p10: number // 10. Perzentil der Member-Höchstwerte (kühleres Szenario)
  p90: number // 90. Perzentil der Member-Höchstwerte (wärmeres Szenario)
  min: number
  max: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function aggregateEnsemble(res: EnsembleResponse): EnsembleDay[] {
  const h = res.hourly ?? {}
  const time = asStr(h.time)
  if (time.length === 0) return []

  // alle Member-Reihen einsammeln (member01..memberNN); Kontrolllauf inklusive
  const memberKeys = Object.keys(h).filter((k) => /^temperature_2m(_member\d+)?$/.test(k))
  const members = memberKeys.map((k) => asNums(h[k]))

  // Stundenschritte je Kalendertag sammeln
  const dayIdx = new Map<string, number[]>()
  for (let i = 0; i < time.length; i++) {
    const day = time[i].slice(0, 10)
    const bucket = dayIdx.get(day)
    if (bucket) bucket.push(i)
    else dayIdx.set(day, [i])
  }

  // Pro Tag: die TAGES-HÖCHSTTEMPERATUR jedes Members (max über den Tag),
  // dann die Verteilung über die Member → das entspricht dem, was Wetter-Apps
  // als "Höchstwert" zeigen (nicht dem 24-h-Mittel).
  const out: EnsembleDay[] = []
  for (const [date, idxs] of dayIdx) {
    const memberHighs: number[] = []
    for (const m of members) {
      let hi = -Infinity
      for (const i of idxs) {
        const v = m[i]
        if (v != null && !Number.isNaN(v) && v > hi) hi = v
      }
      if (hi > -Infinity) memberHighs.push(hi)
    }
    if (memberHighs.length === 0) continue
    const sorted = [...memberHighs].sort((a, b) => a - b)
    const mean = memberHighs.reduce((s, v) => s + v, 0) / memberHighs.length
    out.push({
      date,
      median: percentile(sorted, 0.5),
      mean,
      p10: percentile(sorted, 0.1),
      p90: percentile(sorted, 0.9),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// Tages-Höchstwert je Kalendertag aus einer Stundenreihe (nulls ignorieren).
// Genutzt für den Prognose-Güte-Vergleich: aus stündlichen Läufen wird je Tag
// der Höchstwert wie in einer Wetter-App.
export function dailyMaxByDate(time: string[], values: NumArr): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < time.length; i++) {
    const v = values[i]
    if (v == null || Number.isNaN(v)) continue
    const day = time[i].slice(0, 10)
    const cur = out.get(day)
    if (cur == null || v > cur) out.set(day, v)
  }
  return out
}

// Min/Max über eine Reihe von Zahlen (nulls ignorieren)
export function extent(values: (number | null | undefined)[]): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (lo === Infinity) return [0, 1]
  return [lo, hi]
}
