import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  Cloudy,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
  type LucideProps,
} from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

type Icon = FunctionalComponent<LucideProps>

// WMO-Code → passendes lucide-Icon (tag-/nachtabhängig für klar/leicht bewölkt)
export function wmoIcon(code: number | null | undefined, isDay = true): Icon {
  if (code == null) return Cloud
  if (code === 0) return isDay ? Sun : Moon
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon
  if (code === 3) return Cloudy
  if (code === 45 || code === 48) return CloudFog
  if (code >= 51 && code <= 57) return CloudDrizzle
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return CloudRain
  if (code === 66 || code === 67) return CloudRainWind
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow
  if (code >= 95) return CloudLightning
  return Cloud
}
