<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { TrendingUp, TrendingDown, MoveRight, Info, ArrowUp, ArrowDown, Equal } from 'lucide-vue-next'
import BandChart from '@/components/BandChart.vue'
import EnsembleHopsChart from '@/components/EnsembleHopsChart.vue'
import EnsembleMeteogramChart from '@/components/EnsembleMeteogramChart.vue'
import QuantileDotplot from '@/components/QuantileDotplot.vue'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchEnsemble } from '@/api/weather'
import { aggregateEnsemble, ensembleMembers, ensemblePrecip, bimodalSplit } from '@/lib/series'
import { verbalProbability, naturalFrequency } from '@/lib/probability'
import { localeTag } from '@/i18n'

const { t } = useI18n()

const places = usePlacesStore()
const { active } = storeToRefs(places)

const RELIABLE_DAYS = 14

const query = useQuery({
  queryKey: computed(() => ['ensemble', active.value.id]),
  queryFn: () => fetchEnsemble(active.value, 35),
  placeholderData: keepPreviousData,
})

const days = computed(() => (query.data.value ? aggregateEnsemble(query.data.value) : []))
const precipDays = computed(() => (query.data.value ? ensemblePrecip(query.data.value) : []))

// „Fokus-Tag" für das Quantil-Punktdiagramm + ehrliche Regenwahrscheinlichkeit.
// Standard = morgen (Index 1); auf das verlässliche Fenster begrenzt.
const focusIdx = ref(1)
const focusChips = computed(() => {
  const cap = Math.min(reliableUntil.value || days.value.length, days.value.length, 7)
  return days.value.slice(0, cap).map((d, i) => ({
    i,
    label: i === 0
      ? t('focus.today')
      : i === 1
        ? t('focus.tomorrow')
        : new Date(d.date).toLocaleDateString(localeTag(), { weekday: 'short' }),
  }))
})
const focusDay = computed(() => days.value[Math.min(focusIdx.value, days.value.length - 1)] ?? null)
const focusPop = computed(() => {
  const d = focusDay.value
  if (!d) return null
  const p = precipDays.value.find((x) => x.date === d.date)
  if (!p) return null
  const pct = Math.round(p.pop * 100)
  const term = verbalProbability(p.pop)
  return { pct, wet: p.wet, total: p.total, medianMm: p.medianMm, term, freq: naturalFrequency(p.pop, p.total) }
})
// Icon-Raster für die natürliche Häufigkeit (nasse Läufe zuerst).
const popCells = computed(() => {
  const p = focusPop.value
  if (!p) return []
  return Array.from({ length: p.total }, (_, i) => i < p.freq)
})

// Ansicht: geglättetes Band · Meteogramm (Box-Whisker + Punktstreu) · einzelne Läufe (HOPs).
type OutlookView = 'band' | 'meteogram' | 'members'
const view = ref<OutlookView>('band')

// Member-Bahnen auf die days-Reihenfolge (nach Datum) ausrichten.
const memberSeries = computed<(number | null)[][]>(() => {
  if (!query.data.value) return []
  const em = ensembleMembers(query.data.value)
  const idxByDate = new Map(em.dates.map((d, i) => [d, i]))
  return em.members.map((m) => days.value.map((d) => {
    const j = idxByDate.get(d.date)
    return j == null ? null : m[j]
  }))
})

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

