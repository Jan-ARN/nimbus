import type { Place } from '@/stores/places'

// --- Endpunkte -----------------------------------------------------------------
// Alle Quellen sind key-frei und CORS-fähig → direkt aus dem Browser aufrufbar,
// kein Proxy/Backend nötig (die App läuft rein statisch, z. B. auf GitHub Pages).
const ENDPOINTS: Record<string, string> = {
  '/api/forecast': 'https://api.open-meteo.com/v1/forecast',
  '/api/ensemble': 'https://ensemble-api.open-meteo.com/v1/ensemble',
  '/api/geocode': 'https://geocoding-api.open-meteo.com/v1/search',
  '/api/air': 'https://air-quality-api.open-meteo.com/v1/air-quality',
  '/api/warnings': 'https://api.brightsky.dev/alerts',
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
    language: 'de',
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
  days = 16,
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
    hourly: 'temperature_2m',
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

export async function fetchConditions(place: Place, days = 16): Promise<ConditionsResponse> {
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
  severity?: string
  onset?: string
  expires?: string
  instruction_de?: string
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
