<script setup lang="ts">
import { computed } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Flame, Snowflake, CloudRain, Droplets, TrendingUp, TrendingDown, Info } from 'lucide-vue-next'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchClimateArchive, fetchConditions } from '@/api/weather'
import {
  parseClimate, asOfDate, normalsForDay, calendarDayRecords, drySpell, allTimeExtremes,
  ARCHIVE_FROM, NORMAL_FROM, NORMAL_TO, WET_MM,
} from '@/lib/climate'
import { fmtTemp } from '@/lib/format'
import { localeTag } from '@/i18n'

const { t } = useI18n()
const places = usePlacesStore()
const { active } = storeToRefs(places)

// 85 Jahre Vergangenheit ändern sich nicht → einmal holen, dauerhaft cachen.
const climate = useQuery({
  queryKey: computed(() => ['climate', active.value.id]),
  queryFn: () => fetchClimateArchive(active.value),
  placeholderData: keepPreviousData,
  staleTime: Infinity,
  gcTime: Infinity,
})
// Heutiger Prognose-Höchstwert — gleicher Query-Key wie Hero/App → geteilter Cache.
const cond = useQuery({
  queryKey: computed(() => ['conditions', active.value.id]),
  queryFn: () => fetchConditions(active.value, 14),
  placeholderData: keepPreviousData,
})

const days = computed(() => parseClimate(climate.data.value))
const asOf = computed(() => asOfDate(days.value))

// Heutiges Datum als Bezug für Kalendertag-Normal & -Rekorde.
const now = new Date()
const todayMonth = now.getMonth() + 1
const todayDay = now.getDate()

const todayHigh = computed(() => {
  const mx = cond.data.value?.daily?.temperature_2m_max as (number | null)[] | undefined
  return typeof mx?.[0] === 'number' ? (mx[0] as number) : null
})

const normals = computed(() => (days.value.length ? normalsForDay(days.value, todayMonth, todayDay) : null))
const dayRecords = computed(() => (days.value.length ? calendarDayRecords(days.value, todayMonth, todayDay) : null))
const spell = computed(() => (days.value.length ? drySpell(days.value) : null))
const extremes = computed(() => (days.value.length ? allTimeExtremes(days.value) : null))

// „Ist das normal?": heutiger Höchstwert minus Klima-Normalwert für diesen Kalendertag.
const anomaly = computed(() => {
  if (normals.value == null || todayHigh.value == null) return null
  return todayHigh.value - normals.value.tmaxNormal
})
// Divergierende Farbe: wärmer als normal → rot, kühler → blau.
const anomalyColor = computed(() => {
  const a = anomaly.value
  if (a == null) return 'var(--muted-foreground)'
  const k = Math.min(1, Math.abs(a) / 8)
  return a >= 0 ? `rgba(255,120,71,${0.55 + k * 0.45})` : `rgba(74,168,255,${0.55 + k * 0.45})`
})
const anomalyWord = computed(() => {
  const a = anomaly.value
  if (a == null) return ''
  if (Math.abs(a) < 0.5) return t('records.anomalyNormal')
  return a > 0 ? t('records.anomalyWarm', { v: a.toFixed(1) }) : t('records.anomalyCool', { v: Math.abs(a).toFixed(1) })
})

const todayLabel = computed(() => now.toLocaleDateString(localeTag(), { day: 'numeric', month: 'long' }))
function fmtRecDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtMm(v: number): string {
  return `${v.toFixed(v < 10 ? 1 : 0)} mm`
}

