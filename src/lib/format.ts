// WMO Weather-Codes → Label + MDI-Icon (kompakte Auswahl)
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Klar', icon: 'mdi-weather-sunny' },
  1: { label: 'Überwiegend klar', icon: 'mdi-weather-partly-cloudy' },
  2: { label: 'Teils bewölkt', icon: 'mdi-weather-partly-cloudy' },
  3: { label: 'Bedeckt', icon: 'mdi-weather-cloudy' },
  45: { label: 'Nebel', icon: 'mdi-weather-fog' },
  48: { label: 'Reifnebel', icon: 'mdi-weather-fog' },
  51: { label: 'Leichter Niesel', icon: 'mdi-weather-rainy' },
  53: { label: 'Niesel', icon: 'mdi-weather-rainy' },
  55: { label: 'Starker Niesel', icon: 'mdi-weather-pouring' },
  61: { label: 'Leichter Regen', icon: 'mdi-weather-rainy' },
  63: { label: 'Regen', icon: 'mdi-weather-rainy' },
  65: { label: 'Starker Regen', icon: 'mdi-weather-pouring' },
  71: { label: 'Leichter Schnee', icon: 'mdi-weather-snowy' },
  73: { label: 'Schnee', icon: 'mdi-weather-snowy' },
  75: { label: 'Starker Schnee', icon: 'mdi-weather-snowy-heavy' },
  80: { label: 'Regenschauer', icon: 'mdi-weather-partly-rainy' },
  81: { label: 'Schauer', icon: 'mdi-weather-pouring' },
  82: { label: 'Heftige Schauer', icon: 'mdi-weather-pouring' },
  95: { label: 'Gewitter', icon: 'mdi-weather-lightning' },
  96: { label: 'Gewitter mit Hagel', icon: 'mdi-weather-lightning-rainy' },
  99: { label: 'Schweres Gewitter', icon: 'mdi-weather-lightning-rainy' },
}

export function wmo(code: number | null | undefined) {
  if (code == null) return { label: '–', icon: 'mdi-weather-cloudy-alert' }
  return WMO[code] ?? { label: `Code ${code}`, icon: 'mdi-weather-cloudy' }
}

export function fmtTemp(t: number | null | undefined, digits = 0): string {
  if (t == null || Number.isNaN(t)) return '–'
  return `${t.toFixed(digits)}°`
}

export function fmtDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short' })
}

// Farbverlauf kalt→heiß für Temperatur (grob an Wetterkarten angelehnt)
export function tempColor(t: number | null | undefined): string {
  if (t == null) return '#556'
  const stops: [number, string][] = [
    [-15, '#7b2dbd'],
    [-5, '#3b4cc0'],
    [0, '#4aa8ff'],
    [10, '#3ddc97'],
    [18, '#c7e94a'],
    [24, '#ffb454'],
    [30, '#ff7847'],
    [38, '#ff2e4d'],
  ]
  if (t <= stops[0][0]) return stops[0][1]
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i]
    const [b, cb] = stops[i + 1]
    if (t >= a && t <= b) return lerpColor(ca, cb, (t - a) / (b - a))
  }
  return '#556'
}

// Windrichtung (Grad) → Kompass-Kürzel
const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
export function windDir(deg: number | null | undefined): string {
  if (deg == null) return '–'
  return COMPASS[Math.round(deg / 45) % 8]
}

// UV-Index → Stufe + Farbe
export function uvLevel(uv: number | null | undefined): { label: string; color: string } {
  if (uv == null) return { label: '–', color: '#61728f' }
  if (uv < 3) return { label: 'niedrig', color: '#3ddc97' }
  if (uv < 6) return { label: 'mäßig', color: '#c7e94a' }
  if (uv < 8) return { label: 'hoch', color: '#ffb454' }
  if (uv < 11) return { label: 'sehr hoch', color: '#ff7847' }
  return { label: 'extrem', color: '#c792ea' }
}

// Europäischer Luftqualitätsindex (EAQI) → Stufe + Farbe
export function aqiLevel(aqi: number | null | undefined): { label: string; color: string } {
  if (aqi == null) return { label: '–', color: '#61728f' }
  if (aqi <= 20) return { label: 'sehr gut', color: '#3ddc97' }
  if (aqi <= 40) return { label: 'gut', color: '#8fd14f' }
  if (aqi <= 60) return { label: 'mäßig', color: '#ffb454' }
  if (aqi <= 80) return { label: 'schlecht', color: '#ff7847' }
  if (aqi <= 100) return { label: 'sehr schlecht', color: '#ff5d73' }
  return { label: 'extrem schlecht', color: '#c792ea' }
}

// Pollenkonzentration (Körner/m³) → Belastung
export function pollenLevel(v: number | null | undefined): { label: string; color: string; frac: number } {
  if (v == null) return { label: 'keine', color: '#61728f', frac: 0 }
  if (v < 1) return { label: 'keine', color: '#61728f', frac: 0.05 }
  if (v < 20) return { label: 'gering', color: '#3ddc97', frac: 0.3 }
  if (v < 50) return { label: 'mäßig', color: '#ffb454', frac: 0.6 }
  if (v < 100) return { label: 'hoch', color: '#ff7847', frac: 0.85 }
  return { label: 'sehr hoch', color: '#ff5d73', frac: 1 }
}

export const POLLEN_LABELS: Record<string, string> = {
  alder_pollen: 'Erle',
  birch_pollen: 'Birke',
  grass_pollen: 'Gräser',
  mugwort_pollen: 'Beifuß',
  olive_pollen: 'Olive',
  ragweed_pollen: 'Ambrosia',
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h} h ${m} min`
}

// Bright-Sky-/DWD-Severity → Farbe
export function severityColor(sev: string | null | undefined): string {
  switch ((sev || '').toLowerCase()) {
    case 'extreme':
      return '#c792ea'
    case 'severe':
      return '#ff5d73'
    case 'moderate':
      return '#ff7847'
    default:
      return '#ffb454'
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hex(a)
  const pb = hex(b)
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return `rgb(${r},${g},${bl})`
}
function hex(h: string): [number, number, number] {
  const n = h.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
