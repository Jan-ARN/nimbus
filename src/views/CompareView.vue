<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { Droplet, ChevronDown } from 'lucide-vue-next'
import PlaceSelector from '@/components/PlaceSelector.vue'
import ConditionsHero from '@/components/ConditionsHero.vue'
import MultiLineChart from '@/components/MultiLineChart.vue'
import type { LineSeries } from '@/lib/chartTypes'
import { usePlacesStore } from '@/stores/places'
import { fetchMultiModelForecast, fetchConditions } from '@/api/weather'
import { WEATHER_MODELS, DEFAULT_MODEL_IDS, modelById } from '@/models'
import { extractHourly, extractDaily, nearestHourIndex } from '@/lib/series'
import { fmtTemp, fmtDay, tempColor, uvLevel, fmtTime } from '@/lib/format'
import { wmoIcon } from '@/lib/weatherIcon'

const places = usePlacesStore()
const { active } = storeToRefs(places)

const selectedModels = ref<string[]>([...DEFAULT_MODEL_IDS])
function toggleModel(id: string) {
  const s = new Set(selectedModels.value)
  if (s.has(id)) {
    if (s.size > 1) s.delete(id)
  } else s.add(id)
  selectedModels.value = WEATHER_MODELS.filter((m) => s.has(m.id)).map((m) => m.id)
}

const rangeDays = ref(7)
const expandedDay = ref<string | null>(null)

const query = useQuery({
  queryKey: computed(() => ['forecast', active.value.id, [...selectedModels.value].sort()]),
  queryFn: () => fetchMultiModelForecast(active.value, selectedModels.value, 16),
})
const cond = useQuery({
  queryKey: computed(() => ['conditions', active.value.id]),
  queryFn: () => fetchConditions(active.value, 16),
})

const hourly = computed(() => (query.data.value ? extractHourly(query.data.value, selectedModels.value) : null))
const daily = computed(() => (query.data.value ? extractDaily(query.data.value, selectedModels.value) : null))
const richDaily = computed(() => cond.data.value?.daily)
const nowIdx = computed(() => (hourly.value ? nearestHourIndex(hourly.value.time) : 0))

const chartData = computed(() => {
  if (!hourly.value) return null
  const start = nowIdx.value
  const end = Math.min(hourly.value.time.length, start + rangeDays.value * 24)
  const time = hourly.value.time.slice(start, end)
  const series: LineSeries[] = hourly.value.models.map((m) => {
    const meta = modelById(m.modelId)!
    return { key: m.modelId, label: meta.short, color: meta.color, values: m.temperature.slice(start, end) }
  })
  return { time, series }
})

const dailyRows = computed(() => {
  if (!daily.value) return []
  return daily.value.time.map((day, i) => {
    const maxes = daily.value!.models.map((m) => m.max[i]).filter((v): v is number => v != null)
    const mins = daily.value!.models.map((m) => m.min[i]).filter((v): v is number => v != null)
    const meanMax = maxes.length ? maxes.reduce((s, v) => s + v, 0) / maxes.length : null
    const meanMin = mins.length ? mins.reduce((s, v) => s + v, 0) / mins.length : null
    const disagree = maxes.length ? Math.max(...maxes) - Math.min(...maxes) : 0
    const ri = (richDaily.value?.time as string[] | undefined)?.indexOf(day) ?? -1
    const rich =
      ri >= 0 && richDaily.value
        ? {
            code: richDaily.value.weather_code?.[ri] as number,
            precipProb: richDaily.value.precipitation_probability_max?.[ri] as number,
            precipSum: richDaily.value.precipitation_sum?.[ri] as number,
            windMax: richDaily.value.wind_speed_10m_max?.[ri] as number,
            gustMax: richDaily.value.wind_gusts_10m_max?.[ri] as number,
            uvMax: richDaily.value.uv_index_max?.[ri] as number,
            sunrise: richDaily.value.sunrise?.[ri] as string,
            sunset: richDaily.value.sunset?.[ri] as string,
          }
        : null
    return {
      day,
      meanMax,
      meanMin,
      disagree,
      nModels: maxes.length,
      rich,
      perModel: daily.value!.models.map((m) => ({
        id: m.modelId,
        short: modelById(m.modelId)!.short,
        color: modelById(m.modelId)!.color,
        max: m.max[i],
        min: m.min[i],
      })),
    }
  })
})

