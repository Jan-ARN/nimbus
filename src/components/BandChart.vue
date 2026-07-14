<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { EnsembleDay } from '@/lib/series'
import { extent } from '@/lib/series'
import { localeTag } from '@/i18n'

const props = defineProps<{
  days: EnsembleDay[]
  /** Referenzwert (Basislinie), z. B. Mittel der ersten Tage */
  baseline?: number
  /** Grenze, ab der die Vorhersage nur noch grobe Tendenz ist (Index) */
  reliableUntil?: number
}>()

// viewBox = gemessene Pixelgröße → keine Verzerrung, scharfer Text auf Mobile.
const wrap = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrap)
const W = computed(() => Math.round(Math.max(320, width.value || 640)))
const H = computed(() => (W.value < 480 ? 240 : W.value < 768 ? 290 : 320))

const PAD = computed(() => ({ l: 34, r: 12, t: 14, b: 38 }))
const innerW = computed(() => W.value - PAD.value.l - PAD.value.r)
const innerH = computed(() => H.value - PAD.value.t - PAD.value.b)

const bounds = computed<[number, number]>(() => {
  const vals = props.days.flatMap((d) => [d.p10, d.p90])
  if (props.baseline != null) vals.push(props.baseline)
  const [lo, hi] = extent(vals)
  const pad = Math.max(1, (hi - lo) * 0.08)
  return [Math.floor(lo - pad), Math.ceil(hi + pad)]
})

const n = computed(() => props.days.length)
function x(i: number): number {
  return PAD.value.l + (n.value <= 1 ? 0 : (i / (n.value - 1)) * innerW.value)
}
function y(v: number): number {
  const [lo, hi] = bounds.value
  return PAD.value.t + innerH.value - ((v - lo) / (hi - lo || 1)) * innerH.value
}

const bandPath = computed(() => {
  const top = props.days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.p90).toFixed(1)}`)
  const bottom = props.days
    .map((d, i) => `L${x(i).toFixed(1)},${y(d.p10).toFixed(1)}`)
    .reverse()
  return top.join('') + bottom.join('') + 'Z'
})
const meanPath = computed(() =>
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

// Hover / Touch
const svgRef = ref<SVGSVGElement | null>(null)
const hoverI = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const svg = svgRef.value
  if (!svg || n.value === 0) return
  const rect = svg.getBoundingClientRect()
  const vx = ((e.clientX - rect.left) / rect.width) * W.value
  const i = Math.round(((vx - PAD.value.l) / innerW.value) * (n.value - 1))
  hoverI.value = Math.max(0, Math.min(n.value - 1, i))
}
const hover = computed(() => {
  if (hoverI.value == null) return null
  const d = props.days[hoverI.value]
  return {
    date: new Date(d.date).toLocaleDateString(localeTag(), { weekday: 'short', day: '2-digit', month: '2-digit' }),
    mean: d.median,
    p10: d.p10,
    p90: d.p90,
  }
})
</script>

<template>
  <div ref="wrap" class="band-wrap">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      :height="H"
      class="band"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="hoverI = null"
    >
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" />
          <text :x="PAD.l - 6" :y="y(t) + 3" text-anchor="end">{{ t }}°</text>
        </template>
      </g>

      <!-- Basislinie (Referenz "jetzt") -->
      <line
        v-if="baseline != null"
        :x1="PAD.l"
        :x2="W - PAD.r"
        :y1="y(baseline)"
        :y2="y(baseline)"
        class="baseline"
      />

      <!-- Unsicherheitsband -->
      <path :d="bandPath" class="band-fill" />
      <!-- Mittel -->
      <path :d="meanPath" class="band-mean" fill="none" />

      <!-- Grenze "verlässlich" -->
      <g v-if="reliableX != null">
        <line :x1="reliableX" :x2="reliableX" :y1="PAD.t" :y2="H - PAD.b" class="reliable" />
        <text :x="reliableX + 4" :y="PAD.t + 12" class="reliable-label">{{ $t('band.uncertainFromHere') }}</text>
      </g>

      <g class="xlabels">
        <text v-for="w in weekLabels" :key="w.i" :x="x(w.i)" :y="H - 18" text-anchor="middle">
          {{ w.label }}
        </text>
      </g>

      <g v-if="hoverI != null">
        <line :x1="x(hoverI)" :x2="x(hoverI)" :y1="PAD.t" :y2="H - PAD.b" class="crosshair" />
        <circle :cx="x(hoverI)" :cy="y(days[hoverI].median)" r="3.5" fill="#fff" />
      </g>
    </svg>

    <div v-if="hover" class="chart-tip">
      <div class="tip-dim">{{ hover.date }}</div>
      <div class="tip-mean">≈ {{ hover.mean.toFixed(0) }}°</div>
      <div class="tip-dim">{{ hover.p10.toFixed(0) }}° – {{ hover.p90.toFixed(0) }}° {{ $t('band.possible') }}</div>
    </div>
  </div>
</template>

<style scoped>
.band-wrap {
  position: relative;
  width: 100%;
}
.band {
  width: 100%;
  display: block;
  touch-action: pan-y;
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
.baseline {
  stroke: var(--muted-foreground);
  stroke-dasharray: 5 4;
}
.band-fill {
  fill: color-mix(in srgb, var(--primary) 20%, transparent);
  stroke: none;
}
.band-mean {
  stroke: var(--primary);
  stroke-width: 2.5;
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
.crosshair {
  stroke: var(--muted-foreground);
}
.chart-tip {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 8px 12px;
  pointer-events: none;
  backdrop-filter: blur(10px);
}
.tip-mean {
  font-size: 20px;
  font-weight: 700;
}
.tip-dim {
  font-size: 11px;
  color: var(--muted-foreground);
  font-family: 'JetBrains Mono', monospace;
}
</style>
