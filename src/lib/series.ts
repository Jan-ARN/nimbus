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
  p25: number // 25. Perzentil (untere Box-Kante im Meteogramm)
  p75: number // 75. Perzentil (obere Box-Kante im Meteogramm)
  p90: number // 90. Perzentil der Member-Höchstwerte (wärmeres Szenario)
  min: number
  max: number
  highs: number[] // alle Member-Höchstwerte des Tages (roh) — für Punktstreu & Bimodalität
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// k gleich-wahrscheinliche Quantile aus sortierten Werten — die Grundlage des
// Quantil-Punktdiagramms (jeder Punkt steht für 1/k der Läufe; man kann sie
// buchstäblich abzählen). Quantil (i+0,5)/k, i = 0…k−1.
export function quantiles(sorted: number[], k: number): number[] {
  if (sorted.length === 0 || k < 1) return []
  const out: number[] = []
  for (let i = 0; i < k; i++) out.push(percentile(sorted, (i + 0.5) / k))
  return out
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
      p25: percentile(sorted, 0.25),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      highs: sorted,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// --- Ensemble → Regenwahrscheinlichkeit je Tag (aus den Membern) -------------
// PoP = Anteil der Member mit messbarem Regen (Tages-Summe ≥ 0,1 mm) — die
// klassische Definition, hier ehrlich als „X von N Läufen" auslesbar.
export interface EnsemblePrecipDay {
  date: string
  pop: number // 0..1 — Anteil Member mit ≥ threshold
  wet: number // Anzahl „nasser" Member
  total: number // Anzahl Member insgesamt
  medianMm: number // Median der Tagessumme NUR über die nassen Member (mm) — „wenn es regnet"
}

export function ensemblePrecip(res: EnsembleResponse, thresholdMm = 0.1): EnsemblePrecipDay[] {
  const h = res.hourly ?? {}
  const time = asStr(h.time)
  if (time.length === 0) return []

  const memberKeys = Object.keys(h).filter((k) => /^precipitation(_member\d+)?$/.test(k))
  const members = memberKeys.map((k) => asNums(h[k]))
  if (members.length === 0) return []

  const dayIdx = new Map<string, number[]>()
  for (let i = 0; i < time.length; i++) {
    const day = time[i].slice(0, 10)
    const bucket = dayIdx.get(day)
    if (bucket) bucket.push(i)
    else dayIdx.set(day, [i])
  }

  const out: EnsemblePrecipDay[] = []
  for (const [date, idxs] of dayIdx) {
    const sums: number[] = []
    for (const m of members) {
      let s = 0
      let any = false
      for (const i of idxs) {
        const v = m[i]
        if (v != null && !Number.isNaN(v)) {
          s += v
          any = true
        }
      }
      if (any) sums.push(s)
    }
    if (sums.length === 0) continue
    const wetSums = sums.filter((s) => s >= thresholdMm).sort((a, b) => a - b)
    out.push({
      date,
      pop: wetSums.length / sums.length,
      wet: wetSums.length,
      total: sums.length,
      // bedingter Median: nur die nassen Läufe → passt zur Aussage „wenn es regnet".
      medianMm: wetSums.length ? percentile(wetSums, 0.5) : 0,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// --- Ensemble → einzelne Member-Bahnen (für animierte HOPs) ------------------
// Wie aggregateEnsemble, aber OHNE die Member zu Perzentilen zu verdichten:
// je Member die Tages-Höchstwerte, ausgerichtet auf eine gemeinsame Tagesliste.
// So lässt sich jeder Member als eigene Linie zeichnen — die Basis für
// „Hypothetical Outcome Plots" (nacheinander aufblitzende Szenarien).
export interface EnsembleMembers {
  dates: string[] // ISO-Tage, aufsteigend
  members: (number | null)[][] // members[k][dayIndex] = Tages-Höchstwert
}

export function ensembleMembers(res: EnsembleResponse): EnsembleMembers {
  const h = res.hourly ?? {}
  const time = asStr(h.time)
  if (time.length === 0) return { dates: [], members: [] }

  const memberKeys = Object.keys(h).filter((k) => /^temperature_2m(_member\d+)?$/.test(k))
  const series = memberKeys.map((k) => asNums(h[k]))

  const dayIdx = new Map<string, number[]>()
  for (let i = 0; i < time.length; i++) {
    const day = time[i].slice(0, 10)
    const bucket = dayIdx.get(day)
    if (bucket) bucket.push(i)
    else dayIdx.set(day, [i])
  }
  const dates = [...dayIdx.keys()].sort((a, b) => a.localeCompare(b))

  const members = series.map((m) =>
    dates.map((d) => {
      let hi = -Infinity
      for (const i of dayIdx.get(d)!) {
        const v = m[i]
        if (v != null && !Number.isNaN(v) && v > hi) hi = v
      }
      return hi > -Infinity ? hi : null
    }),
  )
  return { dates, members }
}

// --- Bimodalität: teilt sich das Ensemble in ZWEI Temperatur-Lager? -----------
// Zeigt die Marginalverteilung EINES Tages (nicht verfolgte Member-Bahnen): an
// einem Tag können die Läufe in zwei Gruppen zerfallen (z. B. Front Samstag vs.
// Sonntag). Ein glattes Band verwischt das — der Punktstreu macht es sichtbar,
// dieser Detektor steuert nur den Text-Hinweis. Bewusst konservativ (lieber ein
// echtes Signal verpassen als ein falsches behaupten): teilt an der größten
// Lücke und verlangt ALLE drei Bedingungen.
export interface BimodalResult {
  isBimodal: boolean
  lowMean: number // Mittel des kühleren Lagers
  highMean: number // Mittel des wärmeren Lagers
  lowFrac: number // Anteil Member im kühleren Lager (0..1)
  gap: number // Temperaturlücke zwischen den Lagern (°C)
}

const NOT_BIMODAL: BimodalResult = { isBimodal: false, lowMean: NaN, highMean: NaN, lowFrac: 0, gap: 0 }

function stdev(xs: number[], mean: number): number {
  if (xs.length < 2) return 0
  return Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length)
}

/**
 * @param sortedHighs aufsteigend sortierte Member-Höchstwerte eines Tages
 * @param minGap absolute Mindestlücke zwischen den Lagern (°C) — meteorologische Relevanz
 * @param minSep normierte Trennung (μ_hoch−μ_tief)/(σ_tief+σ_hoch) — Lager wirklich aufgelöst
 * @param minFrac Mindestanteil je Lager — zwei Gruppen, kein Ausreißer
 */
export function bimodalSplit(
  sortedHighs: number[],
  minGap = 2.5,
  minSep = 2,
  minFrac = 0.3,
): BimodalResult {
  const n = sortedHighs.length
  if (n < 8) return NOT_BIMODAL // zu wenige Member für eine belastbare Aussage

  // größte Lücke zwischen benachbarten (sortierten) Werten → Trennstelle
  let splitAt = -1
  let biggest = -Infinity
  for (let i = 1; i < n; i++) {
    const g = sortedHighs[i] - sortedHighs[i - 1]
    if (g > biggest) {
      biggest = g
      splitAt = i
    }
  }
  const low = sortedHighs.slice(0, splitAt)
  const high = sortedHighs.slice(splitAt)

  // (2) Balance: jedes Lager mindestens minFrac der Member
  const lowFrac = low.length / n
  if (lowFrac < minFrac || 1 - lowFrac < minFrac) return NOT_BIMODAL

  const lowMean = low.reduce((s, v) => s + v, 0) / low.length
  const highMean = high.reduce((s, v) => s + v, 0) / high.length
  const gap = highMean - lowMean

  // (3) absolute Mindestlücke zwischen den Lager-Mitteln
  if (gap < minGap) return NOT_BIMODAL

  // (1) normierte Trennung: Lager-Abstand groß gegen die Streuung IN den Lagern
  const spread = stdev(low, lowMean) + stdev(high, highMean)
  const sep = spread > 0 ? gap / spread : Infinity
  if (sep < minSep) return NOT_BIMODAL

  return { isBimodal: true, lowMean, highMean, lowFrac, gap }
}

// Tages-Höchst- ODER -Tiefstwert je Kalendertag aus einer Stundenreihe
// (nulls ignorieren). Genutzt für den Prognose-Güte-Vergleich: aus stündlichen
// Läufen wird je Tag der Höchst-/Tiefstwert wie in einer Wetter-App.
export function dailyExtremeByDate(
  time: string[],
  values: NumArr,
  kind: 'max' | 'min',
): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < time.length; i++) {
    const v = values[i]
    if (v == null || Number.isNaN(v)) continue
    const day = time[i].slice(0, 10)
    const cur = out.get(day)
    if (cur == null || (kind === 'max' ? v > cur : v < cur)) out.set(day, v)
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
