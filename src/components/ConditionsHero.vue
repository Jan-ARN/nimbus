<script setup lang="ts">
import { computed } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Star, MapPin, Sunrise, Sunset } from 'lucide-vue-next'
import Skeleton from '@/components/ui/Skeleton.vue'
import { usePlacesStore } from '@/stores/places'
import { useSkyStore } from '@/stores/sky'
import { fetchConditions, fetchAirQuality, POLLEN_KEYS } from '@/api/weather'
import { wmo, fmtTemp, windDir, uvLevel, aqiLevel, pollenLevel, fmtTime, pollenName } from '@/lib/format'
import { wmoIcon } from '@/lib/weatherIcon'

const { t } = useI18n()

const places = usePlacesStore()
const sky = useSkyStore()
const { active } = storeToRefs(places)

const cond = useQuery({
  queryKey: computed(() => ['conditions', active.value.id]),
  queryFn: () => fetchConditions(active.value, 14),
  placeholderData: keepPreviousData,
})
const air = useQuery({
  queryKey: computed(() => ['air', active.value.id]),
  queryFn: () => fetchAirQuality(active.value),
  placeholderData: keepPreviousData,
})

const c = computed(() => cond.data.value?.current as Record<string, number> | undefined)
const loading = computed(() => !c.value)
const daily = computed(() => cond.data.value?.daily as Record<string, (string | number)[]> | undefined)

const skyText = computed(() => wmo(c.value?.weather_code as number | undefined).label)
const skyIcon = computed(() => wmoIcon(c.value?.weather_code as number | undefined, sky.isDay))

const topPollen = computed(() => {
  const cur = air.data.value?.current as Record<string, number> | undefined
  if (!cur) return null
  let best: { key: string; v: number } | null = null
  for (const k of POLLEN_KEYS) {
    const v = cur[k]
    if (v != null && (!best || v > best.v)) best = { key: k, v }
  }
  return best
})
const aqi = computed(() => {
  const v = (air.data.value?.current as Record<string, number> | undefined)?.european_aqi
  return { value: v ?? null, ...aqiLevel(v) }
})

interface Stat { label: string; value: string; sub?: string; color?: string }
const stats = computed<Stat[]>(() => {
  if (!c.value) return []
  const uv = uvLevel(c.value.uv_index)
  const pol = topPollen.value ? pollenLevel(topPollen.value.v) : null
  const sun = daily.value
  return [
    { label: t('hero.feels'), value: fmtTemp(c.value.apparent_temperature, 0) },
    { label: t('hero.humidity'), value: `${Math.round(c.value.relative_humidity_2m)} %` },
    { label: t('hero.dewPoint'), value: fmtTemp(c.value.dew_point_2m, 0) },
    { label: t('hero.wind'), value: `${Math.round(c.value.wind_speed_10m)}`, sub: `km/h · ${t('hero.gusts')} ${Math.round(c.value.wind_gusts_10m)} · ${windDir(c.value.wind_direction_10m)}` },
    { label: t('hero.uvIndex'), value: c.value.uv_index?.toFixed(1) ?? '–', sub: uv.label, color: uv.color },
    { label: t('hero.pressure'), value: `${Math.round(c.value.surface_pressure)}`, sub: 'hPa' },
    { label: t('hero.cloud'), value: `${Math.round(c.value.cloud_cover)} %` },
    { label: t('hero.airQuality'), value: aqi.value.value != null ? String(Math.round(aqi.value.value)) : '–', sub: aqi.value.label, color: aqi.value.color },
    // Pollen-Zelle immer zeigen (auch ohne Luft-Daten) → stabile Zellenzahl,
    // der Streifen ruckelt nicht, wenn die separate Luft-Abfrage nachlädt.
    { label: t('hero.pollen'), value: topPollen.value ? pollenName(topPollen.value.key) : '–', sub: pol?.label, color: pol?.color },
    ...(sun ? [{ label: t('hero.sun'), value: fmtTime(sun.sunrise?.[0] as string), sub: `${t('hero.until')} ${fmtTime(sun.sunset?.[0] as string)}` }] : []),
  ]
})
</script>

<template>
  <div class="glass reveal overflow-hidden p-6 sm:p-7">
    <!-- Kopf: Ort · Sonnenzeiten -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <component :is="active.fixed ? Star : MapPin" :size="15" />
        <span>{{ active.name }}</span>
        <span v-if="active.admin" class="opacity-60">· {{ active.admin }}</span>
      </div>
      <div v-if="daily" class="label flex items-center gap-4">
        <span class="inline-flex items-center gap-1.5">
          <Sunrise :size="13" class="text-primary" />{{ fmtTime(daily.sunrise?.[0] as string) }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <Sunset :size="13" class="opacity-70" />{{ fmtTime(daily.sunset?.[0] as string) }}
        </span>
      </div>
      <Skeleton v-else class="h-3.5 w-28" />
    </div>

    <!-- Aktuelle Lage: ruhig, damit das Ensemble-Feld im Hintergrund wirkt -->
    <transition name="sk-fade" mode="out-in">
      <div v-if="!loading" key="live" class="mt-4 flex items-end gap-5">
        <div class="readout text-primary" style="font-size: clamp(56px, 11vw, 112px)">
          {{ fmtTemp(c?.temperature_2m, 0) }}
        </div>
        <div class="pb-3">
          <component :is="skyIcon" :size="34" class="text-primary" :stroke-width="1.5" />
          <div class="mt-1 text-[16px] font-semibold leading-tight">{{ skyText }}</div>
          <div class="text-[13px] text-muted-foreground">{{ $t('hero.feltShort') }} {{ fmtTemp(c?.apparent_temperature, 0) }}</div>
        </div>
      </div>
      <div v-else key="load" class="mt-4 flex items-end gap-5">
        <Skeleton class="h-[92px] w-[150px] sm:h-[104px]" />
        <div class="flex flex-col gap-2 pb-3">
          <Skeleton class="h-[34px] w-[34px] rounded-full" />
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-3 w-16" />
        </div>
      </div>
    </transition>

    <!-- Instrument-Strip: alle Werte als ein geripptes Panel statt Einzelkacheln -->
    <transition name="sk-fade" mode="out-in">
      <div v-if="!loading" key="live" class="strip mt-5">
        <div v-for="s in stats" :key="s.label" class="cell">
          <div class="label">{{ s.label }}</div>
          <div class="readout mt-1.5 text-[21px]" :style="s.color ? { color: s.color } : undefined">{{ s.value }}</div>
          <div v-if="s.sub" class="mt-0.5 text-[11px] text-muted-foreground">{{ s.sub }}</div>
        </div>
      </div>
      <div v-else key="load" class="strip mt-5">
        <div v-for="i in 10" :key="i" class="cell">
          <Skeleton class="h-2.5 w-12" />
          <Skeleton class="mt-2.5 h-5 w-14" />
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Ein zusammenhängendes Instrument-Panel: Haarlinien-Raster statt schwebender
   Kacheln — ordnet sich dem Bogen-Hero unter. */
.strip {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
/* Zellen wachsen → die letzte Reihe füllt die Breite, keine tote Fläche. */
.cell {
  flex: 1 1 130px;
  background: color-mix(in srgb, var(--background) 55%, transparent);
  padding: 12px 15px 13px;
}
</style>
