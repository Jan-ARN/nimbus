<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { TriangleAlert, ChevronDown, Info } from 'lucide-vue-next'
import { usePlacesStore } from '@/stores/places'
import { fetchWarnings, type WeatherAlert } from '@/api/weather'
import { severityColor, fmtTime } from '@/lib/format'
import { localeTag } from '@/i18n'

const { locale } = useI18n()

// Bright Sky liefert de- und en-Felder; im Englischen bevorzugen wir _en,
// fallen aber auf die jeweils andere Sprache zurück, damit nie eine Warnung leer bleibt.
const en = computed(() => locale.value === 'en')
function pick(a: WeatherAlert, key: 'event' | 'headline' | 'description' | 'instruction') {
  const de = a[`${key}_de`]
  const enVal = a[`${key}_en`]
  return en.value ? enVal || de : de || enVal
}

const places = usePlacesStore()
const { active } = storeToRefs(places)

const query = useQuery({
  queryKey: computed(() => ['warnings', active.value.id]),
  queryFn: () => fetchWarnings(active.value),
  staleTime: 10 * 60_000,
})
const alerts = computed(() => query.data.value ?? [])
const expanded = ref<number | null>(null)

function dayLabel(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(localeTag(), { weekday: 'short', day: '2-digit', month: '2-digit' })
}
</script>

<template>
  <div v-if="alerts.length" class="reveal flex flex-col gap-2">
    <div
      v-for="(a, i) in alerts"
      :key="i"
      class="cursor-pointer overflow-hidden rounded-lg border"
      :style="{ borderColor: severityColor(a.severity), background: `color-mix(in srgb, ${severityColor(a.severity)} 12%, var(--card))` }"
      @click="expanded = expanded === i ? null : i"
    >
      <div class="flex items-center gap-3 px-3.5 py-2.5">
        <TriangleAlert :size="20" :style="{ color: severityColor(a.severity) }" class="shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="text-sm font-bold">{{ pick(a, 'event') || $t('warnings.fallback') }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ pick(a, 'headline') }}</span>
        </div>
        <span class="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          {{ dayLabel(a.onset) }} {{ fmtTime(a.onset) }} – {{ fmtTime(a.expires) }}
        </span>
        <ChevronDown :size="18" class="shrink-0 transition-transform" :class="{ 'rotate-180': expanded === i }" />
      </div>
      <div v-if="expanded === i" class="px-3.5 pb-3 pl-[46px] text-[13px] text-muted-foreground">
        <p v-if="pick(a, 'description')">{{ pick(a, 'description') }}</p>
        <p v-if="pick(a, 'instruction')" class="mt-1.5 flex items-start gap-1.5 text-foreground">
          <Info :size="14" class="mt-0.5 shrink-0" /> {{ pick(a, 'instruction') }}
        </p>
      </div>
    </div>
  </div>
</template>
