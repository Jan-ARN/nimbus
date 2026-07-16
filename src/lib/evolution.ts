// Lauf-für-Lauf-Entwicklung einer Prognose für einen FESTEN Zieltag — reine
// Funktionen, komplett im Browser, ohne DOM (→ direkt per `npx tsx` prüfbar).
//
// Grundgedanke: Die previous-runs-API liefert je Spalte `temperature_2m_previous_dayN`
// (bei gleichem Gültigkeitszeitpunkt) den Wert aus dem Lauf von vor N Tagen. Über die
// Spalten hinweg gelesen ergibt das für einen festen Zieltag die Kette der
// aufeinanderfolgenden Läufe: prev7 (ältester) → … → prev1 → aktueller Lauf (jüngster).
// Daraus lässt sich messen, ob sich die Prognose entschieden hat (Konvergenz), nur
// gedriftet ist oder hin- und hersprang (Flip-Flop).

import { dailyExtremeByDate, type NumArr } from '@/lib/series'

interface HourlySrc {
  hourly?: Record<string, (number | null)[] | string[]>
}

export type Stability = 'stable' | 'drifting' | 'flip-flopping'

export interface FlipFlop {
  totalVariation: number // Σ |fᵢ − fᵢ₋₁| — gesamte „Weglänge" der Prognose (°C)
  range: number // max − min über alle Läufe (°C)
  flipFlop: number // totalVariation − range: 0 = glatt, > 0 = Oszillation (°C)
  netChange: number // jüngster − ältester Lauf (°C, vorzeichenbehaftet)
  stability: Stability
}

export interface RunTrajectory {
  date: string // ISO-Tag (Zieltag)
  runs: number[] // Tages-Höchstwerte, ältester → jüngster Lauf
  leads: number[] // zugehöriger Vorlauf in Tagen (z. B. 7,6,…,1,0); 0 = aktueller Lauf
  ff: FlipFlop | null // null, wenn zu wenige Läufe (< MIN_RUNS)
}

// Dead-Bands im Stil des restlichen Codes (Trend nutzt ±1.5 °C):
const STABLE_RANGE = 1.5 // bewegte sich insgesamt weniger als das → „stabil"
const FLIP_ABS = 2.5 // Oszillation ab diesem Betrag → „Flip-Flop" (sonst „driftend")
const MIN_RUNS = 4 // darunter keine belastbare Aussage

/**
 * Flip-Flop-Index nach Griffiths et al. 2019 (Meteorol. Appl.): die gesamte
 * Weglänge der Prognose minus ihrer Spannweite. Eine monoton (glatt) konvergierende
 * Prognose hat totalVariation == range → flipFlop = 0. Jedes Hin-und-Her addiert
 * Weg, ohne die Spannweite zu vergrößern → flipFlop > 0.
 */
export function flipFlopIndex(runs: number[]): FlipFlop | null {
  if (runs.length < MIN_RUNS) return null
  let tv = 0
  let lo = runs[0]
  let hi = runs[0]
  for (let i = 1; i < runs.length; i++) {
    tv += Math.abs(runs[i] - runs[i - 1])
    if (runs[i] < lo) lo = runs[i]
    if (runs[i] > hi) hi = runs[i]
  }
  const range = hi - lo
  const flipFlop = tv - range
  const netChange = runs[runs.length - 1] - runs[0]

  let stability: Stability
  if (range < STABLE_RANGE) stability = 'stable'
  else if (flipFlop >= FLIP_ABS) stability = 'flip-flopping'
  else stability = 'drifting'

  return { totalVariation: tv, range, flipFlop, netChange, stability }
}

// alle vorhandenen `temperature_2m_previous_dayN`-Spalten, absteigend nach N
// (ältester Lauf zuerst). Robust: liest, was da ist, statt feste Lead-Liste.
function previousLeads(hourly: Record<string, unknown>): number[] {
  const leads: number[] = []
  for (const k of Object.keys(hourly)) {
    const m = /^temperature_2m_previous_day(\d+)$/.exec(k)
    if (m) leads.push(Number(m[1]))
  }
  return leads.sort((a, b) => b - a) // 7,6,5,…,1
}

/**
 * Für jeden künftigen Zieltag die Kette aufeinanderfolgender Läufe (Tages-Höchstwert),
 * ältester → jüngster, plus Flip-Flop-Kennzahl. `today` als ISO-Tag reinreichbar
 * (Testbarkeit); Standard = heute.
 */
export function runTrajectories(res: HourlySrc, today?: string): RunTrajectory[] {
  const h = res.hourly ?? {}
  const time = (h.time as string[]) ?? []
  if (time.length === 0) return []

  const todayIso = today ?? new Date().toISOString().slice(0, 10)
  const leads = previousLeads(h)

  // Tages-Höchstwert je Datum, für jede Spalte (previous_dayN + aktueller Lauf).
  const byLead = new Map<number, Map<string, number>>()
  for (const n of leads) {
    byLead.set(n, dailyExtremeByDate(time, (h[`temperature_2m_previous_day${n}`] as NumArr) ?? [], 'max'))
  }
  const current = dailyExtremeByDate(time, (h.temperature_2m as NumArr) ?? [], 'max')

  // künftige Zieltage (heute inklusive), aufsteigend
  const dates = [...current.keys()].filter((d) => d >= todayIso).sort((a, b) => a.localeCompare(b))

  const out: RunTrajectory[] = []
  for (const date of dates) {
    const runs: number[] = []
    const usedLeads: number[] = []
    for (const n of leads) {
      const v = byLead.get(n)!.get(date)
      if (v != null && !Number.isNaN(v)) {
        runs.push(v)
        usedLeads.push(n)
      }
    }
    const cur = current.get(date)
    if (cur != null && !Number.isNaN(cur)) {
      runs.push(cur)
      usedLeads.push(0)
    }
    out.push({ date, runs, leads: usedLeads, ff: flipFlopIndex(runs) })
  }
  return out
}
