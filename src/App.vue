<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ChartSpline, CalendarClock, Wind, History, Languages } from 'lucide-vue-next'
import { setLocale, type Locale } from '@/i18n'
import NimbusMark from '@/components/NimbusMark.vue'
import SkyCanvas from '@/components/SkyCanvas.vue'
import WarningsBanner from '@/components/WarningsBanner.vue'
import PlaceSelector from '@/components/PlaceSelector.vue'
import { usePlacesStore } from '@/stores/places'
import { useSkyStore } from '@/stores/sky'
import { fetchConditions } from '@/api/weather'

// Globaler Himmel: das ganze App-Theme folgt der aktuellen Lage des aktiven Orts,
// auf jeder Seite (nicht nur wo die Conditions-Hero steht). Gleicher Query-Key
// wie in der Hero → geteilter Cache, keine Doppel-Requests.
const places = usePlacesStore()
const sky = useSkyStore()
const { active } = storeToRefs(places)
const cond = useQuery({
  queryKey: computed(() => ['conditions', active.value.id]),
  queryFn: () => fetchConditions(active.value, 14),
  placeholderData: keepPreviousData,
})
watch(
  () => cond.data.value?.current,
  (cur) => sky.setFromCurrent(cur as Record<string, number | string> | undefined),
  { immediate: true },
)
const { t, locale } = useI18n()
// Dokumenttitel folgt der aktiven Sprache.
watchEffect(() => {
  document.title = t('app.title')
})
const tabs = [
  { to: '/models', labelKey: 'nav.models', icon: ChartSpline },
  { to: '/outlook', labelKey: 'nav.longRange', icon: CalendarClock },
  { to: '/air', labelKey: 'nav.air', icon: Wind },
  { to: '/history', labelKey: 'nav.history', icon: History },
]
const LOCALES: Locale[] = ['de', 'en']
</script>

<template>
  <div class="relative min-h-screen">
    <SkyCanvas />

    <header
      class="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-border px-5 py-3"
      style="background: linear-gradient(180deg, color-mix(in srgb, var(--background) 95%, transparent), color-mix(in srgb, var(--background) 82%, transparent))"
    >
      <router-link to="/models" class="group flex items-center gap-3">
        <span
          class="grid h-10 w-10 place-items-center rounded-xl border border-border text-primary transition-transform group-hover:-translate-y-px"
          style="background: color-mix(in srgb, var(--primary) 14%, transparent); box-shadow: 0 0 22px -4px var(--sky-glow)"
        ><NimbusMark :size="24" /></span>
        <span class="flex flex-col leading-none">
          <span class="font-display text-xl font-semibold tracking-tight">Nimbus</span>
          <span class="label mt-0.5 max-w-[42vw] truncate sm:max-w-none">{{ t('app.skyOver') }} {{ active.name }}</span>
        </span>
      </router-link>

      <div class="flex items-center gap-2">
        <nav class="flex gap-1 rounded-full border border-border bg-[color-mix(in_srgb,var(--background)_55%,transparent)] p-1">
          <router-link
            v-for="tab in tabs"
            :key="tab.to"
            :to="tab.to"
            class="nav-item flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <component :is="tab.icon" :size="17" />
            <span class="nav-label">{{ t(tab.labelKey) }}</span>
          </router-link>
        </nav>

        <!-- Sprachumschalter: Wahl landet in localStorage (siehe setLocale) -->
        <div
          class="flex items-center gap-0.5 rounded-full border border-border bg-[color-mix(in_srgb,var(--background)_55%,transparent)] p-1"
          role="group"
          :aria-label="t('app.langLabel')"
        >
          <Languages :size="15" class="ml-1.5 mr-0.5 text-muted-foreground" />
          <button
            v-for="l in LOCALES"
            :key="l"
            class="rounded-full px-2.5 py-1.5 text-xs font-semibold uppercase transition-colors"
            :class="locale === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="locale === l"
            @click="setLocale(l)"
          >
            {{ l }}
          </button>
        </div>
      </div>
    </header>

    <main class="relative z-10">
      <div class="mx-auto max-w-[1180px] px-4 pb-24 pt-5 sm:px-5 sm:pt-6">
        <!-- Ort global & ganz oben: erst wählen, dann sehen (auf jeder Seite gleich).
             relative z-30: das Such-Dropdown muss über die nachfolgenden Karten
             (Warnung/Hero) gezeichnet werden — backdrop-filter kapselt sonst z-index. -->
        <div class="glass relative z-30 mb-4 p-2.5 sm:p-3">
          <PlaceSelector />
        </div>
        <WarningsBanner class="mb-4" />
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style scoped>
.nav-item.router-link-active {
  color: var(--primary-foreground);
  background: var(--primary);
  box-shadow: 0 6px 20px -8px var(--primary);
}
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 640px) {
  .nav-label {
    display: none;
  }
}
</style>
