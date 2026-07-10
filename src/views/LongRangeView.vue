<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { TrendingUp, TrendingDown, MoveRight, Info, ArrowUp, ArrowDown, Equal } from 'lucide-vue-next'
import PlaceSelector from '@/components/PlaceSelector.vue'
import BandChart from '@/components/BandChart.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchEnsemble } from '@/api/weather'
import { aggregateEnsemble } from '@/lib/series'
import { localeTag } from '@/i18n'

const { t } = useI18n()

const places = usePlacesStore()
const { active } = storeToRefs(places)

const RELIABLE_DAYS = 16

const query = useQuery({
  queryKey: computed(() => ['ensemble', active.value.id]),
  queryFn: () => fetchEnsemble(active.value, 35),
})

const days = computed(() => (query.data.value ? aggregateEnsemble(query.data.value) : []))

// „Heute" = der heutige erwartete Höchstwert (erster Tag, Median), NICHT ein
// Mehrtages-Mittel — sonst sind alle Abweichungen systematisch zu klein.
const baseline = computed(() => days.value[0]?.median)

const trend = computed(() => {
  const d = days.value
  if (d.length < 4) return null
  const n = d.length
  const xs = d.map((_, i) => i)
  const ys = d.map((x) => x.median)
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slopePerDay = den ? num / den : 0
  const totalChange = slopePerDay * (n - 1)
  let dir: 'up' | 'down' | 'flat' = 'flat'
  if (totalChange > 1.5) dir = 'up'
  else if (totalChange < -1.5) dir = 'down'
  return { slopePerDay, totalChange, dir }
})

const reliableUntil = computed(() => {
  const idx = days.value.findIndex(
    (d) => (Date.now() - new Date(d.date).getTime()) / 86_400_000 < -RELIABLE_DAYS,
  )
  return idx === -1 ? days.value.length : idx
})

// Jeden Tag zeigen (früher jeder 3. → der heißeste Tag konnte übersprungen
// werden). Abweichung des Median-Höchstwerts gegenüber heute.
const dayCells = computed(() => {
  if (baseline.value == null) return []
  return days.value.map((d) => ({ date: d.date, anomaly: d.median - baseline.value! }))
})

const trendText = computed(() => {
  if (!trend.value) return t('longRange.trendLoading')
  if (trend.value.dir === 'up') return t('longRange.trendWarmer')
  if (trend.value.dir === 'down') return t('longRange.trendCooler')
  return t('longRange.trendStable')
})
const TrendIcon = computed(() => {
  if (!trend.value) return MoveRight
  return trend.value.dir === 'up' ? TrendingUp : trend.value.dir === 'down' ? TrendingDown : MoveRight
})
const trendColor = computed(() => {
  if (!trend.value || trend.value.dir === 'flat') return 'var(--muted-foreground)'
  return trend.value.dir === 'up' ? 'var(--hot)' : 'var(--cool)'
})

function anomalyColor(a: number): string {
  const t = Math.max(-6, Math.min(6, a)) / 6
  if (t >= 0) return `rgba(255,120,71,${0.22 + t * 0.6})`
  return `rgba(74,168,255,${0.22 + -t * 0.6})`
}
function cellIcon(a: number) {
  return a >= 0.5 ? ArrowUp : a <= -0.5 ? ArrowDown : Equal
}
function cellIconColor(a: number) {
  return a >= 0.5 ? 'var(--hot)' : a <= -0.5 ? 'var(--cool)' : 'var(--muted-foreground)'
}
function fmtCellDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="glass reveal p-5">
      <div class="label mb-2">{{ $t('place.label') }}</div>
      <PlaceSelector />
    </section>

    <!-- Tendenz-Headline -->
    <section class="glass grid-texture reveal flex items-center gap-6 p-6">
      <div
        class="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl border"
        :style="{ borderColor: trendColor, background: `color-mix(in srgb, ${trendColor} 16%, transparent)` }"
      >
        <component :is="TrendIcon" :size="38" :style="{ color: trendColor }" />
      </div>
      <div>
        <div class="label">{{ active.name }} · {{ $t('longRange.nextDays', { n: days.length }) }}</div>
        <h1 class="font-display font-semibold tracking-tight" style="font-size: clamp(26px, 4vw, 38px); line-height: 1.05">
          {{ trendText }}
        </h1>
        <div v-if="trend" class="text-[13px] text-muted-foreground">
          {{ $t('longRange.highsVsToday', { change: (trend.totalChange >= 0 ? '+' : '') + trend.totalChange.toFixed(1) }) }}
        </div>
      </div>
    </section>

    <div class="flex items-start gap-2 rounded-md border border-border bg-[color-mix(in_srgb,var(--cool)_8%,transparent)] px-4 py-3 text-[13px] text-muted-foreground">
      <Info :size="15" class="mt-0.5 shrink-0" />
      <i18n-t keypath="longRange.infoText" tag="span" scope="global">
        <template #dir><strong class="text-foreground">{{ $t('longRange.infoDir') }}</strong></template>
      </i18n-t>
    </div>

    <!-- Band-Chart -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('longRange.highsOutlook') }}</h2>
      <div class="label mb-4">{{ $t('longRange.highsOutlookSub') }}</div>
      <BandChart v-if="days.length" :days="days" :baseline="baseline" :reliable-until="reliableUntil" />
      <div v-else class="grid h-52 place-items-center font-mono text-[13px] text-muted-foreground">{{ $t('longRange.loadingEnsemble') }}</div>
    </section>

    <!-- Trend-Kacheln -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('longRange.warmerColder') }}</h2>
      <div class="label mb-4">{{ $t('longRange.comparedToToday', { base: baseline?.toFixed(0) }) }}</div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
        <div
          v-for="c in dayCells"
          :key="c.date"
          class="rounded-lg border px-1.5 py-3 text-center"
          :style="{ background: anomalyColor(c.anomaly), borderColor: anomalyColor(c.anomaly) }"
        >
          <div class="font-mono text-[11px] opacity-90">{{ fmtCellDate(c.date) }}</div>
          <div class="readout my-1 text-xl">{{ c.anomaly >= 0 ? '+' : '' }}{{ c.anomaly.toFixed(1) }}°</div>
          <component :is="cellIcon(c.anomaly)" :size="16" class="mx-auto" :style="{ color: cellIconColor(c.anomaly) }" />
        </div>
      </div>
    </section>
  </div>
</template>
