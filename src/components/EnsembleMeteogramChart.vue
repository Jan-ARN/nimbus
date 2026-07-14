<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { EnsembleDay } from '@/lib/series'
import { extent, bimodalSplit } from '@/lib/series'
import { localeTag } from '@/i18n'

const props = defineProps<{
  days: EnsembleDay[]
  /** Grenze, ab der die Vorhersage nur noch grobe Tendenz ist (Index) — hier gekappt */
  reliableUntil?: number
}>()

// Meteogramm nur bis zur verlässlichen Grenze zeigen (Standard 14 Tage): 35 Spalten
// wären auf dem Handy unlesbar, und Bimodalität jenseits ~14 T ist Rauschen, kein Signal.
const shown = computed<EnsembleDay[]>(() => {
  const cap = props.reliableUntil != null ? props.reliableUntil : props.days.length
  return props.days.slice(0, Math.max(1, Math.min(cap, props.days.length)))
})

// Pro Tag: teilt sich das Ensemble in zwei Lager? (steuert Farbe + Hinweis)
const splits = computed(() => shown.value.map((d) => bimodalSplit(d.highs)))

const wrap = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrap)
const W = computed(() => Math.round(Math.max(320, width.value || 640)))
const H = computed(() => (W.value < 480 ? 240 : W.value < 768 ? 290 : 320))

const PAD = computed(() => ({ l: 34, r: 12, t: 14, b: 38 }))
const innerW = computed(() => W.value - PAD.value.l - PAD.value.r)
const innerH = computed(() => H.value - PAD.value.t - PAD.value.b)

const bounds = computed<[number, number]>(() => {
  const vals = shown.value.flatMap((d) => [d.min, d.max])
  const [lo, hi] = extent(vals)
  const pad = Math.max(1, (hi - lo) * 0.08)
  return [Math.floor(lo - pad), Math.ceil(hi + pad)]
})

const n = computed(() => shown.value.length)
const colW = computed(() => (n.value ? innerW.value / n.value : innerW.value))
// Spaltenmitte (Boxen sitzen in Spalten-Slots, nicht auf den Rändern).
function cx(i: number): number {
  return PAD.value.l + colW.value * (i + 0.5)
}
function y(v: number): number {
  const [lo, hi] = bounds.value
  return PAD.value.t + innerH.value - ((v - lo) / (hi - lo || 1)) * innerH.value
}

const boxHalf = computed(() => Math.min(16, colW.value * 0.24))
const jitterW = computed(() => Math.min(18, colW.value * 0.34))
// Deterministischer Jitter (kein Math.random → stabiler Render): Hash des Member-Index.
function jitter(k: number): number {
  const r = Math.sin((k + 1) * 12.9898) * 43758.5453
  return (r - Math.floor(r) - 0.5) * 2 // [-1, 1)
}

interface Dot { x: number; y: number; warm: boolean }
const columns = computed(() =>
  shown.value.map((d, i) => {
    const sp = splits.value[i]
    const divider = sp.isBimodal ? (sp.lowMean + sp.highMean) / 2 : null
    const dots: Dot[] = d.highs.map((v, k) => ({
      x: cx(i) + jitter(k) * jitterW.value,
      y: y(v),
      warm: divider != null ? v >= divider : false,
    }))
    return { d, sp, dots, x: cx(i) }
  }),
)

const ticks = computed(() => {
  const [lo, hi] = bounds.value
  const step = Math.max(1, Math.round((hi - lo) / 5))
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
})

