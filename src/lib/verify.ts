// Prognose-Verifikation & Bias-Korrektur — reine Funktionen, komplett im Browser.
//
// Grundgedanke: Aus den früheren Modell-Läufen (previous-runs) und der ERA5-
// Realität lässt sich nicht nur messen, WIE gut die Prognose war, sondern die
// systematische Abweichung (Bias) auch herausrechnen — und zwar EHRLICH, also
// nur mit Daten, die zum Ausgabezeitpunkt der jeweiligen Prognose schon bekannt
// waren. Sonst „korrigiert" man mit Wissen aus der Zukunft und die behauptete
// Verbesserung ist geschönt.

export interface DatedPair {
  date: string // ISO-Tag (YYYY-MM-DD) des ZIELtags
  forecast: number | null
  actual: number
}

export interface Pair {
  forecast: number
  actual: number
}

export interface Metrics {
  n: number
  me: number // mittlerer (vorzeichenbehafteter) Fehler → Bias. + = zu warm
  mae: number // mittlerer absoluter Fehler
  rmse: number // Wurzel des mittleren quadratischen Fehlers
}

/** ME / MAE / RMSE über gepaarte (Prognose, Realität). */
export function metrics(pairs: Pair[]): Metrics | null {
  if (!pairs.length) return null
  let e = 0
  let ae = 0
  let se = 0
  for (const p of pairs) {
    const d = p.forecast - p.actual
    e += d
    ae += Math.abs(d)
    se += d * d
  }
  const n = pairs.length
  return { n, me: e / n, mae: ae / n, rmse: Math.sqrt(se / n) }
}

/** Mittlerer quadratischer Fehler (für Skill-Scores). */
export function mse(pairs: Pair[]): number {
  if (!pairs.length) return NaN
  let se = 0
  for (const p of pairs) {
    const d = p.forecast - p.actual
    se += d * d
  }
  return se / pairs.length
}

/**
 * Skill-Score gegen eine Referenz: 1 = perfekt, 0 = nicht besser als Referenz,
 * < 0 = schlechter. `SS = 1 − MSE_modell / MSE_referenz`.
 */
export function skillScore(mseModel: number, mseRef: number): number {
  if (!Number.isFinite(mseModel) || !Number.isFinite(mseRef) || mseRef === 0) return NaN
  return 1 - mseModel / mseRef
}

const DAY_MS = 86_400_000

function dayMs(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getTime()
}

export interface Corrected {
  date: string
  actual: number
  forecast: number | null // roh
  corrected: number | null // Bias-korrigiert (null, solange zu wenig Historie)
  bias: number | null // die abgezogene systematische Abweichung
}

export interface CorrectOpts {
  /** wie viele Prüf-Paare (jüngste) in den Bias einfließen */
  window?: number
  /** darunter keine Korrektur (zu wenig Historie) */
  minSamples?: number
  /** Verzögerung, bis ein Zieltag im Archiv steht (ERA5 ~1–2 Tage) */
  lagDays?: number
}

/**
 * Kausale, laufende Bias-Korrektur für eine Prognose mit Vorlaufzeit `leadDays`.
 *
 * Entscheidend für die Ehrlichkeit: Die Prognose für Zieltag D wurde bei D−lead
 * ausgegeben. Zum Korrigieren dürfen daher nur Prüf-Paare herangezogen werden,
 * deren Realität zu diesem Zeitpunkt schon feststand — also Zieltage
 * T ≤ D − (leadDays + lagDays). Ein naives „letzte N Tage"-Fenster würde die
 * Realität der jüngsten lead+lag Tage einbeziehen (Blick in die Zukunft) und die
 * Verbesserung künstlich aufblasen.
 */
export function causalBiasCorrect(
  rows: DatedPair[],
  leadDays: number,
  opts: CorrectOpts = {},
): Corrected[] {
  const window = opts.window ?? 30
  const minSamples = opts.minSamples ?? 5
  const lagDays = opts.lagDays ?? 2

  const pts = rows
    .map((r) => ({
      date: r.date,
      actual: r.actual,
      forecast: r.forecast,
      ms: dayMs(r.date),
      error: r.forecast != null ? r.forecast - r.actual : null,
    }))
    .sort((a, b) => a.ms - b.ms)

  return pts.map((r) => {
    const base = { date: r.date, actual: r.actual, forecast: r.forecast }
    if (r.forecast == null) return { ...base, corrected: null, bias: null }

    const cutoff = r.ms - (leadDays + lagDays) * DAY_MS
    const sample: number[] = []
    for (const q of pts) {
      if (q.ms > cutoff) break // pts ist aufsteigend sortiert → ab hier zu jung
      if (q.error != null) sample.push(q.error)
    }
    const recent = sample.slice(-window)
    if (recent.length < minSamples) return { ...base, corrected: null, bias: null }

    const bias = recent.reduce((s, e) => s + e, 0) / recent.length
    return { ...base, corrected: r.forecast - bias, bias }
  })
}

/**
 * Persistenz-Referenz für Vorlaufzeit `leadDays`: „morgen wie der zuletzt
 * bekannte Wert" — hier die Realität `leadDays` Tage vor dem Zieltag. Der
 * einfachste Maßstab, den eine sinnvolle Prognose schlagen muss.
 */
export function persistencePairs(rows: DatedPair[], leadDays: number): (Pair & { date: string })[] {
  const actualByDay = new Map<string, number>()
  for (const r of rows) actualByDay.set(r.date, r.actual)
  const out: (Pair & { date: string })[] = []
  for (const r of rows) {
    const prevIso = new Date(dayMs(r.date) - leadDays * DAY_MS).toISOString().slice(0, 10)
    const prev = actualByDay.get(prevIso)
    if (prev != null) out.push({ date: r.date, forecast: prev, actual: r.actual })
  }
  return out
}
