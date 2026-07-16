import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SkyKind =
  | 'hot'
  | 'cold'
  | 'clear-day'
  | 'clear-night'
  | 'clouds'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow'

// WMO-Code + Tag/Nacht + Temperatur → Himmels-Stimmung.
// utci (optional): treibt „hot"/„cold" ehrlicher als die reine Lufttemperatur —
// ≥ +32 = starke Hitze, ≤ −13 = starke Kälte (amtliche UTCI-Schwellen). Ohne UTCI
// fällt „hot" auf temp ≥ 28 °C zurück. Niederschlags-Zustände behalten Vorrang.
export function classifySky(
  code: number,
  isDay: boolean,
  temp: number,
  utci?: number | null,
): SkyKind {
  if (code >= 95) return 'storm'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  // Kältestress überschreibt die milden Zustände (klar/bedeckt).
  if (utci != null && utci <= -13) return 'cold'
  if (code <= 2) {
    if (!isDay) return 'clear-night'
    const hot = utci != null ? utci >= 32 : temp >= 28
    return hot ? 'hot' : 'clear-day'
  }
  // 3 = bedeckt, sonst
  return 'clouds'
}

export const useSkyStore = defineStore('sky', () => {
  const kind = ref<SkyKind>('clouds')
  const isDay = ref(true)
  const temp = ref<number | null>(null)

  function apply(k: SkyKind, day: boolean, t: number | null) {
    kind.value = k
    isDay.value = day
    temp.value = t
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.sky = k
    }
  }

  function setFromCurrent(
    current: Record<string, number | string> | undefined,
    utci?: number | null,
  ) {
    if (!current) return
    const code = Number(current.weather_code ?? 3)
    const day = Number(current.is_day ?? 1) === 1
    const t = current.temperature_2m != null ? Number(current.temperature_2m) : null
    apply(classifySky(code, day, t ?? 15, utci), day, t)
  }

  return { kind, isDay, temp, apply, setFromCurrent }
})