const xLabels = computed(() => {
  const stride = Math.max(1, Math.ceil(n.value / Math.max(3, Math.floor(W.value / 64))))
  return shown.value
    .map((d, i) => ({ i, label: new Date(d.date).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' }) }))
    .filter((_, i) => i % stride === 0)
})

// Hover / Touch
const svgRef = ref<SVGSVGElement | null>(null)
const hoverI = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const svg = svgRef.value
  if (!svg || n.value === 0) return
  const rect = svg.getBoundingClientRect()
  const vx = ((e.clientX - rect.left) / rect.width) * W.value
  const i = Math.floor((vx - PAD.value.l) / colW.value)
  hoverI.value = Math.max(0, Math.min(n.value - 1, i))
}
const hover = computed(() => {
  if (hoverI.value == null) return null
  const d = shown.value[hoverI.value]
  const sp = splits.value[hoverI.value]
  return {
    date: new Date(d.date).toLocaleDateString(localeTag(), { weekday: 'short', day: '2-digit', month: '2-digit' }),
    median: d.median,
    p10: d.p10,
    p90: d.p90,
    sp,
  }
})
</script>

<template>
  <div ref="wrap" class="mg-wrap">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      :height="H"
      class="mg"
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

      <!-- Hover-Spalte hervorheben -->
      <rect
        v-if="hoverI != null"
        :x="cx(hoverI) - colW / 2"
        :y="PAD.t"
        :width="colW"
        :height="innerH"
        class="col-hover"
      />

      <g v-for="c in columns" :key="c.d.date">
        <!-- Bimodale Tage: Spalte dezent tönen -->
        <rect
          v-if="c.sp.isBimodal"
          :x="c.x - colW / 2"
          :y="PAD.t"
          :width="colW"
          :height="innerH"
          class="col-split"
        />

        <!-- Whisker p10–p90 -->
        <line :x1="c.x" :x2="c.x" :y1="y(c.d.p90)" :y2="y(c.d.p10)" class="whisker" />
        <line :x1="c.x - 4" :x2="c.x + 4" :y1="y(c.d.p90)" :y2="y(c.d.p90)" class="whisker" />
        <line :x1="c.x - 4" :x2="c.x + 4" :y1="y(c.d.p10)" :y2="y(c.d.p10)" class="whisker" />

        <!-- Box p25–p75 -->
        <rect
          :x="c.x - boxHalf"
          :y="y(c.d.p75)"
          :width="boxHalf * 2"
          :height="Math.max(1, y(c.d.p25) - y(c.d.p75))"
          class="box"
        />
        <!-- Median -->
        <line :x1="c.x - boxHalf" :x2="c.x + boxHalf" :y1="y(c.d.median)" :y2="y(c.d.median)" class="median" />

        <!-- Member-Punktstreu: der eigentliche Star — macht die Verteilung sichtbar -->
        <circle
          v-for="(dot, k) in c.dots"
          :key="k"
          :cx="dot.x"
          :cy="dot.y"
          r="2"
          :class="c.sp.isBimodal ? (dot.warm ? 'dot-warm' : 'dot-cool') : 'dot'"
        />

        <!-- Marker über bimodalen Tagen -->
        <text v-if="c.sp.isBimodal" :x="c.x" :y="PAD.t - 2" text-anchor="middle" class="split-mark">⑂</text>
      </g>

      <g class="xlabels">
        <text v-for="l in xLabels" :key="l.i" :x="cx(l.i)" :y="H - 18" text-anchor="middle">{{ l.label }}</text>
      </g>
    </svg>

    <div v-if="hover" class="chart-tip">
      <div class="tip-dim">{{ hover.date }}</div>
      <div class="tip-mean">≈ {{ hover.median.toFixed(0) }}°</div>
      <div class="tip-dim">{{ hover.p10.toFixed(0) }}° – {{ hover.p90.toFixed(0) }}° {{ $t('band.possible') }}</div>
      <div v-if="hover.sp.isBimodal" class="tip-split">
        {{ $t('longRange.mgSplitTip', { low: hover.sp.lowMean.toFixed(0), high: hover.sp.highMean.toFixed(0) }) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.mg-wrap {
  position: relative;
  width: 100%;
}
.mg {
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
.col-hover {
  fill: color-mix(in srgb, var(--foreground) 6%, transparent);
}
.col-split {
  fill: color-mix(in srgb, var(--warn) 10%, transparent);
}
.whisker {
  stroke: var(--muted-foreground);
  stroke-width: 1.2;
}
.box {
  fill: color-mix(in srgb, var(--primary) 22%, transparent);
  stroke: var(--primary);
  stroke-width: 1.2;
}
.median {
  stroke: #fff;
  stroke-width: 2;
}
.dot {
  fill: color-mix(in srgb, var(--primary) 70%, #fff);
  opacity: 0.4;
}
.dot-cool {
  fill: var(--cool);
  opacity: 0.72;
}
.dot-warm {
  fill: var(--hot);
  opacity: 0.72;
}
.split-mark {
  fill: var(--warn);
  font-size: 13px;
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
  max-width: 220px;
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
.tip-split {
  margin-top: 4px;
  font-size: 11px;
  color: var(--warn);
}
</style>
