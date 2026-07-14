<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Target, ArrowUp, ArrowDown, Equal, Info } from 'lucide-vue-next'
import MultiLineChart from '@/components/MultiLineChart.vue'
import Spinner from '@/components/ui/Spinner.vue'
import type { LineSeries } from '@/lib/chartTypes'
import { usePlacesStore } from '@/stores/places'
import { fetchArchive, fetchForecastRuns, LEAD_DAYS } from '@/api/weather'
import { dailyExtremeByDate, type NumArr } from '@/lib/series'
import {
  metrics as calcMetrics,
  mse as calcMse,
  skillScore,
  causalBiasCorrect,
  persistencePairs,
  type DatedPair,
} from '@/lib/verify'
import { snapshotProgress } from '@/lib/snapshots'
import { fmtTemp } from '@/lib/format'
import { localeTag } from '@/i18n'

const { t } = useI18n()

const places = usePlacesStore()
const { active } = storeToRefs(places)

// „Samen"-Fortschritt: wie viele Tage Modell-Prognosen schon gebankt sind.
const snapDays = ref(0)
watch(active, (p) => { snapDays.value = snapshotProgress(p.id).days }, { immediate: true })

type Metric = 'max' | 'min'
const metric = ref<Metric>('max') // Höchst- vs. Tiefstwert
const lead = ref<number>(3) // gewählte Vorlaufzeit (Tage)
const windowDays = ref<number>(30) // Zeitfenster
const WINDOWS = [
  { days: 14, key: 'window2w' },
  { days: 30, key: 'window1m' },
  { days: 90, key: 'window3m' },
] as const

const archive = useQuery({
  queryKey: computed(() => ['archive', active.value.id, windowDays.value]),
  queryFn: () => fetchArchive(active.value, windowDays.value),
  placeholderData: keepPreviousData,
})
const runs = useQuery({
  queryKey: computed(() => ['runs', active.value.id, windowDays.value]),
  queryFn: () => fetchForecastRuns(active.value, windowDays.value),
  placeholderData: keepPreviousData,
})

// Beobachtete Höchst-/Tiefstwerte je Tag.
const actual = computed(() => {
  const d = archive.data.value?.daily
  if (!d) return null
  const time = (d.time as string[]) ?? []
  const max = (d.temperature_2m_max as NumArr) ?? []
  const min = (d.temperature_2m_min as NumArr) ?? []
  return time
    .map((date, i) => ({ date, max: max[i] as number | null, min: min[i] as number | null }))
    .filter((r) => r.max != null || r.min != null)
})

// Höchst- UND Tiefstwert-Prognose je Vorlaufzeit und Tag (aus den früheren Läufen).
const forecastByLead = computed(() => {
  const h = runs.data.value?.hourly
  if (!h) return null
  const time = (h.time as string[]) ?? []
  const out = new Map<number, { max: Map<string, number>; min: Map<string, number> }>()
  for (const n of LEAD_DAYS) {
    const vals = (h[`temperature_2m_previous_day${n}`] as NumArr) ?? []
    out.set(n, {
      max: dailyExtremeByDate(time, vals, 'max'),
      min: dailyExtremeByDate(time, vals, 'min'),
    })
  }
  return out
})

interface DayRow {
  date: string
  actualVal: number
  forecast: number | null
  error: number | null // Prognose − Realität (positiv = Prognose war zu warm)
}
const rows = computed<DayRow[]>(() => {
  if (!actual.value || !forecastByLead.value) return []
  const fmap = forecastByLead.value.get(lead.value)?.[metric.value]
  return actual.value
    .map((r) => {
      const av = metric.value === 'max' ? r.max : r.min
      if (av == null) return null
      const forecast = fmap?.get(r.date) ?? null
      return { date: r.date, actualVal: av, forecast, error: forecast != null ? forecast - av : null }
    })
    .filter((r): r is DayRow => r != null)
})

// Kennzahlen der Treffsicherheit: mittlerer absoluter Fehler + systematische
// Abweichung (Bias) über alle Tage mit Prognose.
const skill = computed(() => {
  const errs = rows.value.map((r) => r.error).filter((e): e is number => e != null)
  if (!errs.length) return null
  const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length
  const bias = errs.reduce((s, e) => s + e, 0) / errs.length
  return { mae, bias, n: errs.length }
})
const biasText = computed(() => {
  if (!skill.value) return ''
  const b = skill.value.bias
  if (Math.abs(b) < 0.3) return t('history.biasOnMark')
  return b > 0
    ? t('history.biasWarm', { v: b.toFixed(1) })
    : t('history.biasCool', { v: Math.abs(b).toFixed(1) })
})
const metricWord = computed(() => t(metric.value === 'max' ? 'history.metricHighWord' : 'history.metricLowWord'))

