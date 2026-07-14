<script setup lang="ts">
import { ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Star, MapPin, Plus, Search, X, LoaderCircle } from 'lucide-vue-next'
import { usePlacesStore } from '@/stores/places'
import { searchPlaces, type GeoResult } from '@/api/weather'

const places = usePlacesStore()

const open = ref(false)
const query = ref('')
const results = ref<GeoResult[]>([])
const loading = ref(false)
const root = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

onClickOutside(root, () => (open.value = false))

watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) {
    results.value = []
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    try {
      results.value = await searchPlaces(q)
    } finally {
      loading.value = false
    }
  }, 300)
})

function pick(r: GeoResult) {
  places.addPlace({ name: r.name, admin: r.admin1, country: r.country, lat: r.latitude, lon: r.longitude })
  open.value = false
  query.value = ''
  results.value = []
}
</script>

<template>
  <div class="flex items-center gap-2">
    <MapPin :size="16" class="ml-0.5 hidden shrink-0 text-muted-foreground sm:block" />

    <!-- Gespeicherte Orte: horizontal scrollbar auf schmalen Screens, statt in
         viele Reihen umzubrechen (kein wachsendes Layout). -->
    <div class="places-scroll -mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 py-0.5">
      <button
        v-for="p in places.places"
        :key="p.id"
        class="group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          p.id === places.activeId
            ? 'border-transparent bg-primary text-primary-foreground shadow'
            : 'border-border text-foreground hover:bg-muted'
        "
        @click="places.setActive(p.id)"
      >
        <component :is="p.fixed ? Star : MapPin" :size="13" />
        {{ p.name }}
        <X
          v-if="!p.fixed"
          :size="14"
          class="-mr-1 rounded-full p-0.5 opacity-50 hover:bg-black/10 hover:opacity-100"
          @click.stop="places.removePlace(p.id)"
        />
      </button>
    </div>

    <div ref="root" class="relative shrink-0">
      <button
        class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        @click="open = !open"
      >
        <Plus :size="14" /> <span class="hidden sm:inline">{{ $t('place.add') }}</span>
      </button>

      <div
        v-if="open"
        class="glass absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-2"
      >
        <div class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
          <Search :size="15" class="shrink-0 text-muted-foreground" />
          <input
            v-model="query"
            autofocus
            :placeholder="$t('place.search')"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <LoaderCircle v-if="loading" :size="15" class="shrink-0 animate-spin text-muted-foreground" />
        </div>
        <ul v-if="results.length" class="mt-1.5 max-h-64 overflow-auto">
          <li v-for="r in results" :key="r.id">
            <button
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
              @click="pick(r)"
            >
              <MapPin :size="14" class="shrink-0 text-muted-foreground" />
              <span class="flex flex-col leading-tight">
                <span>{{ r.name }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ [r.admin1, r.country].filter(Boolean).join(', ') }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <div
          v-else-if="query.length >= 2 && !loading"
          class="px-2.5 py-3 text-xs text-muted-foreground"
        >
          {{ $t('place.empty') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dünne, unaufdringliche Scrollleiste für die Orte-Reihe. */
.places-scroll {
  scrollbar-width: none;
}
.places-scroll::-webkit-scrollbar {
  display: none;
}
</style>
