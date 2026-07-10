<script setup lang="ts">
import { computed, ref } from 'vue'
import { extent, type NumArr } from '@/lib/series'
import type { LineSeries } from '@/lib/chartTypes'

const props = defineProps<{
  time: string[]
  series: LineSeries[]
  unit?: string
  /** ISO-Zeit, an der eine "Jetzt"-Linie gezeichnet wird */
  nowIso?: string
}>()

const W = 900
const H = 340
const PAD = { l: 44, r: 12, t: 16, b: 28 }
const innerW = W - PAD.l - PAD.r
const innerH = H - PAD.t - PAD.b

const bounds = computed<[number, number]>(() => {
  const all: NumArr = []
  for (const s of props.series) all.push(...s.values)
  const [lo, hi] = extent(all)
  const pad = Math.max(1, (hi - lo) * 0.08)
  return [Math.floor(lo - pad), Math.ceil(hi + pad)]
})

const n = computed(() => props.time.length)
function x(i: number): number {
  return PAD.l + (n.value <= 1 ? 0 : (i / (n.value - 1)) * innerW)
}
function y(v: number): number {
  const [lo, hi] = bounds.value
  return PAD.t + innerH - ((v - lo) / (hi - lo || 1)) * innerH
}

function pathFor(values: NumArr): string {
  let d = ''
  let pen = false
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null || Number.isNaN(v)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    pen = true
  }
  return d
}

// Y-Ticks
const ticks = computed(() => {
  const [lo, hi] = bounds.value
  const step = niceStep((hi - lo) / 5)
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
})
function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / pow
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * pow
}

// X-Labels: nur bei Tagesbeginn beschriften
const dayLabels = computed(() => {
  const out: { i: number; label: string }[] = []
  let last = ''
  for (let i = 0; i < props.time.length; i++) {
    const day = props.time[i].slice(0, 10)
    if (day !== last) {
      out.push({
        i,
        label: new Date(props.time[i]).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
        }),
      })
      last = day
    }
  }
  return out
})

const nowX = computed(() => {
  if (!props.nowIso) return null
  const t = new Date(props.nowIso).getTime()
  const t0 = new Date(props.time[0]).getTime()
  const t1 = new Date(props.time[props.time.length - 1]).getTime()
  if (!(t >= t0 && t <= t1)) return null
  return PAD.l + ((t - t0) / (t1 - t0)) * innerW
})

// --- Hover ---
const svgRef = ref<SVGSVGElement | null>(null)
const hoverI = ref<number | null>(null)

function onMove(e: MouseEvent) {
  const svg = svgRef.value
  if (!svg || n.value === 0) return
  const rect = svg.getBoundingClientRect()
  const vx = ((e.clientX - rect.left) / rect.width) * W
  const frac = (vx - PAD.l) / innerW
  const i = Math.round(frac * (n.value - 1))
  hoverI.value = Math.max(0, Math.min(n.value - 1, i))
}
function onLeave() {
  hoverI.value = null
}

const hoverReadout = computed(() => {
  if (hoverI.value == null) return null
  const i = hoverI.value
  return {
    time: new Date(props.time[i]).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
    }),
    rows: props.series
      .map((s) => ({ label: s.label, color: s.color, v: s.values[i] }))
      .filter((r) => r.v != null),
  }
})
</script>

<template>
  <div class="chart-wrap">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      class="chart"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <!-- Gitter + Y-Achse -->
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" />
          <text :x="PAD.l - 6" :y="y(t) + 3" text-anchor="end">{{ t }}{{ unit }}</text>
        </template>
      </g>

      <!-- X-Labels -->
      <g class="xlabels">
        <text v-for="d in dayLabels" :key="d.i" :x="x(d.i)" :y="H - 8" text-anchor="middle">
          {{ d.label }}
        </text>
      </g>

      <!-- Jetzt-Linie -->
      <line
        v-if="nowX != null"
        :x1="nowX"
        :x2="nowX"
        :y1="PAD.t"
        :y2="H - PAD.b"
        class="nowline"
      />

      <!-- Serien -->
      <path
        v-for="s in series"
        :key="s.key"
        :d="pathFor(s.values)"
        fill="none"
        :stroke="s.color"
        stroke-width="2"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />

      <!-- Hover-Crosshair -->
      <g v-if="hoverI != null">
        <line :x1="x(hoverI)" :x2="x(hoverI)" :y1="PAD.t" :y2="H - PAD.b" class="crosshair" />
        <template v-for="s in series" :key="s.key">
          <circle
            v-if="s.values[hoverI] != null"
            :cx="x(hoverI)"
            :cy="y(s.values[hoverI] as number)"
            r="3.5"
            :fill="s.color"
          />
        </template>
      </g>
    </svg>

    <!-- Readout -->
    <div v-if="hoverReadout" class="chart-tip">
      <div class="tip-time">{{ hoverReadout.time }}</div>
      <div v-for="r in hoverReadout.rows" :key="r.label" class="readout-row">
        <span class="dot" :style="{ background: r.color }" />
        <span class="flex-grow-1">{{ r.label }}</span>
        <strong>{{ (r.v as number).toFixed(1) }}{{ unit }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}
.chart {
  width: 100%;
  height: 340px;
  display: block;
}
.grid line {
  stroke: var(--border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.grid text,
.xlabels text {
  fill: var(--muted-foreground);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}
.nowline {
  stroke: var(--warn);
  opacity: 0.7;
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}
.crosshair {
  stroke: var(--muted-foreground);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.chart-tip {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 170px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  pointer-events: none;
  backdrop-filter: blur(10px);
}
.tip-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted-foreground);
  margin-bottom: 6px;
}
.readout-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 1px 0;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
</style>
