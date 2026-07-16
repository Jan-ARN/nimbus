<script setup lang="ts">
// Wetterfühligkeit: der stärkste 24-h-Druckabfall der nächsten 2 Tage, plus
// Modell-Übereinstimmung (der Nimbus-Twist). Bewusst NICHT-medizinisch formuliert.
import { computed, ref, watch } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { Gauge } from 'lucide-vue-next'
import Spinner from '@/components/ui/Spinner.vue'
import { usePlacesStore } from '@/stores/places'
import { fetchMultiModelForecast } from '@/api/weather'
import { DEFAULT_MODEL_IDS } from '@/models'
import { extractHourly, nearestHourIndex } from '@/lib/series'
import { maxRollingDrop } from '@/lib/wx'

const places = usePlacesStore()
const { active } = storeToRefs(places)

// Empfindlichkeitsschwelle (hPa/24 h), im localStorage gemerkt (wie die Sprache).
const KEY = 'nimbus-baro-sensitivity'
const sensitivity = ref(Number(localStorage.getItem(KEY)) || 6)
watch(sensitivity, (v) => localStorage.setItem(KEY, String(v)))

const q = useQuery({
  queryKey: computed(() => ['baro', active.value.id]),
  queryFn: () => fetchMultiModelForecast(active.value, DEFAULT_MODEL_IDS, 3),
  placeholderData: keepPreviousData,
})

const analysis = computed(() => {
  const data = q.data.value
  if (!data) return null
  const hb = extractHourly(data, DEFAULT_MODEL_IDS)
  if (!hb.time.length) return null
  const now = nearestHourIndex(hb.time)
  const drops = hb.models
    .map((m) => maxRollingDrop(m.pressure.slice(now, now + 48), 24))
    .filter((d) => Number.isFinite(d))
  if (!drops.length) return null
  const sorted = [...drops].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const range = sorted[sorted.length - 1] - sorted[0]
  const agree = range < 3 ? 'agree' : range < 6 ? 'spread' : 'uncertain'
  return { median, range, agree, atRisk: median >= sensitivity.value, n: drops.length }
})

const color = computed(() => {
  const a = analysis.value
  if (!a) return 'var(--muted-foreground)'
  return a.atRisk ? (a.agree === 'agree' ? 'var(--warn)' : 'var(--muted-foreground)') : 'var(--good)'
})
</script>

<template>
  <section class="glass reveal p-5">
    <h2 class="font-display text-[22px] font-semibold">{{ $t('baro.title') }}</h2>
    <div class="label mb-4">{{ $t('baro.sub') }}</div>

    <div v-if="!analysis" class="grid h-[90px] place-items-center"><Spinner /></div>
    <template v-else>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div class="flex items-center gap-3">
          <Gauge :size="30" :style="{ color }" />
          <div>
            <div class="readout text-3xl" :style="{ color }">−{{ analysis.median.toFixed(0) }} <span class="text-lg">hPa</span></div>
            <div class="label">{{ $t('baro.over24h') }}</div>
          </div>
        </div>
        <div class="pb-1 text-[13px]" :style="{ color }">
          {{ analysis.atRisk ? $t('baro.dropFlag') : $t('baro.steady') }}
          <span class="text-muted-foreground">· {{ $t('baro.' + analysis.agree) }}</span>
        </div>
      </div>

      <!-- Empfindlichkeit -->
      <div class="mt-5 flex items-center gap-3">
        <span class="label shrink-0">{{ $t('baro.sensitivity') }}</span>
        <input
          v-model.number="sensitivity"
          type="range"
          min="3"
          max="12"
          step="1"
          class="baro-range flex-1"
          :aria-label="$t('baro.sensitivity')"
        />
        <span class="readout w-16 text-right text-sm">{{ sensitivity }} hPa</span>
      </div>

      <p v-if="analysis.atRisk" class="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
        {{ $t('baro.note') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.baro-range {
  appearance: none;
  height: 4px;
  border-radius: 4px;
  background: var(--border);
  outline: none;
}
.baro-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 20%, transparent);
}
.baro-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}
</style>