const loading = computed(() => !days.value.length)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- „Ist das normal?" — heute vs. Klima-Normalwert 1991–2020 -->
    <section class="glass grid-texture reveal flex items-center gap-6 p-6">
      <div
        class="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl border"
        :style="{ borderColor: anomalyColor, background: `color-mix(in srgb, ${anomalyColor} 16%, transparent)` }"
      >
        <component :is="(anomaly ?? 0) >= 0 ? TrendingUp : TrendingDown" :size="36" :style="{ color: anomalyColor }" />
      </div>
      <div class="min-w-0">
        <div class="label">{{ active.name }} · {{ $t('records.title') }}</div>
        <template v-if="anomaly != null && normals">
          <h1 class="font-display font-semibold tracking-tight" style="font-size: clamp(24px, 4vw, 36px); line-height: 1.08">
            {{ anomalyWord }}
          </h1>
          <div class="text-[13px] text-muted-foreground">
            {{ $t('records.anomalySub', { date: todayLabel, high: fmtTemp(todayHigh), normal: fmtTemp(normals.tmaxNormal, 1) }) }}
          </div>
        </template>
        <Spinner v-else :size="22" class="mt-2" />
      </div>
    </section>

    <!-- Rekorde für den heutigen Kalendertag -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('records.dayTitle', { date: todayLabel }) }}</h2>
      <div class="label mb-4">
        {{ dayRecords ? $t('records.daySub', { from: dayRecords.firstYear, n: dayRecords.nYears }) : $t('records.daySubLoading') }}
      </div>
      <div v-if="loading" class="grid h-[140px] place-items-center"><Spinner /></div>
      <div v-else-if="dayRecords" class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, var(--warm, #ff7847) 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#ff8a5c]"><Flame :size="17" /><span class="label !text-[#ff8a5c]">{{ $t('records.hottest') }}</span></div>
          <div class="readout text-3xl">{{ fmtTemp(dayRecords.hottest.value, 1) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ dayRecords.hottest.year }}</div>
        </div>
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, #4aa8ff 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#6cb8ff]"><Snowflake :size="17" /><span class="label !text-[#6cb8ff]">{{ $t('records.coldest') }}</span></div>
          <div class="readout text-3xl">{{ fmtTemp(dayRecords.coldest.value, 1) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ dayRecords.coldest.year }}</div>
        </div>
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, #6fe0b0 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#6fe0b0]"><CloudRain :size="17" /><span class="label !text-[#6fe0b0]">{{ $t('records.wettest') }}</span></div>
          <div class="readout text-3xl">{{ fmtMm(dayRecords.wettest.value) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ dayRecords.wettest.year }}</div>
        </div>
      </div>
      <p v-else class="text-[13px] text-muted-foreground">{{ $t('records.daySubLoading') }}</p>
    </section>

    <!-- Trockenserie -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('records.streakTitle') }}</h2>
      <div class="label mb-4">{{ $t('records.streakSub', { mm: WET_MM.toFixed(1) }) }}</div>
      <div v-if="loading" class="grid h-[90px] place-items-center"><Spinner /></div>
      <template v-else-if="spell">
        <div class="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div class="flex items-center gap-3">
            <Droplets :size="30" class="text-[#6cb8ff]" />
            <div>
              <div class="readout text-3xl">{{ $t('records.dayCount', { n: spell.current }) }}</div>
              <div class="label">{{ $t('records.sinceRain') }}</div>
            </div>
          </div>
          <div>
            <div class="readout text-2xl text-muted-foreground">{{ $t('records.dayCount', { n: spell.longest }) }}</div>
            <div class="label">{{ $t('records.longestDry') }}<template v-if="spell.longestEnd"> · {{ fmtRecDate(spell.longestEnd) }}</template></div>
          </div>
        </div>
        <p v-if="spell.lastWetDate" class="mt-4 text-[13px] text-muted-foreground">
          {{ $t('records.lastWet', { date: fmtRecDate(spell.lastWetDate) }) }}
        </p>
      </template>
    </section>

    <!-- Allzeit-Extreme -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('records.allTimeTitle') }}</h2>
      <div class="label mb-4">{{ $t('records.allTimeSub', { from: ARCHIVE_FROM }) }}</div>
      <div v-if="loading" class="grid h-[140px] place-items-center"><Spinner /></div>
      <div v-else-if="extremes" class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, var(--warm, #ff7847) 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#ff8a5c]"><Flame :size="17" /><span class="label !text-[#ff8a5c]">{{ $t('records.hottestEver') }}</span></div>
          <div class="readout text-3xl">{{ fmtTemp(extremes.hottest.value, 1) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ fmtRecDate(extremes.hottest.date) }}</div>
        </div>
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, #4aa8ff 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#6cb8ff]"><Snowflake :size="17" /><span class="label !text-[#6cb8ff]">{{ $t('records.coldestEver') }}</span></div>
          <div class="readout text-3xl">{{ fmtTemp(extremes.coldest.value, 1) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ fmtRecDate(extremes.coldest.date) }}</div>
        </div>
        <div class="rounded-xl border border-border p-4" style="background: color-mix(in srgb, #6fe0b0 8%, transparent)">
          <div class="mb-1 flex items-center gap-2 text-[#6fe0b0]"><CloudRain :size="17" /><span class="label !text-[#6fe0b0]">{{ $t('records.wettestEver') }}</span></div>
          <div class="readout text-3xl">{{ fmtMm(extremes.wettest.value) }}</div>
          <div class="mt-0.5 font-mono text-[12px] text-muted-foreground">{{ fmtRecDate(extremes.wettest.date) }}</div>
        </div>
      </div>
    </section>

    <!-- Ehrlichkeits-Fußnote: Quelle & Aktualität offenlegen -->
    <p class="flex items-start gap-2 px-1 text-[12px] text-muted-foreground">
      <Info :size="14" class="mt-0.5 shrink-0" />
      <span>
        {{ $t('records.disclaimer', { from: NORMAL_FROM, to: NORMAL_TO }) }}
        <template v-if="asOf"> {{ $t('records.asOf', { date: fmtRecDate(asOf) }) }}</template>
      </span>
    </p>
  </div>
</template>