// --- Selbst-Korrektur: den gemessenen Bias ehrlich (kausal) herausrechnen -----
const datedRows = computed<DatedPair[]>(() =>
  rows.value.map((r) => ({ date: r.date, forecast: r.forecast, actual: r.actualVal })),
)
const corrected = computed(() => causalBiasCorrect(datedRows.value, lead.value))

// Roh- vs. korrigierte Güte — verglichen NUR auf den Tagen, die überhaupt
// korrigiert werden konnten (faire, gleiche Stichprobe), plus Skill gg. Persistenz.
const correction = computed(() => {
  const cs = corrected.value.filter((c) => c.corrected != null)
  if (cs.length < 5) return null
  const raw = calcMetrics(cs.map((c) => ({ forecast: c.forecast as number, actual: c.actual })))
  const corr = calcMetrics(cs.map((c) => ({ forecast: c.corrected as number, actual: c.actual })))
  if (!raw || !corr) return null
  const persByDate = new Map(persistencePairs(datedRows.value, lead.value).map((p) => [p.date, p]))
  const persSub = cs.map((c) => persByDate.get(c.date)).filter((p): p is NonNullable<typeof p> => p != null)
  const skill = persSub.length ? skillScore(calcMse(cs.map((c) => ({ forecast: c.corrected as number, actual: c.actual }))), calcMse(persSub)) : NaN
  const pct = raw.mae > 0 ? Math.round((1 - corr.mae / raw.mae) * 100) : 0
  return { rawMae: raw.mae, corrMae: corr.mae, n: cs.length, pct, skill, better: corr.mae < raw.mae - 0.05 }
})

// Overlay: beobachtet vs. Prognose der gewählten Vorlaufzeit (+ bias-korrigiert).
const chart = computed(() => {
  if (!rows.value.length) return null
  const time = rows.value.map((r) => r.date)
  const series: LineSeries[] = [
    { key: 'actual', label: t('history.actual'), color: '#eef2fa', values: rows.value.map((r) => r.actualVal) },
    { key: 'forecast', label: t('history.forecastLead', { n: lead.value }), color: 'var(--primary)', values: rows.value.map((r) => r.forecast) },
  ]
  if (correction.value) {
    const byDate = new Map(corrected.value.map((c) => [c.date, c.corrected]))
    series.push({
      key: 'corrected',
      label: t('history.correctedLine'),
      color: '#6fe0b0',
      values: rows.value.map((r) => byDate.get(r.date) ?? null),
    })
  }
  return { time, series }
})

function errColor(e: number): string {
  const k = Math.max(-6, Math.min(6, e)) / 6
  return e >= 0 ? `rgba(255,120,71,${0.2 + k * 0.6})` : `rgba(74,168,255,${0.2 + -k * 0.6})`
}
function errIcon(e: number) {
  return e >= 0.5 ? ArrowUp : e <= -0.5 ? ArrowDown : Equal
}
function fmtCellDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' })
}

