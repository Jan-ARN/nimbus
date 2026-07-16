import type { Place } from '@/stores/places'
import { i18n } from '@/i18n'

// --- Endpunkte -----------------------------------------------------------------
// Alle Quellen sind key-frei und CORS-fähig → direkt aus dem Browser aufrufbar,
// kein Proxy/Backend nötig (die App läuft rein statisch, z. B. auf GitHub Pages).
const ENDPOINTS: Record<string, string> = {
  '/api/forecast': 'https://api.open-meteo.com/v1/forecast',
  '/api/ensemble': 'https://ensemble-api.open-meteo.com/v1/ensemble',
  '/api/geocode': 'https://geocoding-api.open-meteo.com/v1/search',
  '/api/air': 'https://air-quality-api.open-meteo.com/v1/air-quality',
  '/api/warnings': 'https://api.brightsky.dev/alerts',
  // Beobachtete Werte (ERA5-Reanalyse) & Vorhersagen früherer Modell-Läufe →
  // damit lässt sich prüfen, wie gut die Prognose N Tage im Voraus wirklich war.
  '/api/archive': 'https://archive-api.open-meteo.com/v1/archive',
  '/api/previous': 'https://previous-runs-api.open-meteo.com/v1/forecast',
}

// --- Low-level fetch ----------------------------------------------------------
async function getJson<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const base = ENDPOINTS[path] ?? path
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  const res = await fetch(`${base}?${qs}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// --- Geocoding ----------------------------------------------------------------
export interface GeoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}
interface GeoResponse {
  results?: GeoResult[]
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (query.trim().length < 2) return []
  const data = await getJson<GeoResponse>('/api/geocode', {
    name: query,
    count: 8,
    language: i18n.global.locale.value,
    format: 'json',
  })
  return data.results ?? []
}

// --- Forecast (Mehr-Modell) ---------------------------------------------------
export interface ForecastResponse {
  latitude: number
  longitude: number
  timezone: string
  utc_offset_seconds: number
  hourly?: Record<string, (number | null)[] | string[]>
  daily?: Record<string, (number | null)[] | string[]>
  // Fehlerfall von Open-Meteo
  error?: boolean
  reason?: string
}

/**
 * Holt Stunden- und Tageswerte für mehrere Modelle gleichzeitig.
 * Variablen-Keys kommen als "<var>_<modelId>" zurück.
 */
export async function fetchMultiModelForecast(
  place: Place,
  modelIds: string[],
  days = 14,
): Promise<ForecastResponse> {
  return getJson<ForecastResponse>('/api/forecast', {
    latitude: place.lat,
    longitude: place.lon,
    models: modelIds.join(','),
    hourly: 'temperature_2m,surface_pressure',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    forecast_days: days,
    timezone: 'auto',
  })
}

// --- Ensemble (Langfrist) -----------------------------------------------------
export interface EnsembleResponse {
  latitude: number
  longitude: number
  timezone: string
  utc_offset_seconds: number
  hourly?: Record<string, (number | null)[] | string[]>
  error?: boolean
  reason?: string
}

/**
 * Ensemble-Vorhersage: viele Member eines Modells → Streuung/Tendenz.
 * Keys kommen als "temperature_2m_memberXX" (+ Basis = Kontrolllauf).
 * Modell: GFS/GEFS — das einzige frei verfügbare Ensemble, das wirklich ~35 Tage
 * reicht (ICON-EPS bricht nach ~7,5 Tagen ab, ECMWF-ENS nach ~15).
 */
export async function fetchEnsemble(place: Place, days = 35): Promise<EnsembleResponse> {
  return getJson<EnsembleResponse>('/api/ensemble', {
    latitude: place.lat,
    longitude: place.lon,
    models: 'gfs_seamless',
    // precipitation je Member → ehrliche Regenwahrscheinlichkeit direkt aus dem
    // Ensemble (Anteil der Läufe mit messbarem Regen), statt einer Blackbox-Zahl.
    hourly: 'temperature_2m,precipitation',
    forecast_days: days,
    timezone: 'auto',
  })
}

// --- Reiche Bedingungen (ein Modell, best_match) ------------------------------
export interface ConditionsResponse {
  current?: Record<string, number | string>
  current_units?: Record<string, string>
  hourly?: Record<string, (number | null)[] | string[]>
  daily?: Record<string, (number | null | string)[]>
  utc_offset_seconds?: number
}

export async function fetchConditions(place: Place, days = 14): Promise<ConditionsResponse> {
  return getJson<ConditionsResponse>('/api/forecast', {
    latitude: place.lat,
    longitude: place.lon,
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,is_day,surface_pressure,precipitation,cloud_cover',
    hourly:
      'temperature_2m,apparent_temperature,precipitation_probability,uv_index,relative_humidity_2m,wind_speed_10m,weather_code',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,sunshine_duration,daylight_duration',
    forecast_days: days,
    timezone: 'auto',
  })
}

// --- Luftqualität & Pollen ----------------------------------------------------
export const POLLEN_KEYS = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
] as const

export interface AirResponse {
  current?: Record<string, number | string>
  hourly?: Record<string, (number | null)[] | string[]>
}

export async function fetchAirQuality(place: Place): Promise<AirResponse> {
  const pollutants = 'european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide'
  return getJson<AirResponse>('/api/air', {
    latitude: place.lat,
    longitude: place.lon,
    current: `${pollutants},${POLLEN_KEYS.join(',')}`,
    hourly: `european_aqi,pm2_5,pm10,ozone,${POLLEN_KEYS.join(',')}`,
    forecast_days: 4,
    timezone: 'auto',
  })
}

// --- Unwetterwarnungen (DWD via Bright Sky) -----------------------------------
export interface WeatherAlert {
  event_de?: string
  event_en?: string
  headline_de?: string
  headline_en?: string
  description_de?: string
  description_en?: string
  severity?: string
  onset?: string
  expires?: string
  instruction_de?: string
  instruction_en?: string
}

export async function fetchWarnings(place: Place): Promise<WeatherAlert[]> {
  try {
    const data = await getJson<{ alerts?: WeatherAlert[] }>('/api/warnings', {
      lat: place.lat,
      lon: place.lon,
    })
    return data.alerts ?? []
  } catch {
    return []
  }
}

// --- Verlauf & Prognose-Güte --------------------------------------------------
// „Wie warm war es wirklich?" (ERA5-Reanalyse) plus „was hatte die Prognose N
// Tage vorher gesagt?" (frühere Modell-Läufe). Aus beidem lässt sich die
// tatsächliche Treffsicherheit der App nachrechnen.

export interface ArchiveResponse {
  daily?: Record<string, (number | null | string)[]>
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Beobachtete Tages-Höchst/Tiefstwerte der letzten `days` Tage (ERA5). */
export async function fetchArchive(place: Place, days = 14): Promise<ArchiveResponse> {
  const end = new Date()
  end.setDate(end.getDate() - 1) // gestern; die letzten ~1–2 Tage fehlen im Archiv
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return getJson<ArchiveResponse>('/api/archive', {
    latitude: place.lat,
    longitude: place.lon,
    start_date: isoDay(start),
    end_date: isoDay(end),
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
  })
}

/**
 * Komplette Tages-Klimareihe seit 1940 (ERA5-Reanalyse): Höchst-/Tiefstwert und
 * Niederschlag je Tag. Basis für Rekorde, Serien und die „ist das normal?"-Einordnung
 * (Klima-Normalwerte 1991–2020). Ein einziger, CORS-fähiger Request (~0,9 MB) — wird
 * dauerhaft gecacht, weil sich 85 Jahre Vergangenheit nicht mehr ändern.
 */
export async function fetchClimateArchive(place: Place): Promise<ArchiveResponse> {
  const end = new Date()
  end.setDate(end.getDate() - 1) // die letzten ~1–2 Tage fehlen im Archiv
  return getJson<ArchiveResponse>('/api/archive', {
    latitude: place.lat,
    longitude: place.lon,
    start_date: '1940-01-01',
    end_date: isoDay(end),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
  })
}

// Vorlaufzeiten (Tage), für die wir die frühere Prognose gegen die Realität halten.
export const LEAD_DAYS = [1, 3, 5, 7] as const

export interface PreviousRunsResponse {
  hourly?: Record<string, (number | null)[] | string[]>
}

/**
 * Stündliche Temperatur aus dem aktuellen Lauf plus den Läufen von vor 1/3/5/7
 * Tagen (`temperature_2m_previous_dayN`). Über den Tag aggregiert ergibt das die
 * Höchstwert-Prognose je Vorlaufzeit — Basis für den Soll/Ist-Vergleich.
 */
export async function fetchForecastRuns(place: Place, pastDays = 14): Promise<PreviousRunsResponse> {
  const prev = LEAD_DAYS.map((n) => `temperature_2m_previous_day${n}`).join(',')
  return getJson<PreviousRunsResponse>('/api/previous', {
    latitude: place.lat,
    longitude: place.lon,
    hourly: `temperature_2m,${prev}`,
    past_days: pastDays,
    forecast_days: 1,
    timezone: 'auto',
  })
}

// Lückenlose Lauf-Historie (1..7 Tage) — anders als LEAD_DAYS, das nur Stützstellen
// für den Güte-Vergleich braucht. Hier wollen wir JEDEN aufeinanderfolgenden Lauf,
// um für einen festen Zieltag zu sehen, wie sich die Prognose Lauf für Lauf bewegt.
export const EVOLUTION_LEADS = [1, 2, 3, 4, 5, 6, 7] as const

/**
 * „Wie hat die Prognose sich entschieden?" — für jeden künftigen Zieltag liefert
 * `temperature_2m_previous_dayN` (bei gleichem Gültigkeitszeitpunkt) den Wert aus
 * dem Lauf von vor N Tagen. Über die Spalten hinweg gelesen ergibt das die Kette
 * aufeinanderfolgender Läufe für denselben Tag — Basis für die Konvergenz-/Flip-Flop-Ansicht.
 * Empirisch bestätigt: bei festem Zeitstempel sind die Spalten offset-ausgerichtet
 * (Lauf N Tage älter), alle künftigen Tage sind lückenlos befüllt.
 */
export async function fetchRunEvolution(place: Place): Promise<PreviousRunsResponse> {
  const prev = EVOLUTION_LEADS.map((n) => `temperature_2m_previous_day${n}`).join(',')
  return getJson<PreviousRunsResponse>('/api/previous', {
    latitude: place.lat,
    longitude: place.lon,
    hourly: `temperature_2m,${prev}`,
    past_days: 2,
    forecast_days: 7,
    timezone: 'auto',
  })
}
