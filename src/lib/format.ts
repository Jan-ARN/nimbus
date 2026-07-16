import { i18n, localeTag } from '@/i18n'
import type { UtciCategory } from '@/lib/wx/categories'
import type { ThunderLevel, FogLevel } from '@/lib/wx/indices'

// t()/localeTag() lesen die aktive Sprache reaktiv → in computeds/Templates
// verwendete Formatierer aktualisieren sich beim Sprachwechsel automatisch.
const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {})

// WMO Weather-Codes → Icon-Schlüssel (Label kommt aus den Übersetzungen)
const WMO_ICON: Record<number, string> = {
  0: 'mdi-weather-sunny',
  1: 'mdi-weather-partly-cloudy',
  2: 'mdi-weather-partly-cloudy',
  3: 'mdi-weather-cloudy',
  45: 'mdi-weather-fog',
  48: 'mdi-weather-fog',
  51: 'mdi-weather-rainy',
  53: 'mdi-weather-rainy',
  55: 'mdi-weather-pouring',
  61: 'mdi-weather-rainy',
  63: 'mdi-weather-rainy',
  65: 'mdi-weather-pouring',
  71: 'mdi-weather-snowy',
  73: 'mdi-weather-snowy',
  75: 'mdi-weather-snowy-heavy',
  80: 'mdi-weather-partly-rainy',
  81: 'mdi-weather-pouring',
  82: 'mdi-weather-pouring',
  95: 'mdi-weather-lightning',
  96: 'mdi-weather-lightning-rainy',
  99: 'mdi-weather-lightning-rainy',
}

export function wmo(code: number | null | undefined) {
  if (code == null) return { label: t('none'), icon: 'mdi-weather-cloudy-alert' }
  const icon = WMO_ICON[code] ?? 'mdi-weather-cloudy'
  const label = code in WMO_ICON ? t(`wmo.${code}`) : t('wmo.code', { c: code })
  return { label, icon }
}

export function fmtTemp(t: number | null | undefined, digits = 0): string {
  if (t == null || Number.isNaN(t)) return '–'
  return `${t.toFixed(digits)}°`
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(localeTag(), { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString(localeTag(), { weekday: 'short' })
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

// Windrichtung (Grad) → Kompass-Kürzel (lokalisiert: NO/O/SO vs. NE/E/SE)
const COMPASS: Record<string, string[]> = {
  'de-DE': ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  'en-GB': ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
}
export function windDir(deg: number | null | undefined): string {
  if (deg == null) return '–'
  return COMPASS[localeTag()][Math.round(deg / 45) % 8]
}

// UV-Index → Stufe + Farbe
export function uvLevel(uv: number | null | undefined): { label: string; color: string } {
  if (uv == null) return { label: t('none'), color: '#61728f' }
  if (uv < 3) return { label: t('uv.low'), color: '#3ddc97' }
  if (uv < 6) return { label: t('uv.moderate'), color: '#c7e94a' }
  if (uv < 8) return { label: t('uv.high'), color: '#ffb454' }
  if (uv < 11) return { label: t('uv.veryHigh'), color: '#ff7847' }
  return { label: t('uv.extreme'), color: '#c792ea' }
}

// Europäischer Luftqualitätsindex (EAQI) → Stufe + Farbe
export function aqiLevel(aqi: number | null | undefined): { label: string; color: string } {
  if (aqi == null) return { label: t('none'), color: '#61728f' }
  if (aqi <= 20) return { label: t('aqi.veryGood'), color: '#3ddc97' }
  if (aqi <= 40) return { label: t('aqi.good'), color: '#8fd14f' }
  if (aqi <= 60) return { label: t('aqi.moderate'), color: '#ffb454' }
  if (aqi <= 80) return { label: t('aqi.bad'), color: '#ff7847' }
  if (aqi <= 100) return { label: t('aqi.veryBad'), color: '#ff5d73' }
  return { label: t('aqi.extremeBad'), color: '#c792ea' }
}

// Pollenkonzentration (Körner/m³) → Belastung
export function pollenLevel(v: number | null | undefined): { label: string; color: string; frac: number } {
  if (v == null) return { label: t('pollenLevel.none'), color: '#61728f', frac: 0 }
  if (v < 1) return { label: t('pollenLevel.none'), color: '#61728f', frac: 0.05 }
  if (v < 20) return { label: t('pollenLevel.low'), color: '#3ddc97', frac: 0.3 }
  if (v < 50) return { label: t('pollenLevel.moderate'), color: '#ffb454', frac: 0.6 }
  if (v < 100) return { label: t('pollenLevel.high'), color: '#ff7847', frac: 0.85 }
  return { label: t('pollenLevel.veryHigh'), color: '#ff5d73', frac: 1 }
}

// Pollenart-Schlüssel → lokalisierter Name
export function pollenName(key: string): string {
  return t(`pollenName.${key}`)
}

// UTCI-Stresskategorie → Label + Farbe (kalt = blau, angenehm = grün, heiß = rot)
const UTCI_COLORS: Record<UtciCategory, string> = {
  extremeCold: '#6a8cff',
  veryStrongCold: '#4aa8ff',
  strongCold: '#46b6ff',
  moderateCold: '#6cc4e0',
  slightCold: '#8fd6d6',
  noStress: '#3ddc97',
  moderateHeat: '#ffb454',
  strongHeat: '#ff8a3d',
  veryStrongHeat: '#ff5d73',
  extremeHeat: '#c792ea',
}
export function utciLevel(cat: UtciCategory | null | undefined): { label: string; color: string } {
  if (!cat) return { label: t('none'), color: '#61728f' }
  return { label: t(`utci.${cat}`), color: UTCI_COLORS[cat] }
}

// Wäsche-/Trocknungsindex (0..100) → Einschätzung
export function dryingLevel(score: number | null | undefined): { label: string; color: string } {
  if (score == null) return { label: t('none'), color: '#61728f' }
  if (score < 25) return { label: t('drying.poor'), color: '#ff7847' }
  if (score < 55) return { label: t('drying.ok'), color: '#ffb454' }
  return { label: t('drying.good'), color: '#3ddc97' }
}

// Gewitterpotenzial → Label + Farbe
const THUNDER_COLORS: Record<ThunderLevel, string> = {
  none: '#61728f',
  moderate: '#ffb454',
  strong: '#ff7847',
  extreme: '#c792ea',
}
export function thunderLevel(level: ThunderLevel): { label: string; color: string } {
  return { label: t(`thunder.${level}`), color: THUNDER_COLORS[level] }
}

// Nebelrisiko → Label + Farbe
const FOG_COLORS: Record<FogLevel, string> = {
  none: '#61728f',
  low: '#8fd6d6',
  moderate: '#ffb454',
  high: '#ff7847',
}
export function fogLevel(level: FogLevel): { label: string; color: string } {
  return { label: t(`fog.${level}`), color: FOG_COLORS[level] }
}

// Feuer-/Trockenstress (0..100) → Einschätzung
export function fireLevel(score: number | null | undefined): { label: string; color: string } {
  if (score == null) return { label: t('none'), color: '#61728f' }
  if (score < 35) return { label: t('fire.low'), color: '#3ddc97' }
  if (score < 65) return { label: t('fire.moderate'), color: '#ffb454' }
  return { label: t('fire.high'), color: '#ff5d73' }
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
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
