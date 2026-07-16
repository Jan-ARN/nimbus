<script setup lang="ts">
// Quantil-Punktdiagramm: die Verteilung der Member-Höchstwerte als K gleich-
// wahrscheinliche Punkte (Wilkinson-Stapelung). Jeder Punkt = 1/K der Läufe —
// man kann sie buchstäblich abzählen. In HCI-Studien (Kay 2016, Fernandes 2018)
// die einzige Unsicherheits-Darstellung mit belegtem Entscheidungs-Vorteil.
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { quantiles } from '@/lib/series'

const props = defineProps<{
  highs: number[] // sortierte Member-Höchstwerte
  median: number
  k?: number // Anzahl Punkte (Standard 20)
}>()

const K = computed(() => props.k ?? 20)
const R = 6 // Punkt-Radius (px)
const GAP = 1.5

const wrap = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrap)
const W = computed(() => Math.round(Math.max(280, width.value || 520)))
const PAD = { l: 10, r: 10, t: 10, b: 30 }
const innerW = computed(() => W.value - PAD.l - PAD.r)

const qs = computed(() => quantiles(props.highs, K.value))
const bounds = computed<[number, number]>(() => {
  const q = qs.value
  if (!q.length) return [0, 1]
  const lo = q[0]
  const hi = q[q.length - 1]
  const pad = Math.max(0.5, (hi - lo) * 0.12)
  return [lo - pad, hi + pad]
})

// Wilkinson-Stapelung: Achse in Fächer der Punktbreite teilen, je Fach stapeln.
const layout = computed(() => {
  const [lo, hi] = bounds.value
  const dotW = 2 * R + GAP
  const nBins = Math.max(1, Math.floor(innerW.value / dotW))
  const binData = (hi - lo) / nBins
  const counts = new Array(nBins).fill(0)
  const dots: { x: number; row: number }[] = []
  for (const v of qs.value) {
    let bin = binData > 0 ? Math.floor((v - lo) / binData) : 0
    bin = Math.max(0, Math.min(nBins - 1, bin))
    const row = counts[bin]++
    dots.push({ x: PAD.l + (bin + 0.5) * dotW, row })
  }
  const maxStack = Math.max(1, ...counts)
  return { dots, maxStack, dotW }
})

const H = computed(() => PAD.t + layout.value.maxStack * (2 * R + GAP) + PAD.b)
function dotY(row: number): number {
  return H.value - PAD.b - R - row * (2 * R + GAP)
}
function xOf(v: number): number {
  const [lo, hi] = bounds.value
  return PAD.l + ((v - lo) / (hi - lo || 1)) * innerW.value
}

// Achsen-Ticks: min, Median, max
const ticks = computed(() => {
  const [lo, hi] = bounds.value
  return [
    { v: qs.value[0], x: xOf(qs.value[0]) },
    { v: props.median, x: xOf(props.median) },
    { v: qs.value[qs.value.length - 1], x: xOf(qs.value[qs.value.length - 1]) },
  ].filter((t) => t.v != null && t.x >= lo && t.x <= hi + 1)
})
</script>

<template>
  <div ref="wrap" class="w-full">
    <svg :viewBox="`0 0 ${W} ${H}`" :height="H" class="block w-full" style="touch-action: pan-y">
      <!-- Median-Linie -->
      <line :x1="xOf(median)" :x2="xOf(median)" :y1="PAD.t - 2" :y2="H - PAD.b + 2" class="med" />
      <!-- Punkte -->
      <circle v-for="(d, i) in layout.dots" :key="i" :cx="d.x" :cy="dotY(d.row)" :r="R - 0.5" class="dot" />
      <!-- Achse -->
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="H - PAD.b + 4" :y2="H - PAD.b + 4" class="axis" />
      <g v-for="(t, i) in ticks" :key="i">
        <text :x="t.x" :y="H - PAD.b + 18" text-anchor="middle" class="tick">{{ Math.round(t.v) }}°</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.dot {
  fill: color-mix(in srgb, var(--primary) 78%, #fff);
}
.med {
  stroke: var(--foreground);
  stroke-width: 2;
  opacity: 0.8;
}
.axis {
  stroke: var(--border);
}
.tick {
  fill: var(--muted-foreground);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}
</style>
