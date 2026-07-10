// Kuratierte Auswahl an Wettermodellen, die Open-Meteo bereitstellt.
// `id` ist der Wert für den &models=-Parameter; die Variablen-Keys der Antwort
// werden dann mit "_<id>" suffigiert (z. B. temperature_2m_icon_seamless).

export interface WeatherModel {
  id: string
  label: string
  short: string
  origin: string
  color: string
}

// Gedämpfte, harmonische Farbfamilie statt gesättigtem Regenbogen: ICON (das
// Heimat-Modell, DWD) trägt das Himmel-Primär-Blau, der Rest ist entsättigt und
// bleibt trotzdem unterscheidbar.
export const WEATHER_MODELS: WeatherModel[] = [
  { id: 'icon_seamless', label: 'ICON (DWD)', short: 'ICON', origin: 'Deutschland', color: '#6ea8ff' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS', short: 'ECMWF', origin: 'Europa', color: '#e6b980' },
  { id: 'gfs_seamless', label: 'GFS (NOAA)', short: 'GFS', origin: 'USA', color: '#7fd1b0' },
  { id: 'gem_seamless', label: 'GEM', short: 'GEM', origin: 'Kanada', color: '#e58f96' },
  { id: 'meteofrance_seamless', label: 'ARPEGE/AROME', short: 'MF', origin: 'Frankreich', color: '#b59be0' },
  { id: 'jma_seamless', label: 'JMA', short: 'JMA', origin: 'Japan', color: '#d99bc4' },
  { id: 'ukmo_seamless', label: 'UK Met Office', short: 'UKMO', origin: 'UK', color: '#86c0e8' },
]

export const DEFAULT_MODEL_IDS = ['icon_seamless', 'ecmwf_ifs025', 'gfs_seamless']

export function modelById(id: string): WeatherModel | undefined {
  return WEATHER_MODELS.find((m) => m.id === id)
}