const loading = computed(() => !rows.value.length)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Treffsicherheits-Headline -->
    <section class="glass grid-texture reveal flex items-center gap-6 p-6">
      <div class="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl border border-primary" style="background: color-mix(in srgb, var(--primary) 14%, transparent)">
        <Target :size="36" class="text-primary" />
      </div>
      <div class="min-w-0">
        <div class="label">{{ active.name }} · {{ $t('history.accuracyTitle') }}</div>
        <template v-if="skill">
          <h1 class="font-display font-semibold tracking-tight" style="font-size: clamp(26px, 4vw, 38px); line-height: 1.05">
            {{ $t('history.offBy', { v: skill.mae.toFixed(1) }) }}
          </h1>
          <div class="text-[13px] text-muted-foreground">
            {{ $t('history.leadSummary', { metric: metricWord, n: lead, days: skill.n }) }} · {{ biasText }}
          </div>
        </template>
        <Spinner v-else :size="22" class="mt-2" />
      </div>
    </section>

    <!-- Steuerung: Wert · Vorlauf · Zeitfenster -->
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
      <div class="flex items-center gap-3">
        <span class="label">{{ $t('history.metricLabel') }}</span>
        <div class="flex overflow-hidden rounded-full border border-border">
          <button
            v-for="m in (['max', 'min'] as const)"
            :key="m"
            class="px-4 py-1.5 text-xs font-medium transition-colors"
            :class="metric === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="metric = m"
          >
            {{ $t(m === 'max' ? 'history.metricHigh' : 'history.metricLow') }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="label">{{ $t('history.leadLabel') }}</span>
        <div class="flex overflow-hidden rounded-full border border-border">
          <button
            v-for="n in LEAD_DAYS"
            :key="n"
            class="px-3.5 py-1.5 font-mono text-xs transition-colors"
            :class="lead === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="lead = n"
          >
            {{ $t('history.leadN', { n }) }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="label">{{ $t('history.windowLabel') }}</span>
        <div class="flex overflow-hidden rounded-full border border-border">
          <button
            v-for="w in WINDOWS"
            :key="w.days"
            class="px-3.5 py-1.5 font-mono text-xs transition-colors"
            :class="windowDays === w.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="windowDays = w.days"
          >
            {{ $t('history.' + w.key) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Overlay: beobachtet vs. Prognose -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('history.highsTitle') }}</h2>
      <div class="label mb-3">{{ $t('history.highsSub', { metric: metricWord, n: lead }) }}</div>
      <div class="mb-3 flex flex-wrap gap-4 text-[12px]">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background: #eef2fa" />{{ $t('history.actual') }}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background: var(--primary)" />{{ $t('history.forecastLead', { n: lead }) }}</span>
        <span v-if="correction" class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background: #6fe0b0" />{{ $t('history.correctedLine') }}</span>
      </div>
      <transition name="sk-fade" mode="out-in">
        <MultiLineChart v-if="chart" :time="chart.time" :series="chart.series" unit="°" />
        <div v-else class="grid h-[230px] place-items-center sm:h-[290px] lg:h-[340px]"><Spinner /></div>
      </transition>
    </section>

    <!-- Selbst-Korrektur: den gemessenen Bias herausrechnen (kausal, ehrlich) -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('history.correctedTitle') }}</h2>
      <div class="label mb-3">{{ $t('history.correctedSub') }}</div>
      <div class="mb-5 flex items-start gap-2 rounded-md border border-border bg-[color-mix(in_srgb,var(--cool)_8%,transparent)] px-4 py-3 text-[13px] text-muted-foreground">
        <Info :size="15" class="mt-0.5 shrink-0" />
        <i18n-t keypath="history.correctedInfo" tag="span" scope="global">
          <template #term><strong class="text-foreground">{{ $t('history.correctedInfoTerm') }}</strong></template>
        </i18n-t>
      </div>
      <template v-if="correction">
        <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div class="label">{{ $t('history.forecastLead', { n: lead }) }}</div>
            <div class="readout text-2xl" style="color: var(--primary)">±{{ correction.rawMae.toFixed(1) }}°</div>
          </div>
          <div>
            <div class="label">{{ $t('history.correctedLine') }}</div>
            <div class="readout text-2xl" style="color: #6fe0b0">±{{ correction.corrMae.toFixed(1) }}°</div>
          </div>
          <div v-if="Number.isFinite(correction.skill)" class="text-[13px] text-muted-foreground">
            {{ correction.skill >= 0
              ? $t('history.correctedSkill', { v: Math.round(correction.skill * 100) })
              : $t('history.correctedSkillNeg', { v: Math.abs(Math.round(correction.skill * 100)) }) }}
          </div>
        </div>
        <p class="mt-4 text-[13px] text-muted-foreground">
          {{ correction.better
            ? $t('history.correctedResultBetter', { raw: correction.rawMae.toFixed(1), corr: correction.corrMae.toFixed(1), pct: correction.pct, n: correction.n })
            : $t('history.correctedResultFlat', { raw: correction.rawMae.toFixed(1), corr: correction.corrMae.toFixed(1), n: correction.n }) }}
        </p>
      </template>
      <p v-else class="text-[13px] text-muted-foreground">{{ $t('history.correctedNone') }}</p>
      <p class="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
        {{ snapDays > 0 ? $t('history.snapshotCollecting', { n: snapDays }) : $t('history.snapshotStart') }}
      </p>
    </section>

    <!-- Tag-für-Tag: wärmer/kühler als gedacht -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('history.dailyTitle') }}</h2>
      <div class="label mb-4">{{ $t('history.dailySub', { metric: metricWord, n: lead }) }}</div>
      <div v-if="loading" class="grid h-[200px] place-items-center"><Spinner /></div>
      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-2">
        <div
          v-for="r in rows"
          :key="r.date"
          class="rounded-lg border px-1.5 py-2.5 text-center"
          :style="r.error != null ? { background: errColor(r.error), borderColor: errColor(r.error) } : { borderColor: 'var(--border)' }"
        >
          <div class="font-mono text-[11px] opacity-90">{{ fmtCellDate(r.date) }}</div>
          <div class="readout my-1 text-lg">{{ fmtTemp(r.actualVal) }}</div>
          <template v-if="r.error != null">
            <div class="flex items-center justify-center gap-0.5 font-mono text-[11px]">
              <component :is="errIcon(r.error)" :size="12" />
              {{ r.error >= 0 ? '+' : '' }}{{ r.error.toFixed(1) }}°
            </div>
          </template>
          <div v-else class="font-mono text-[11px] text-muted-foreground">–</div>
        </div>
      </div>
      <p class="mt-4 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        {{ $t('history.legend', { metric: metricWord }) }}
      </p>
    </section>
  </div>
</template>
