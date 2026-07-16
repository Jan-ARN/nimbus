<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ChartSpline, CalendarClock, Wind, History, Trophy, Footprints, Languages } from 'lucide-vue-next'
import { setLocale, type Locale } from '@/i18n'
import NimbusMark from '@/components/NimbusMark.vue'
import SkyCanvas from '@/components/SkyCanvas.vue'
import WarningsBanner from '@/components/WarningsBanner.vue'
import PlaceSelector from '@/components/PlaceSelector.vue'
import { usePlacesStore } from '@/stores/places'
import { useSkyStore } from '@/stores/sky'
import { fetchConditions } from '@/api/weather'
import { maybeSnapshotToday } from '@/lib/snapshots'
import { currentConditionUtci } from '@/lib/outdoors'

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
  () => cond.data.value,
  (data) => {
    const cur = data?.current as Record<string, number | string> | undefined
    // UTCI aus der Jetzt-Stunde (Strahlung liegt nur stündlich vor) treibt die
    // Hitze-/Kälte-Stimmung des Themes ehrlicher als die reine Lufttemperatur.
    const u = currentConditionUtci(data, active.value, new Date())
    sky.setFromCurrent(cur, u)
  },
  { immediate: true },
)
// Prognose-Samen: 1× pro Ort und Tag alle Modelle mitschreiben (Bestenliste/
// Konvergenz-Wiedergabe wachsen mit der Zeit). Läuft im Hintergrund, deduped.
watch(active, (p) => void maybeSnapshotToday(p), { immediate: true })
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
  { to: '/records', labelKey: 'nav.records', icon: Trophy },
  { to: '/outdoors', labelKey: 'nav.outdoors', icon: Footprints },
]
const LOCALES: Locale[] = ['de', 'en']
</script>

<template>
  <div class="relative min-h-screen">
    <SkyCanvas />

    <header
      class="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"
      style="background: linear-gradient(180deg, color-mix(in srgb, var(--background) 95%, transparent), color-mix(in srgb, var(--background) 82%, transparent))"
    >
      <router-link to="/models" class="group flex min-w-0 items-center gap-3">
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-primary transition-transform group-hover:-translate-y-px"
          style="background: color-mix(in srgb, var(--primary) 14%, transparent); box-shadow: 0 0 22px -4px var(--sky-glow)"
        ><NimbusMark :size="24" /></span>
        <span class="flex min-w-0 flex-col leading-none">
          <span class="font-display text-xl font-semibold tracking-tight">Nimbus</span>
          <span class="label mt-0.5 truncate">{{ t('app.skyOver') }} {{ active.name }}</span>
        </span>
      </router-link>

      <div class="flex items-center gap-2">
        <!-- Desktop-Navigation: Pillen-Leiste. Auf Mobil ersetzt durch die
             fixierte Tab-Leiste am unteren Rand (siehe unten). -->
        <nav class="hidden gap-1 rounded-full border border-border bg-[color-mix(in_srgb,var(--background)_55%,transparent)] p-1 sm:flex">
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
          class="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-[color-mix(in_srgb,var(--background)_55%,transparent)] p-1"
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

    <!-- Mobile-Navigation: fixierte Tab-Leiste am unteren Rand (Daumen-Reichweite).
         Nur < sm sichtbar; Desktop nutzt die Pillen-Leiste im Header. -->
    <nav class="bottom-nav" :aria-label="t('app.langLabel')">
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="bottom-nav-item"
      >
        <component :is="tab.icon" :size="21" />
        <span>{{ t(tab.labelKey) }}</span>
      </router-link>
    </nav>
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
/* Nav-Labels erst ab Breitbild zeigen (6 Tabs + Sprachwahl + Marke passen sonst
   auf Tablet-Breiten nicht nebeneinander). Darunter (bis 640 px greift die untere
   Leiste) bleibt die Kopf-Pille kompakt: nur Icons. */
@media (max-width: 1023px) {
  .nav-label {
    display: none;
  }
}

/* Untere Tab-Leiste (nur Mobil). Fixiert, mit Safe-Area-Puffer für die
   Home-Indicator-Zone auf iOS. Der Hauptinhalt reserviert unten Platz (pb-24). */
.bottom-nav {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 50;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  gap: 2px;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--background) 92%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
/* Nur Mobil: ab sm nutzt der Header die Pillen-Leiste. In den (spezifischeren)
   scoped-Styles hidden statt via sm:hidden-Utility, sonst gewinnt display:flex. */
@media (min-width: 640px) {
  .bottom-nav {
    display: none;
  }
}
.bottom-nav-item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 2px;
  border-radius: 14px;
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}
.bottom-nav-item span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bottom-nav-item.router-link-active {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}
</style>
