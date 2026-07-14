<script setup lang="ts">
// Hypothetical Outcome Plot (HOPs): statt eines statischen p10–p90-Bandes
// blitzt nacheinander JEDER einzelne Ensemble-Lauf als eigene Linie auf. Das
// Auge integriert das Flackern zu einem Gefühl für die Verteilung — belegt als
// ehrlichere Unsicherheits-Darstellung als starre Fehlerbalken (UW IDL, HOPs).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Play, Pause } from 'lucide-vue-next'
import type { EnsembleDay } from '@/lib/series'
import { extent } from '@/lib/series'
import { localeTag } from '@/i18n'

const props = defineProps<{
  days: EnsembleDay[] // für x-Achse, Median-Referenz, „verlässlich"-Grenze
  members: (number | null)[][] // je Lauf die Tages-Höchstwerte, auf days ausgerichtet
  reliableUntil?: number
}>()

const wrap = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrap)
const W = computed(() => Math.round(Math.max(320, width.value || 640)))
const H = computed(() => (W.value < 480 ? 240 : W.value < 768 ? 290 : 320))
const PAD = { l: 34, r: 12, t: 14, b: 38 }
const innerW = computed(() => W.value - PAD.l - PAD.r)
const innerH = computed(() => H.value - PAD.t - PAD.b)

const n = computed(() => props.days.length)
const bounds = computed<[number, number]>(() => {
  const vals: number[] = []
  for (const m of props.members) for (const v of m) if (v != null) vals.push(v)
  const [lo, hi] = extent(vals)
  const pad = Math.max(1, (hi - lo) * 0.06)
  return [Math.floor(lo - pad), Math.ceil(hi + pad)]
})
function x(i: number): number {
  return PAD.l + (n.value <= 1 ? 0 : (i / (n.value - 1)) * innerW.value)
}
function y(v: number): number {
  const [lo, hi] = bounds.value
  return PAD.t + innerH.value - ((v - lo) / (hi - lo || 1)) * innerH.value
}

// Pfad eines Laufs; bei Lücken (null) wird die Linie unterbrochen.
function pathFor(series: (number | null)[]): string {
  let d = ''
  let pen = false
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  }
  return d
}
const memberPaths = computed(() => props.members.map(pathFor))
const medianPath = computed(() =>
  props.days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.median).toFixed(1)}`).join(''),
)

const ticks = computed(() => {
  const [lo, hi] = bounds.value
  const step = Math.max(1, Math.round((hi - lo) / 5))
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
})
const weekLabels = computed(() => {
  const all = props.days.map((d, i) => ({
    i,
    label: new Date(d.date).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' }),
  }))
  const stride = Math.max(1, Math.ceil(all.length / Math.max(3, Math.floor(W.value / 64))))
  return all.filter((_, i) => i % stride === 0)
})
const reliableX = computed(() =>
  props.reliableUntil != null && props.reliableUntil < n.value ? x(props.reliableUntil) : null,
)

// --- Animation: reihum jeden Lauf hervorheben, mit kurzem, verblassendem Schweif
const reduce =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const playing = ref(!reduce)
const active = ref(0)
const STEP_MS = 460
let raf = 0
let last = 0
function tick(ts: number) {
  if (!last) last = ts
  if (ts - last >= STEP_MS) {
    active.value = (active.value + 1) % Math.max(1, props.members.length)
    last = ts
  }
  raf = requestAnimationFrame(tick)
}
function start() {
  if (raf) return
  last = 0
  raf = requestAnimationFrame(tick)
}
function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}
function toggle() {
  playing.value = !playing.value
  if (playing.value) start()
  else stop()
}
onMounted(() => {
  if (playing.value) start()
})
onBeforeUnmount(stop)

// Deckkraft für den Schweif: aktiver Lauf voll, die davor rasch verblassend.
function trailOpacity(i: number): number {
  if (reduce) return 0.28 // statisch: alle Läufe zugleich sichtbar
  const N = props.members.length || 1
  const back = (active.value - i + N) % N // 0 = aktiv, 1 = davor, …
  if (back === 0) return 1
  if (back <= 3) return 0.42 - back * 0.1
  return 0.06 // ruhender Hintergrund
}
function isActive(i: number): boolean {
  return !reduce && i === active.value
}
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <button
        v-if="!reduce"
        class="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        @click="toggle"
      >
        <component :is="playing ? Pause : Play" :size="13" />
        {{ playing ? $t('longRange.hopsPause') : $t('longRange.hopsPlay') }}
      </button>
      <span class="font-mono text-[12px] text-muted-foreground">
        {{ reduce ? $t('longRange.hopsAll', { n: members.length }) : $t('longRange.hopsRun', { i: active + 1, n: members.length }) }}
      </span>
    </div>

    <div ref="wrap" class="hops-wrap">
      <svg :viewBox="`0 0 ${W} ${H}`" :height="H" class="hops">
        <g class="grid">
          <template v-for="tk in ticks" :key="tk">
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(tk)" :y2="y(tk)" />
            <text :x="PAD.l - 6" :y="y(tk) + 3" text-anchor="end">{{ tk }}°</text>
          </template>
        </g>

        <!-- alle Läufe; aktiver Lauf hervorgehoben, Schweif verblassend -->
        <path
          v-for="(d, i) in memberPaths"
          :key="i"
          :d="d"
          fill="none"
          class="member"
          :class="{ 'member-active': isActive(i) }"
          :style="{ opacity: trailOpacity(i) }"
        />

        <!-- Median als ruhiger Bezug -->
        <path :d="medianPath" class="median" fill="none" />

        <g v-if="reliableX != null">
          <line :x1="reliableX" :x2="reliableX" :y1="PAD.t" :y2="H - PAD.b" class="reliable" />
          <text :x="reliableX + 4" :y="PAD.t + 12" class="reliable-label">{{ $t('band.uncertainFromHere') }}</text>
        </g>

        <g class="xlabels">
          <text v-for="w in weekLabels" :key="w.i" :x="x(w.i)" :y="H - 18" text-anchor="middle">{{ w.label }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.hops-wrap {
  position: relative;
  width: 100%;
}
.hops {
  width: 100%;
  display: block;
}
.grid line {
  stroke: var(--border);
}
.grid text,
.xlabels text {
  fill: var(--muted-foreground);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}
.member {
  stroke: var(--primary);
  stroke-width: 1;
  transition: opacity 0.35s linear;
}
.member-active {
  stroke: #6fe0b0;
  stroke-width: 2.5;
}
.median {
  stroke: var(--muted-foreground);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.7;
}
.reliable {
  stroke: var(--warn);
  opacity: 0.6;
  stroke-dasharray: 3 3;
}
.reliable-label {
  fill: var(--warn);
  font-size: 10px;
}
</style>
