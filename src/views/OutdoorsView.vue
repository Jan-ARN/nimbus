<script setup lang="ts">
import { computed } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { Sparkles, Mountain, Shirt, Info } from 'lucide-vue-next'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchConditions, fetchEnsemble } from '@/api/weather'
import { ensembleHourlySpread } from '@/lib/series'
import { buildOutdoors } from '@/lib/outdoors'
import { utciLevel, dryingLevel } from '@/lib/format'
import { localeTag } from '@/i18n'

const { t } = useI18n()
const places = usePlacesStore()
const { active } = storeToRefs(places)

// Geteilter Cache mit App/Hero (['conditions']) und Langfrist (['ensemble']).
const cond = useQuery({
  queryKey: computed(() => ['conditions', active.value.id]),
  queryFn: () => fetchConditions(active.value, 14),
  placeholderData: keepPreviousData,
})
const ens = useQuery({
  queryKey: computed(() => ['ensemble', active.value.id]),
  queryFn: () => fetchEnsemble(active.value, 35),
  placeholderData: keepPreviousData,
})

const data = computed(() => {
  const spread = ens.data.value ? ensembleHourlySpread(ens.data.value) : undefined
  return buildOutdoors(cond.data.value, { lat: active.value.lat, lon: active.value.lon }, new Date(), spread)
})
const loading = computed(() => !cond.data.value?.hourly)

// --- Golden-Window-Schlagzeile ------------------------------------------------
const headline = computed(() => {
  const w = data.value.goldenWindow
  if (!w) return { text: t('outdoors.goldenNone'), score: null as number | null }
  const s = new Date(w.startIso)
  const e = new Date(w.endIso)
  const hh = (d: Date) => d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
  const day = s.toLocaleDateString(localeTag(), { weekday: 'long' })
  // Balken deckt seine Stunde ab → Ende + 1 h.
  const range = `${hh(s)}–${hh(new Date(e.getTime() + 3_600_000))}`
  const key = w.meanScore >= 80 ? 'outdoors.goldenPerfect' : 'outdoors.goldenGood'
  return { text: t(key, { day, range }), score: w.meanScore }
})

// --- Golden-Score-Streifen (nächste 48 h) -------------------------------------
const strip = computed(() => data.value.hours.slice(0, 48))
function goldenColor(score: number): string {
  if (score >= 85) return '#ffd479'
  if (score >= 65) return 'var(--good)'
  if (score >= 40) return 'var(--warn)'
  return 'color-mix(in srgb, var(--muted-foreground) 35%, transparent)'
}
// Tages-Grenzen im Streifen beschriften (Mitternacht bzw. erste Stunde).
const stripDays = computed(() => {
  const out: { i: number; label: string }[] = []
  let last = ''
  strip.value.forEach((h, i) => {
    const day = h.iso.slice(0, 10)
    if (day !== last) {
      out.push({
        i,
        label: new Date(h.iso).toLocaleDateString(localeTag(), { weekday: 'short' }),
      })
      last = day
    }
  })
  return out
})

// --- Gefühlt / UTCI -----------------------------------------------------------
const feels = computed(() => {
  const c = data.value.current
  if (!c || c.utci == null) return null
  return { utci: c.utci, level: utciLevel(c.category), band: c.band }
})

// --- Schneegrenze -------------------------------------------------------------
const snow = computed(() => {
  const fl = data.value.freezingLevelM
  const sl = data.value.snowLineM
  if (fl == null || sl == null) return null
  // Ohne lokale Höhe: ab ~1500 m Schneegrenze fällt es im Flachland als Regen.
  const allRain = sl >= 1500
  return {
    allRain,
    text: allRain
      ? t('outdoors.snowAllRain', { m: Math.round(fl) })
      : t('outdoors.snowLine', { m: Math.round(sl) }),
  }
})

