// „Haus-Prognose"-Assembly: verbindet History → Models. Aus früheren Läufen PRO
// MODELL (fester Vorlauf) vs. ERA5-Realität die lokale Treffsicherheit je Modell,
// daraus inverse-Fehler-Gewichte und eine bias-korrigierte Mischung der aktuellen
// Prognose. Look-ahead-frei: verglichen werden nur Zieltage, die schon vergangen
// sind, aus Läufen, die N Tage VOR dem Zieltag ausgegeben wurden.
import { pickVar, dailyExtremeByDate, type DailyBundle } from '@/lib/series'
import { metrics, mse, type Pair } from '@/lib/verify'
import {
  blendWeights,
  blendValue,
  weightConcentration,
  type ModelSkill,
  type ModelWeight,
} from '@/lib/wx'
import type { PreviousRunsResponse, ArchiveResponse } from '@/api/weather'

export interface HouseForecast {
  weights: ModelWeight[]
  blended: { date: string; value: number | null }[]
  lean: ModelWeight | null
  worstBias: ModelWeight | null
  concentration: number // 0..1 (Herfindahl)
  sampleDays: number
}

export function computeHouseForecast(
  runs: PreviousRunsResponse | undefined,
  archive: ArchiveResponse | undefined,
  currentDaily: DailyBundle | null,
  modelIds: string[],
  lead: number,
): HouseForecast | null {
  if (!runs?.hourly || !archive?.daily || !currentDaily) return null
  const rtime = (runs.hourly.time as string[]) ?? []

  // Beobachtete Tages-Höchstwerte (ERA5) je Datum.
  const atime = (archive.daily.time as string[]) ?? []
  const amax = (archive.daily.temperature_2m_max as (number | null)[]) ?? []
  const actual = new Map<string, number>()
  atime.forEach((d, i) => {
    const v = amax[i]
    if (v != null) actual.set(d, v)
  })

  const skills: ModelSkill[] = modelIds.map((id) => {
    const fcByDate = dailyExtremeByDate(
      rtime,
      pickVar(runs.hourly, `temperature_2m_previous_day${lead}`, id),
      'max',
    )
    const pairs: Pair[] = []
    for (const [date, f] of fcByDate) {
      const a = actual.get(date)
      if (a != null) pairs.push({ forecast: f, actual: a }) // nur verifizierte (vergangene) Tage
    }
    const m = metrics(pairs)
    return {
      modelId: id,
      mae: m?.mae ?? NaN,
      bias: m?.me ?? 0,
      mse: pairs.length ? mse(pairs) : 0,
      n: pairs.length,
    }
  })

  const weights = blendWeights(skills)
  const blended = currentDaily.time.map((date, i) => ({
    date,
    value: blendValue(
      currentDaily.models.map((m) => ({ modelId: m.modelId, value: m.max[i] ?? null })),
      weights,
    ),
  }))

  const weighted = weights.filter((w) => w.n >= 1)
  const lean = weighted.length ? weighted.reduce((a, b) => (b.weight > a.weight ? b : a)) : null
  const worstBias = weighted.length
    ? weighted.reduce((a, b) => (Math.abs(b.bias) > Math.abs(a.bias) ? b : a))
    : null
  const sampleDays = skills.reduce((mx, s) => Math.max(mx, s.n), 0)

  return { weights, blended, lean, worstBias, concentration: weightConcentration(weights), sampleDays }
}
