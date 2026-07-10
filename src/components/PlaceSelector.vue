<script setup lang="ts">
import { ref, watch } from 'vue'
import { Star, MapPin, Plus, Search, X } from 'lucide-vue-next'
import { usePlacesStore } from '@/stores/places'
import { searchPlaces, type GeoResult } from '@/api/weather'

const places = usePlacesStore()

const open = ref(false)
const query = ref('')
const results = ref<GeoResult[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

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
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="p in places.places"
      :key="p.id"
      class="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all"
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
        :size="13"
        class="opacity-50 hover:opacity-100"
        @click.stop="places.removePlace(p.id)"
      />
    </button>

    <div class="relative">
      <button
        class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
        @click="open = !open"
      >
        <Plus :size="14" /> {{ $t('place.add') }}
      </button>

      <div
        v-if="open"
        class="glass absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden p-2"
      >
        <div class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
          <Search :size="15" class="text-muted-foreground" />
          <input
            v-model="query"
            autofocus
            :placeholder="$t('place.search')"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul v-if="results.length" class="mt-1.5 max-h-64 overflow-auto">
          <li v-for="r in results" :key="r.id">
            <button
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
              @click="pick(r)"
            >
              <MapPin :size="14" class="text-muted-foreground" />
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
