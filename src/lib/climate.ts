// Klima-Auswertung: Rekorde, Serien und Normalwert-Einordnung aus der kompletten
// ERA5-Tagesreihe (seit 1940). Alles reine, synchrone Funktionen — kein DOM, kein
// Netz — damit sie sich per `tsx` gegenläufig prüfen lassen (wie verify.ts).
//
// Ehrlichkeits-Hinweise, die in der UI sichtbar bleiben:
//  • Quelle ist die ERA5-Reanalyse (Gitterpunkt), NICHT das offizielle DWD-Stationsbuch.
//    „Wärmster 14. Juli seit 1940" ist damit belastbar, aber reanalyse-basiert.
//  • Das Archiv hinkt ~2 Tage hinterher → Serien enden am letzten Archivtag (`asOf`),
//    nicht „jetzt".

import type { ArchiveResponse } from '@/api/weather'
import type { NumArr } from '@/lib/series'

export interface ClimateDay {
  date: string // ISO yyyy-mm-dd
  year: number
  month: number // 1–12
  day: number // 1–31
  tmax: number
  tmin: number
  precip: number
}

// Frühester Jahrgang der ERA5-Reanalyse (Open-Meteo-Archiv).
export const ARCHIVE_FROM = 1940
// Normalwert-Periode (WMO-Standard: die jüngste abgeschlossene 30-Jahres-Periode).
export const NORMAL_FROM = 1991
export const NORMAL_TO = 2020
// „Nennenswerter" Regen: DWD-Niederschlagstag ist ≥ 0,1 mm; für eine gefühlt echte
// Trockenphase nehmen wir 1,0 mm — Nieselwerte der Reanalyse verwässern die Serie sonst.
export const WET_MM = 1.0
// Fenster (± Tage) um den Kalendertag für einen stabilen Normalwert (365 Tage sind
// zu verrauscht für einen einzelnen Tag).
const NORMAL_WINDOW = 7

/** ERA5-Archivantwort → sortierte, lückenlose Tagesliste (führt/schließende Nullen weg). */
export function parseClimate(resp: ArchiveResponse | undefined): ClimateDay[] {
  const d = resp?.daily
  if (!d) return []
  const time = (d.time as string[]) ?? []
  const tmax = (d.temperature_2m_max as NumArr) ?? []
  const tmin = (d.temperature_2m_min as NumArr) ?? []
  const precip = (d.precipitation_sum as NumArr) ?? []
  const out: ClimateDay[] = []
  for (let i = 0; i < time.length; i++) {
    const iso = time[i]
    const mx = tmax[i]
    const mn = tmin[i]
    if (mx == null || mn == null) continue
    out.push({
      date: iso,
      year: +iso.slice(0, 4),
      month: +iso.slice(5, 7),
      day: +iso.slice(8, 10),
      tmax: mx,
      tmin: mn,
      precip: precip[i] ?? 0,
    })
  }
  return out
}

/** Letzter Tag mit Daten — Bezugspunkt für „aktuell" (das Archiv hinkt ~2 Tage). */
export function asOfDate(days: ClimateDay[]): string | null {
  return days.length ? days[days.length - 1].date : null
}

// Menge der Kalendertage (Schlüssel month*100+day) im Fenster ±window um einen Tag.
// Über ein Datum iteriert, damit Monatsgrenzen/-längen und Jahreswechsel korrekt sind.
function windowKeys(month: number, day: number, window: number): Set<number> {
  const keys = new Set<number>()
  // Nicht-Schaltjahr als neutrale Achse; der 29.2. wird über sein Fenster mitgetroffen.
  const base = new Date(Date.UTC(2001, month - 1, day))
  for (let o = -window; o <= window; o++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + o)
    keys.add((d.getUTCMonth() + 1) * 100 + d.getUTCDate())
  }
  return keys
}

export interface DayNormals {
  tmaxNormal: number
  tminNormal: number
  nYears: number // Zahl der Referenzjahre mit Daten im Fenster
}