// Erster Tag im verlässlichen Fenster, an dem das Ensemble in zwei Lager zerfällt
// (steuert den Meteogramm-Hinweis). null = noch keine Daten; sonst mit/ohne Split.
const mgSplit = computed(() => {
  if (!days.value.length) return null
  const shown = days.value.slice(0, reliableUntil.value || days.value.length)
  for (const d of shown) {
    const b = bimodalSplit(d.highs)
    if (b.isBimodal) {
      return {
        split: true as const,
        day: new Date(d.date).toLocaleDateString(localeTag(), { weekday: 'long', day: '2-digit', month: '2-digit' }),
        low: Math.round(b.lowMean),
        high: Math.round(b.highMean),
        pct: Math.round((1 - b.lowFrac) * 100), // Anteil im wärmeren Lager
      }
    }
  }
  return { split: false as const }
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
    <!-- Tendenz-Headline -->
    <section class="glass grid-texture reveal flex items-center gap-4 p-6 sm:gap-6">
      <div
        class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border sm:h-[76px] sm:w-[76px]"
        :style="{ borderColor: trendColor, background: `color-mix(in srgb, ${trendColor} 16%, transparent)` }"
      >
        <component :is="TrendIcon" :size="34" :style="{ color: trendColor }" />
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

    <!-- Band-Chart / animierte Läufe -->
    <section class="glass reveal p-5">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-display text-[22px] font-semibold">{{ $t('longRange.highsOutlook') }}</h2>
          <div class="label">{{ view === 'band' ? $t('longRange.highsOutlookSub') : view === 'meteogram' ? $t('longRange.mgSub') : $t('longRange.hopsSub') }}</div>
        </div>
        <div class="flex shrink-0 overflow-hidden rounded-full border border-border">
          <button
            v-for="v in (['band', 'meteogram', 'members'] as const)"
            :key="v"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="view = v"
          >
            {{ $t(v === 'band' ? 'longRange.viewBand' : v === 'meteogram' ? 'longRange.viewMeteogram' : 'longRange.viewMembers') }}
          </button>
        </div>
      </div>

      <!-- Meteogramm-Hinweis: Lager-Split (ehrlich, auch wenn Einigkeit herrscht) -->
      <div
        v-if="view === 'meteogram' && mgSplit"
        class="mb-3 flex items-start gap-2 rounded-md border px-4 py-2.5 text-[13px]"
        :class="mgSplit.split ? 'border-[color-mix(in_srgb,var(--warn)_45%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] text-foreground' : 'border-border bg-[color-mix(in_srgb,var(--cool)_8%,transparent)] text-muted-foreground'"
      >
        <span>
          {{ mgSplit.split
            ? $t('longRange.mgCalloutSplit', { day: mgSplit.day, low: mgSplit.low, high: mgSplit.high, pct: mgSplit.pct })
            : $t('longRange.mgCalloutAgree') }}
        </span>
      </div>
      <transition name="sk-fade" mode="out-in">
        <BandChart v-if="days.length && view === 'band'" :days="days" :baseline="baseline" :reliable-until="reliableUntil" />
        <EnsembleMeteogramChart
          v-else-if="days.length && view === 'meteogram'"
          :days="days"
          :reliable-until="reliableUntil"
        />
        <EnsembleHopsChart
          v-else-if="days.length && view === 'members'"
          :days="days"
          :members="memberSeries"
          :reliable-until="reliableUntil"
        />
        <div v-else class="grid h-[240px] place-items-center sm:h-[290px] lg:h-[320px]"><Spinner /></div>
      </transition>
    </section>

    <!-- Fokus-Tag: Quantil-Punktdiagramm + ehrliche Regenwahrscheinlichkeit -->
    <section v-if="focusDay" class="glass reveal p-5">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-display text-[22px] font-semibold">{{ $t('focus.title') }}</h2>
          <div class="label">{{ $t('focus.sub') }}</div>
        </div>
        <div class="flex shrink-0 flex-wrap overflow-hidden rounded-full border border-border">
          <button
            v-for="c in focusChips"
            :key="c.i"
            class="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
            :class="focusIdx === c.i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="focusIdx = c.i"
          >
            {{ c.label }}
          </button>
        </div>
      </div>

      <!-- Höchstwert-Verteilung als abzählbare Punkte -->
      <div class="label mb-1">{{ $t('focus.highDist', { n: focusDay.highs.length }) }}</div>
      <QuantileDotplot :highs="focusDay.highs" :median="focusDay.median" />
      <p class="mb-5 mt-1 text-[13px] text-muted-foreground">
        {{ $t('focus.highRead', { median: Math.round(focusDay.median), lo: Math.round(focusDay.p25), hi: Math.round(focusDay.p75) }) }}
      </p>

      <!-- Regenwahrscheinlichkeit: natürliche Häufigkeit + kalibriertes Wort -->
      <template v-if="focusPop">
        <div class="label mb-2">{{ $t('focus.rainTitle') }}</div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="readout text-2xl">{{ focusPop.pct }}%</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium"
            :style="{ color: 'var(--cool)', background: 'color-mix(in srgb, var(--cool) 14%, transparent)' }"
          >
            {{ $t('probability.term.' + focusPop.term.key) }} ({{ focusPop.term.lo }}–{{ focusPop.term.hi }}%)
          </span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1" :aria-label="$t('focus.rainFreq', { wet: focusPop.wet, total: focusPop.total })">
          <span
            v-for="(wet, i) in popCells"
            :key="i"
            class="h-2.5 w-2.5 rounded-full"
            :style="{ background: wet ? 'var(--cool)' : 'color-mix(in srgb, var(--foreground) 12%, transparent)' }"
          />
        </div>
        <p class="mt-2 text-[13px] text-muted-foreground">
          {{ $t('focus.rainRead', { wet: focusPop.wet, total: focusPop.total }) }}
          <template v-if="focusPop.wet > 0">{{ ' ' }}{{ $t('focus.rainMedian', { mm: focusPop.medianMm.toFixed(1) }) }}</template>
        </p>
      </template>
    </section>

    <!-- Trend-Kacheln -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('longRange.warmerColder') }}</h2>
      <div class="label mb-4">{{ $t('longRange.comparedToToday', { base: baseline?.toFixed(0) }) }}</div>
      <div v-if="!dayCells.length" class="grid h-[200px] place-items-center"><Spinner /></div>
      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
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