// --- Trocknen -----------------------------------------------------------------
const drying = computed(() => {
  const s = data.value.drying
  if (s == null) return null
  return { score: s, level: dryingLevel(s) }
})
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <!-- Golden-Window-Schlagzeile -->
    <section class="glass grid-texture reveal flex items-center gap-4 p-6 sm:gap-6">
      <div
        class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary sm:h-[76px] sm:w-[76px]"
        style="background: color-mix(in srgb, var(--primary) 14%, transparent)"
      >
        <Sparkles :size="34" class="text-primary" />
      </div>
      <div class="min-w-0">
        <div class="label">{{ active.name }} · {{ $t('outdoors.title') }}</div>
        <template v-if="!loading">
          <h1 class="font-display font-semibold tracking-tight" style="font-size: clamp(22px, 3.6vw, 34px); line-height: 1.1">
            {{ headline.text }}
          </h1>
          <div class="text-[13px] text-muted-foreground">
            {{ $t('outdoors.goldenScoreNow') }}: {{ data.current?.golden ?? '–' }}
          </div>
        </template>
        <Spinner v-else :size="22" class="mt-2" />
      </div>
    </section>

    <!-- Golden-Score-Streifen -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('outdoors.goldenTitle') }}</h2>
      <div class="label mb-4">{{ $t('outdoors.goldenSub') }}</div>
      <div v-if="loading" class="grid h-[130px] place-items-center"><Spinner /></div>
      <template v-else>
        <div class="flex h-[120px] items-end gap-[2px]">
          <div
            v-for="(h, i) in strip"
            :key="i"
            class="flex-1 rounded-t-sm transition-[height]"
            :style="{ height: Math.max(4, h.golden) + '%', background: goldenColor(h.golden) }"
            :title="`${new Date(h.iso).toLocaleString(localeTag(), { weekday: 'short', hour: '2-digit' })} · ${h.golden}`"
          />
        </div>
        <div class="mt-2 flex gap-[2px] text-[10px] text-muted-foreground">
          <div
            v-for="(_, i) in strip"
            :key="i"
            class="flex-1 text-center"
          >
            <span v-if="stripDays.some((d) => d.i === i)" class="capitalize">{{ stripDays.find((d) => d.i === i)?.label }}</span>
          </div>
        </div>
      </template>
    </section>

    <!-- Gefühlt (UTCI) -->
    <section class="glass reveal p-5">
      <h2 class="font-display text-[22px] font-semibold">{{ $t('outdoors.feelsTitle') }}</h2>
      <div class="label mb-3">{{ active.name }} · {{ $t('outdoors.now') }}</div>
      <div v-if="loading" class="grid h-[90px] place-items-center"><Spinner /></div>
      <template v-else-if="feels">
        <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div class="readout" style="font-size: clamp(44px, 9vw, 68px)" :style="{ color: feels.level.color }">
            {{ Math.round(feels.utci) }}°
          </div>
          <div class="pb-2">
            <div class="text-lg font-semibold capitalize" :style="{ color: feels.level.color }">{{ feels.level.label }}</div>
            <div v-if="feels.band" class="text-[13px] text-muted-foreground">
              {{ $t('outdoors.feelsRange', { lo: Math.round(feels.band.lo), hi: Math.round(feels.band.hi) }) }}
            </div>
          </div>
        </div>
        <p class="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <Info :size="14" class="mt-0.5 shrink-0" /><span>{{ $t('outdoors.feelsInfo') }}</span>
        </p>
      </template>
    </section>

    <!-- Entscheidungs-Kacheln -->
    <div class="grid gap-4 sm:grid-cols-2">
      <section v-if="snow" class="glass reveal flex items-start gap-3 p-5">
        <Mountain :size="22" class="mt-0.5 shrink-0 text-primary" />
        <div>
          <div class="label">{{ $t('outdoors.snowTitle') }}</div>
          <p class="mt-1 text-sm">{{ snow.text }}</p>
        </div>
      </section>
      <section v-if="drying" class="glass reveal flex items-start gap-3 p-5">
        <Shirt :size="22" class="mt-0.5 shrink-0" :style="{ color: drying.level.color }" />
        <div class="min-w-0">
          <div class="label">{{ $t('outdoors.dryingTitle') }}</div>
          <div class="mt-1 flex items-baseline gap-2">
            <span class="readout text-2xl" :style="{ color: drying.level.color }">{{ drying.score }}</span>
            <span class="text-sm font-medium capitalize" :style="{ color: drying.level.color }">{{ drying.level.label }}</span>
          </div>
          <div class="label mt-0.5 normal-case tracking-normal">{{ $t('outdoors.dryingSub') }}</div>
        </div>
      </section>
    </div>
  </div>
</template>
