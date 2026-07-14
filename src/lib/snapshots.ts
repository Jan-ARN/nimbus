// Prognose-Schnappschüsse — der „Samen" für die Modell-Bestenliste (§1a) und die
// Konvergenz-Wiedergabe (§3) aus CRAZY-IDEAS.md.
//
// Warum überhaupt: Open-Meteos previous-runs-API liefert nur den GEMISCHTEN Lauf
// rückwirkend (kein Modell-Suffix) und nur bis Vorlauf 7. Für eine Bestenliste
// „welches Modell ist HIER am besten" und für die Wiedergabe, wie sich eine
// Prognose über >7 Tage einpendelt, gibt es keine Abkürzung: Man muss die
// Prognosen ab jetzt täglich mitschreiben. Jeder nicht erfasste Tag ist für immer
// verloren — deshalb läuft das im Hintergrund, sichtbar nur als kleiner Zähler.
//
// Verifiziert wird später gegen das ERA5-Archiv (fetchArchive) — hier wird NUR
// aufgezeichnet.

import type { Place } from '@/stores/places'
import { fetchMultiModelForecast } from '@/api/weather'
import { extractDaily, type DailyBundle } from '@/lib/series'
import { WEATHER_MODELS } from '@/models'

const KEY = 'nimbus:fcsnap:v1'
const MAX_LEAD = 14 // die Prognose reicht 14 Tage → Vorläufe 1..14
const MAX_TARGET_AGE_DAYS = 120 // ältere Zieltage verwerfen (Speicher begrenzen)
const DAY_MS = 86_400_000

// [max, min] als kompaktes Tupel je Modell — hält den localStorage-Eintrag klein.
type ModelSnap = [number | null, number | null]
interface PlaceSnaps {
  lastRun: string // ISO-Tag des letzten Schreibens (Dedupe: 1× pro Tag)
  targets: Record<string, Record<number, Record<string, ModelSnap>>> // targetDate → lead → modelId
}
interface Store {
  version: 1
  places: Record<string, PlaceSnaps>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
function dayMs(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getTime()
}
function leadOf(issueIso: string, targetIso: string): number {
  return Math.round((dayMs(targetIso) - dayMs(issueIso)) / DAY_MS)
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      if (parsed?.version === 1 && parsed.places) return parsed
    }
  } catch {
    /* korrupte Daten → frisch anfangen */
  }
  return { version: 1, places: {} }
}
function saveStore(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* Quota o. Ä. — Schnappschüsse sind „best effort", nie kritisch */
  }
}

function prune(p: PlaceSnaps): void {
  const cutoff = Date.now() - MAX_TARGET_AGE_DAYS * DAY_MS
  for (const date of Object.keys(p.targets)) {
    if (dayMs(date) < cutoff) delete p.targets[date]
  }
}

/**
 * Schreibt die heutige Tages-Prognose (alle Modelle) je Zieltag und Vorlaufzeit
 * fort. Ein (Zieltag, Vorlauf, Modell) wird nur einmal belegt — der Snapshot des
 * Tages, an dem genau dieser Vorlauf zutrifft. Rein; kein Netz.
 */
export function recordDailyForecast(placeId: string, daily: DailyBundle, issueIso = todayIso()): void {
  if (!daily.time.length) return
  const store = loadStore()
  const p = (store.places[placeId] ??= { lastRun: '', targets: {} })

  for (let i = 0; i < daily.time.length; i++) {
    const targetDate = daily.time[i]
    const lead = leadOf(issueIso, targetDate)
    if (lead < 1 || lead > MAX_LEAD) continue
    const byLead = (p.targets[targetDate] ??= {})
    const byModel = (byLead[lead] ??= {})
    for (const m of daily.models) {
      if (byModel[m.modelId]) continue // erste Erfassung dieses Vorlaufs gilt
      const max = m.max[i]
      const min = m.min[i]
      if (max == null && min == null) continue
      byModel[m.modelId] = [max ?? null, min ?? null]
    }
  }

  p.lastRun = issueIso
  prune(p)
  saveStore(store)
}

/**
 * Einmal pro Ort und Tag: alle Modelle holen und fortschreiben. Dedupe über
 * `lastRun`, damit mehrfaches Öffnen der App am selben Tag keinen Extra-Request
 * auslöst. Fehler werden geschluckt — der Samen darf die App nie stören.
 */
export async function maybeSnapshotToday(place: Place): Promise<void> {
  const store = loadStore()
  if (store.places[place.id]?.lastRun === todayIso()) return
  try {
    const res = await fetchMultiModelForecast(place, WEATHER_MODELS.map((m) => m.id), 14)
    recordDailyForecast(place.id, extractDaily(res, WEATHER_MODELS.map((m) => m.id)))
  } catch {
    /* offline / API down → morgen wieder versuchen */
  }
}

export interface SnapshotProgress {
  days: number // erfasste Zieltage
  since: string | null // ältester erfasster Zieltag (ISO)
}

/** Kleiner, ehrlicher Fortschritt für die UI („N Tage gesammelt"). */
export function snapshotProgress(placeId: string): SnapshotProgress {
  const p = loadStore().places[placeId]
  if (!p) return { days: 0, since: null }
  const dates = Object.keys(p.targets).sort()
  return { days: dates.length, since: dates[0] ?? null }
}
