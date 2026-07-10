<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import PlaceSelector from '@/components/PlaceSelector.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchAirQuality, POLLEN_KEYS } from '@/api/weather'
import { aqiLevel, pollenLevel, POLLEN_LABELS } from '@/lib/format'

const places = usePlacesStore()
const { active } = storeToRefs(places)

const air = useQuery({
  queryKey: computed(() => ['air', active.value.id]),
  queryFn: () => fetchAirQuality(active.value),
})
const cur = computed(() => air.data.value?.current as Record<string, number> | undefined)

const aqi = computed(() => {
  const v = cur.value?.european_aqi
  return { value: v ?? null, ...aqiLevel(v) }
})

const SEGMENTS: [number, number, string][] = [
  [0, 20, 'sehr gut'],
  [20, 40, 'gut'],
  [40, 60, 'mäßig'],
  [60, 80, 'schlecht'],
  [80, 100, 'sehr schl.'],
]

const POLLUTANTS: { key: string; label: string; unit: string; max: number }[] = [
  { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³', max: 75 },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', max: 150 },
  { key: 'ozone', label: 'Ozon', unit: 'µg/m³', max: 240 },
  { key: 'nitrogen_dioxide', label: 'NO₂', unit: 'µg/m³', max: 200 },
  { key: 'sulphur_dioxide', label: 'SO₂', unit: 'µg/m³', max: 350 },
  { key: 'carbon_monoxide', label: 'CO', unit: 'µg/m³', max: 15000 },
]
const pollutants = computed(() =>
  POLLUTANTS.map((p) => {
    const v = cur.value?.[p.key] ?? null
    return { ...p, value: v, frac: v == null ? 0 : Math.min(1, v / p.max) }
  }),
)

const pollen = computed(() =>
  POLLEN_KEYS.map((k) => {
    const v = cur.value?.[k] ?? null
    return { key: k, name: POLLEN_LABELS[k], value: v, ...pollenLevel(v) }
  }).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="glass reveal p-5">
      <div class="label mb-2">Ort</div>
      <PlaceSelector />
    </section>

    <!-- AQI Hero -->
    <section class="glass grid-texture reveal grid items-center gap-8 p-6 sm:grid-cols-[auto_1fr]">
      <div>
        <div class="label">Europäischer Luftqualitätsindex · {{ active.name }}</div>
        <div class="readout" style="font-size: clamp(70px, 11vw, 116px)" :style="{ color: aqi.color }">
          {{ aqi.value != null ? Math.round(aqi.value) : '–' }}
        </div>
        <div class="text-xl font-semibold capitalize" :style="{ color: aqi.color }">{{ aqi.label }}</div>
      </div>
      <div class="flex items-end gap-1.5">
        <div v-for="(seg, i) in SEGMENTS" :key="i" class="flex-1 text-center">
          <div
            class="h-2.5 rounded-full transition-opacity"
            :style="{
              background: aqiLevel((seg[0] + seg[1]) / 2).color,
              opacity: aqi.value != null && aqi.value >= seg[0] ? 1 : 0.28,
            }"
          />
          <span class="mt-1.5 block text-[10px] text-muted-foreground">{{ seg[2] }}</span>
        </div>
      </div>
    </section>

    <!-- Schadstoffe -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">Schadstoffe</h2>
      <div class="label mb-4">aktuelle Konzentration</div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-7 gap-y-4">
        <div v-for="p in pollutants" :key="p.key">
          <div class="mb-1.5 flex items-baseline justify-between">
            <span class="text-sm font-semibold">{{ p.label }}</span>
            <span class="font-mono text-xs text-muted-foreground">{{ p.value != null ? Math.round(p.value) : '–' }} {{ p.unit }}</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded bg-muted">
            <div
              class="h-full rounded"
              style="background: linear-gradient(90deg, var(--good), var(--warn), var(--bad))"
              :style="{ width: p.frac * 100 + '%' }"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Pollen -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">Pollenflug</h2>
      <div class="label mb-4">Körner pro m³ Luft</div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
        <div v-for="p in pollen" :key="p.key" class="p-2 text-center">
          <div class="text-[13px] font-semibold">{{ p.name }}</div>
          <div
            class="ring mx-auto my-2.5 grid h-[84px] w-[84px] place-items-center rounded-full"
            :style="{ '--f': p.frac, '--c': p.color }"
          >
            <span class="readout text-[22px]">{{ p.value != null ? Math.round(p.value) : '–' }}</span>
          </div>
          <span class="text-xs font-medium" :style="{ color: p.color }">{{ pollenLevel(p.value).label }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ring {
  background:
    radial-gradient(closest-side, var(--background) 79%, transparent 80% 100%),
    conic-gradient(var(--c) calc(var(--f) * 360deg), var(--muted) 0);
}
</style>
