<script setup lang="ts">
// „Haus-Prognose": schließt den Kreis History → Models. Mischt die Modelle nach
// ihrer zuletzt gemessenen Treffsicherheit an DIESEM Ort und zeigt die Mischung
// mit der verdienten Konfidenz.
import { computed } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { Home } from 'lucide-vue-next'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchModelRuns, fetchArchive, fetchMultiModelForecast } from '@/api/weather'
import { DEFAULT_MODEL_IDS, modelById } from '@/models'
import { extractDaily } from '@/lib/series'
import { computeHouseForecast } from '@/lib/houseForecast'
import { MIN_SAMPLES } from '@/lib/wx'
import { fmtTemp, fmtWeekday } from '@/lib/format'

const LEAD = 3
const places = usePlacesStore()
const { active } = storeToRefs(places)

const runs = useQuery({
  queryKey: computed(() => ['modelRuns', active.value.id]),
  queryFn: () => fetchModelRuns(active.value, DEFAULT_MODEL_IDS, LEAD, 28),
  placeholderData: keepPreviousData,
})
const archive = useQuery({
  queryKey: computed(() => ['archive', active.value.id, 28]),
  queryFn: () => fetchArchive(active.value, 28),
  placeholderData: keepPreviousData,
})
const current = useQuery({
  queryKey: computed(() => ['houseForecast', active.value.id]),
  queryFn: () => fetchMultiModelForecast(active.value, DEFAULT_MODEL_IDS, 7),
  placeholderData: keepPreviousData,
})

const house = computed(() => {
  const daily = current.data.value ? extractDaily(current.data.value, DEFAULT_MODEL_IDS) : null
  return computeHouseForecast(runs.data.value, archive.data.value, daily, DEFAULT_MODEL_IDS, LEAD)
})
const ready = computed(() => (house.value?.sampleDays ?? 0) >= MIN_SAMPLES)

const leanName = computed(() => (house.value?.lean ? modelById(house.value.lean.modelId)?.short : null))
const leanColor = computed(() =>
  house.value?.lean ? (modelById(house.value.lean.modelId)?.color ?? 'var(--primary)') : 'var(--primary)',
)
const leanPct = computed(() => Math.round((house.value?.lean?.weight ?? 0) * 100))
const worst = computed(() => {
  const w = house.value?.worstBias
  if (!w || Math.abs(w.bias) < 0.5) return null
  return { name: modelById(w.modelId)?.short, warm: w.bias > 0, v: Math.abs(w.bias).toFixed(1) }
})

interface WeightRow { id: string; short: string; color: string; weight: number; mae: number; n: number }
const rows = computed<WeightRow[]>(() =>
  (house.value?.weights ?? []).map((w) => ({
    id: w.modelId,
    short: modelById(w.modelId)?.short ?? w.modelId,
    color: modelById(w.modelId)?.color ?? 'var(--primary)',
    weight: w.weight,
    mae: w.mae,
    n: w.n,
  })),
)
const outlook = computed(() => (house.value?.blended ?? []).slice(0, 5).filter((d) => d.value != null))
</script>

<template>
  <section class="glass reveal p-5">
    <div class="mb-3 flex items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary text-primary" style="background: color-mix(in srgb, var(--primary) 14%, transparent)"><Home :size="20" /></span>
      <div>
        <h2 class="font-display text-[22px] font-semibold leading-none">{{ $t('house.title') }}</h2>
        <div class="label mt-1">{{ $t('house.sub') }}</div>
      </div>
    </div>

    <div v-if="!house" class="grid h-[120px] place-items-center"><Spinner /></div>
    <template v-else>
      <!-- Schlagzeile -->
      <p class="text-[15px]">
        <template v-if="ready && leanName">
          <i18n-t keypath="house.leans" tag="span" scope="global">
            <template #model><strong :style="{ color: leanColor }">{{ leanName }}</strong></template>
            <template #pct>{{ leanPct }}</template>
          </i18n-t>
          <template v-if="worst">
            · {{ worst.warm ? $t('house.biasWarm', { model: worst.name, v: worst.v }) : $t('house.biasCool', { model: worst.name, v: worst.v }) }}
          </template>
        </template>
        <span v-else class="text-muted-foreground">{{ $t('house.learning', { n: house.sampleDays }) }}</span>
      </p>

      <!-- Gewichts-Balken -->
      <div class="mt-4 flex flex-col gap-2">
        <div v-for="r in rows" :key="r.id" class="grid grid-cols-[54px_1fr_auto] items-center gap-3">
          <span class="text-xs font-bold" :style="{ color: r.color }">{{ r.short }}</span>
          <div class="h-2.5 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full transition-[width]" :style="{ width: Math.round(r.weight * 100) + '%', background: r.color }" />
          </div>
          <span class="font-mono text-[11px] text-muted-foreground">
            {{ Math.round(r.weight * 100) }}% <template v-if="Number.isFinite(r.mae)">· ±{{ r.mae.toFixed(1) }}°</template>
          </span>
        </div>
      </div>

      <!-- Gemischte Aussicht -->
      <div v-if="outlook.length" class="mt-5">
        <div class="label mb-2">{{ $t('house.blendLabel') }}</div>
        <div class="flex flex-wrap gap-2">
          <div v-for="d in outlook" :key="d.date" class="rounded-lg border border-border px-3 py-2 text-center">
            <div class="label normal-case tracking-normal">{{ fmtWeekday(d.date) }}</div>
            <div class="readout mt-0.5 text-lg">{{ fmtTemp(d.value) }}</div>
          </div>
        </div>
      </div>

      <p class="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
        {{ $t('house.footnote', { n: house.sampleDays, lead: LEAD }) }}
      </p>
    </template>
  </section>
</template>