function barLeft(v: number | null, lo: number, hi: number) {
  if (v == null) return 0
  return ((v - lo) / (hi - lo || 1)) * 100
}
const dayExtent = (row: (typeof dailyRows.value)[number]): [number, number] => {
  const vals = row.perModel.flatMap((m) => [m.min, m.max]).filter((v): v is number => v != null)
  return vals.length ? [Math.min(...vals) - 1, Math.max(...vals) + 1] : [0, 1]
}
function disagreeColor(d: number) {
  return d > 4 ? 'var(--bad)' : d > 2 ? 'var(--warn)' : 'var(--good)'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConditionsHero />

    <!-- Ort + Modelle -->
    <section class="glass reveal p-5">
      <div class="label mb-2">Ort</div>
      <PlaceSelector />
      <div class="label mb-2 mt-4">Modelle vergleichen</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in WEATHER_MODELS"
          :key="m.id"
          class="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all hover:-translate-y-px"
          :style="
            selectedModels.includes(m.id)
              ? { background: m.color, color: '#080d18', borderColor: m.color, boxShadow: `0 6px 18px -8px ${m.color}` }
              : { color: m.color, borderColor: m.color }
          "
          @click="toggleModel(m.id)"
        >
          {{ m.label }}
        </button>
      </div>
    </section>

    <!-- Verlauf -->
    <section class="glass reveal p-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-display text-[22px] font-semibold">Temperaturverlauf</h2>
          <div class="label">stündlich · {{ selectedModels.length }} Modelle</div>
        </div>
        <div class="flex overflow-hidden rounded-full border border-border">
          <button
            v-for="r in [3, 7, 16]"
            :key="r"
            class="px-3.5 py-1.5 font-mono text-xs transition-colors"
            :class="rangeDays === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="rangeDays = r"
          >
            {{ r }} T
          </button>
        </div>
      </div>
      <MultiLineChart
        v-if="chartData && chartData.time.length"
        :time="chartData.time"
        :series="chartData.series"
        unit="°"
        :now-iso="hourly?.time[nowIdx]"
      />
      <div v-else class="grid h-52 place-items-center font-mono text-[13px] text-muted-foreground">
        lädt Modelldaten…
      </div>
    </section>

    <!-- Tagesübersicht -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">16-Tage-Ausblick</h2>
      <div class="label mb-4">Was die Modelle gemeinsam sagen · Tag antippen für Details</div>

      <div class="flex flex-col">
        <div v-for="row in dailyRows" :key="row.day" class="border-b border-border last:border-0">
          <button
            class="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left transition-colors hover:bg-muted"
            @click="expandedDay = expandedDay === row.day ? null : row.day"
          >
            <span class="w-24 text-sm font-medium capitalize text-muted-foreground">{{ fmtDay(row.day) }}</span>
            <component
              :is="wmoIcon(row.rich?.code, true)"
              v-if="row.rich"
              :size="20"
              :stroke-width="1.6"
              :style="{ color: tempColor(row.meanMax) }"
            />
            <span
              v-if="row.rich && row.rich.precipProb != null"
              class="inline-flex items-center gap-0.5 font-mono text-xs text-cool"
            >
              <Droplet :size="13" />{{ Math.round(row.rich.precipProb) }}%
            </span>
            <span class="flex-1" />
            <span class="flex items-baseline gap-2.5">
              <span class="readout text-[22px]" :style="{ color: tempColor(row.meanMax) }">{{ fmtTemp(row.meanMax) }}</span>
              <span class="readout text-lg text-muted-foreground">{{ fmtTemp(row.meanMin) }}</span>
            </span>
            <span class="flex w-[84px] items-center justify-end gap-1.5 font-mono text-[11px] text-muted-foreground">
              <template v-if="row.nModels >= 2">
                <span class="h-2 w-2 rounded-full" :style="{ background: disagreeColor(row.disagree) }" />
                ±{{ (row.disagree / 2).toFixed(1) }}°
              </template>
              <!-- Bei nur 1 verbliebenen Modell ist ±0° kein Konsens, sondern fehlende Basis. -->
              <span v-else class="text-warn" title="Nur ein Modell reicht so weit — keine belastbare Streuung">1 Modell</span>
            </span>
            <ChevronDown :size="18" class="text-muted-foreground transition-transform" :class="{ 'rotate-180': expandedDay === row.day }" />
          </button>

          <div v-if="expandedDay === row.day" class="grid gap-6 px-1 pb-5 pt-2 md:grid-cols-[1.3fr_1fr]">
            <!-- pro Modell -->
            <div>
              <div class="label mb-2">Höchst-/Tiefstwert je Modell</div>
              <div v-for="m in row.perModel" :key="m.id" class="grid grid-cols-[52px_1fr_92px] items-center gap-2.5 py-1">
                <span class="text-xs font-bold" :style="{ color: m.color }">{{ m.short }}</span>
                <div class="relative h-2 rounded-full bg-muted">
                  <div
                    class="absolute inset-y-0 rounded-full"
                    :style="{
                      left: barLeft(m.min, dayExtent(row)[0], dayExtent(row)[1]) + '%',
                      right: 100 - barLeft(m.max, dayExtent(row)[0], dayExtent(row)[1]) + '%',
                      background: `linear-gradient(90deg, ${tempColor(m.min)}, ${tempColor(m.max)})`,
                    }"
                  />
                </div>
                <span class="text-right font-mono text-[11.5px] text-muted-foreground">{{ fmtTemp(m.min) }}/{{ fmtTemp(m.max) }}</span>
              </div>
            </div>

            <!-- Detail-Werte -->
            <div v-if="row.rich" class="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border border-border bg-border">
              <div class="bg-[color-mix(in_srgb,var(--background)_55%,transparent)] px-3 py-2.5">
                <div class="label">Regen</div>
                <div class="readout mt-1 text-xl">{{ Math.round(row.rich.precipProb ?? 0) }}%</div>
                <div class="text-[11px] text-muted-foreground">{{ (row.rich.precipSum ?? 0).toFixed(1) }} mm</div>
              </div>
              <div class="bg-[color-mix(in_srgb,var(--background)_55%,transparent)] px-3 py-2.5">
                <div class="label">Wind</div>
                <div class="readout mt-1 text-xl">{{ Math.round(row.rich.windMax ?? 0) }}</div>
                <div class="text-[11px] text-muted-foreground">Böen {{ Math.round(row.rich.gustMax ?? 0) }} km/h</div>
              </div>
              <div class="bg-[color-mix(in_srgb,var(--background)_55%,transparent)] px-3 py-2.5">
                <div class="label">UV max</div>
                <div class="readout mt-1 text-xl" :style="{ color: uvLevel(row.rich.uvMax).color }">{{ (row.rich.uvMax ?? 0).toFixed(1) }}</div>
                <div class="text-[11px] text-muted-foreground">{{ uvLevel(row.rich.uvMax).label }}</div>
              </div>
              <div class="bg-[color-mix(in_srgb,var(--background)_55%,transparent)] px-3 py-2.5">
                <div class="label">Sonne</div>
                <div class="readout mt-1 text-xl">{{ fmtTime(row.rich.sunrise) }}</div>
                <div class="text-[11px] text-muted-foreground">bis {{ fmtTime(row.rich.sunset) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
