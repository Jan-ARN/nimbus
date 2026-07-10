import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'

export interface Place {
  id: string
  name: string
  admin?: string
  country?: string
  lat: number
  lon: number
  fixed?: boolean // Köln lässt sich nicht entfernen
}

// Köln ist der wichtigste Ort und immer erster, fixer Eintrag.
export const COLOGNE: Place = {
  id: 'cologne',
  name: 'Köln',
  admin: 'Nordrhein-Westfalen',
  country: 'Deutschland',
  lat: 50.9375,
  lon: 6.9603,
  fixed: true,
}

const STORAGE_KEY = 'wetter-koeln:places'

function load(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Place[]
    return parsed.filter((p) => p.id !== COLOGNE.id)
  } catch {
    return []
  }
}

export const usePlacesStore = defineStore('places', () => {
  const extra = ref<Place[]>(load())
  const activeId = ref<string>(COLOGNE.id)

  const places = computed<Place[]>(() => [COLOGNE, ...extra.value])
  const active = computed<Place>(
    () => places.value.find((p) => p.id === activeId.value) ?? COLOGNE,
  )

  function addPlace(p: Omit<Place, 'id'> & { id?: string }) {
    const id = p.id ?? `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`
    if (places.value.some((x) => x.id === id)) {
      activeId.value = id
      return
    }
    extra.value.push({ ...p, id, fixed: false })
    activeId.value = id
  }

  function removePlace(id: string) {
    if (id === COLOGNE.id) return
    extra.value = extra.value.filter((p) => p.id !== id)
    if (activeId.value === id) activeId.value = COLOGNE.id
  }

  function setActive(id: string) {
    if (places.value.some((p) => p.id === id)) activeId.value = id
  }

  watch(
    extra,
    (val) => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)),
    { deep: true },
  )

  return { places, extra, active, activeId, addPlace, removePlace, setActive }
})