/** Klima-Normalwert (1991–2020) für einen Kalendertag, geglättet über ±7 Tage. */
export function normalsForDay(days: ClimateDay[], month: number, day: number): DayNormals | null {
  const keys = windowKeys(month, day, NORMAL_WINDOW)
  let sumMax = 0
  let sumMin = 0
  let n = 0
  const years = new Set<number>()
  for (const r of days) {
    if (r.year < NORMAL_FROM || r.year > NORMAL_TO) continue
    if (!keys.has(r.month * 100 + r.day)) continue
    sumMax += r.tmax
    sumMin += r.tmin
    years.add(r.year)
    n++
  }
  if (n < 30) return null
  return { tmaxNormal: sumMax / n, tminNormal: sumMin / n, nYears: years.size }
}

export interface CalendarRecord {
  value: number
  year: number
}
export interface CalendarDayRecords {
  hottest: CalendarRecord // höchster Höchstwert an diesem Kalendertag
  coldest: CalendarRecord // tiefster Tiefstwert
  wettest: CalendarRecord // größte Niederschlagssumme
  firstYear: number
  nYears: number
}

/** Rekorde exakt für diesen Kalendertag (z. B. „wärmster 14. Juli seit 1940"). */
export function calendarDayRecords(
  days: ClimateDay[],
  month: number,
  day: number,
): CalendarDayRecords | null {
  const key = month * 100 + day
  let hottest: CalendarRecord | null = null
  let coldest: CalendarRecord | null = null
  let wettest: CalendarRecord | null = null
  let firstYear = Infinity
  const years = new Set<number>()
  for (const r of days) {
    if (r.month * 100 + r.day !== key) continue
    years.add(r.year)
    if (r.year < firstYear) firstYear = r.year
    if (!hottest || r.tmax > hottest.value) hottest = { value: r.tmax, year: r.year }
    if (!coldest || r.tmin < coldest.value) coldest = { value: r.tmin, year: r.year }
    if (!wettest || r.precip > wettest.value) wettest = { value: r.precip, year: r.year }
  }
  if (!hottest || !coldest || !wettest) return null
  return { hottest, coldest, wettest, firstYear, nYears: years.size }
}

export interface DrySpell {
  current: number // aufeinanderfolgende Tage < WET_MM bis zum letzten Archivtag
  longest: number // längste Trockenphase der Reihe
  longestEnd: string | null // Enddatum der längsten Trockenphase
  lastWetDate: string | null // letzter Tag mit ≥ WET_MM
}

/** Trockenserien (Tage unter WET_MM). Reihe muss aufsteigend sortiert sein. */
export function drySpell(days: ClimateDay[]): DrySpell {
  let current = 0
  let run = 0
  let longest = 0
  let longestEnd: string | null = null
  let lastWetDate: string | null = null
  for (const r of days) {
    if (r.precip < WET_MM) {
      run++
      if (run > longest) {
        longest = run
        longestEnd = r.date
      }
    } else {
      run = 0
      lastWetDate = r.date
    }
  }
  // Aktuelle Serie = das letzte laufende Trocken-Run (am Reihenende).
  current = run
  return { current, longest, longestEnd, lastWetDate }
}

export interface Extreme {
  value: number
  date: string
}
export interface AllTimeExtremes {
  hottest: Extreme // höchster je gemessener Höchstwert
  coldest: Extreme // tiefster je gemessener Tiefstwert
  wettest: Extreme // nasser Tag (größte Tagessumme)
}

/** Allzeit-Extreme über die ganze Reihe. */
export function allTimeExtremes(days: ClimateDay[]): AllTimeExtremes | null {
  if (!days.length) return null
  let hottest = { value: -Infinity, date: '' }
  let coldest = { value: Infinity, date: '' }
  let wettest = { value: -Infinity, date: '' }
  for (const r of days) {
    if (r.tmax > hottest.value) hottest = { value: r.tmax, date: r.date }
    if (r.tmin < coldest.value) coldest = { value: r.tmin, date: r.date }
    if (r.precip > wettest.value) wettest = { value: r.precip, date: r.date }
  }
  return { hottest, coldest, wettest }
}
