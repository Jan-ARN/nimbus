<script setup lang="ts">
// Sterngucker-Uhr: bestes dunkles Fenster heute Nacht (astronomische Dunkelheit,
// Sonne < −18°) × Wolkenschichten × Mond × Aerosol.
import { computed } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Telescope, Moon } from 'lucide-vue-next'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchConditions, fetchAirQuality } from '@/api/weather'
import { nearestHourIndex } from '@/lib/series'
import { solarElevationDeg, moon as moonAt, stargazeScore, findBestWindow } from '@/lib/wx'
import { localeTag } from '@/i18n'

const { t } = useI18n()
const places = usePlacesStore()
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

const HORIZON = 20 // Stunden vorausschauen (heute Abend bis morgen früh)

function col(h: Record<string, unknown> | undefined, k: string): (number | null)[] {
  const a = h?.[k]
  return Array.isArray(a) ? (a as (number | null)[]) : []
}

const analysis = computed(() => {
  const h = cond.data.value?.hourly as Record<string, unknown> | undefined
  const time = (h?.time as string[] | undefined) ?? []
  if (!time.length) return null
  const lat = active.value.lat
  const lon = active.value.lon
  const low = col(h, 'cloud_cover_low')
  const mid = col(h, 'cloud_cover_mid')
  const high = col(h, 'cloud_cover_high')
  const pm25 = (air.data.value?.current as Record<string, number> | undefined)?.pm2_5 ?? null

  const now = nearestHourIndex(time)
  const end = Math.min(time.length, now + HORIZON)
  const scores: number[] = []
  const times: string[] = []
  for (let i = now; i < end; i++) {
    const date = new Date(time[i])
    const dark = solarElevationDeg(date, lat, lon) < -18
    if (!dark) {
      scores.push(0)
      times.push(time[i])
      continue
    }
    const m = moonAt(date, lat, lon)
    scores.push(
      stargazeScore({
        cloudLowPct: low[i],
        cloudMidPct: mid[i],
        cloudHighPct: high[i],
        moonIllumination: m.illumination,
        moonUp: m.up,
        aerosolPm25: pm25,
      }),
    )
    times.push(time[i])
  }
  const window = findBestWindow(scores, times, 45)
  const moonNow = moonAt(new Date(time[now]), lat, lon)
  return { window, moonPct: Math.round(moonNow.illumination * 100) }
})

const headline = computed(() => {
  const a = analysis.value
  if (!a) return null
  if (!a.window) return { text: t('star.none'), quality: null as string | null }
  const w = a.window
  const s = new Date(w.startIso)
  const e = new Date(w.endIso)
  const hh = (d: Date) => d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
  const range = `${hh(s)}–${hh(new Date(e.getTime() + 3_600_000))}`
  const quality = w.meanScore >= 75 ? t('star.great') : w.meanScore >= 55 ? t('star.good') : t('star.faint')
  return { text: t('star.tonight', { range }), quality }
})
</script>

<template>
  <section class="glass reveal p-5">
    <div class="mb-3 flex items-center gap-3">
      <Telescope :size="22" class="text-primary" />
      <div>
        <h2 class="font-display text-[22px] font-semibold leading-none">{{ $t('star.title') }}</h2>
        <div class="label mt-1">{{ $t('star.sub') }}</div>
      </div>
    </div>
    <div v-if="!analysis" class="grid h-[80px] place-items-center"><Spinner /></div>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">{{ headline?.text }}</div>
          <div v-if="headline?.quality" class="text-[13px] text-primary">{{ headline.quality }}</div>
        </div>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Moon :size="16" />{{ $t('star.moon', { pct: analysis.moonPct }) }}
        </div>
      </div>
    </template>
  </section>
</template>
