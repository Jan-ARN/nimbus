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
const ACTIVE_KEY = 'wetter-koeln:active'

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

function loadActive(known: Place[]): string {
  const saved = localStorage.getItem(ACTIVE_KEY)
  return saved && known.some((p) => p.id === saved) ? saved : COLOGNE.id
}

export const usePlacesStore = defineStore('places', () => {
  const extra = ref<Place[]>(load())
  // Zuletzt gewählter Ort überlebt den Reload (nur wenn er noch existiert).
  const activeId = ref<string>(loadActive([COLOGNE, ...extra.value]))

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
  watch(activeId, (id) => localStorage.setItem(ACTIVE_KEY, id))

  return { places, extra, active, activeId, addPlace, removePlace, setActive }
})
