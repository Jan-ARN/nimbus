<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuery } from '@tanstack/vue-query'
import { useSkyStore } from '@/stores/sky'
import { usePlacesStore } from '@/stores/places'
import { fetchEnsemble } from '@/api/weather'

const sky = useSkyStore()
const places = usePlacesStore()
const { kind } = storeToRefs(sky)
const { active } = storeToRefs(places)

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// --- Ensemble-Feld: die echten GFS-Läufe SIND der Hintergrund -----------------
// 7 Tage reichen für die Form; vue-query cached pro Ort.
const ens = useQuery({
  queryKey: computed(() => ['ensemble-bg', active.value.id]),
  queryFn: () => fetchEnsemble(active.value, 7),
  staleTime: 30 * 60_000,
})

// Member-Reihen (temperature_2m_memberNN + Kontrolllauf temperature_2m) → Zahlen-Arrays.
const members = computed<number[][]>(() => {
  const h = ens.data.value?.hourly
  if (!h) return []
  const keys = Object.keys(h).filter((k) => /^temperature_2m(_member\d+)?$/.test(k))
  const out: number[][] = []
  for (const k of keys) {
    const arr = h[k]
    if (Array.isArray(arr)) out.push(arr.map((v) => (typeof v === 'number' ? v : NaN)))
  }
  return out
})

// Fallback-Feld, solange keine Daten da sind: plausibles Bündel mit wachsender Streuung.
function synthMembers(): number[][] {
  const N = 26
  const hours = 24 * 7
  const base = sky.temp ?? 18
  const out: number[][] = []
  for (let m = 0; m < N; m++) {
    const seedA = Math.sin(m * 12.9898) * 43758.5453
    const off = (seedA - Math.floor(seedA)) * 2 - 1
    const row: number[] = []
    for (let i = 0; i < hours; i++) {
      const day = Math.sin((i / 24) * Math.PI * 2 - 1.4) * 5 // Tagesgang
      const spread = (i / hours) * 6 * off // Unsicherheit wächst
      row.push(base + day + spread)
    }
    out.push(row)
  }
  return out
}

const field = computed<number[][]>(() => (members.value.length ? members.value : synthMembers()))

// --- Farbe aus dem Theme ziehen (--primary) ----------------------------------
const strokeRGB = ref('110,168,255')
function readColor() {
  if (typeof document === 'undefined') return
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  if (m) strokeRGB.value = `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

// --- Zusätzliche Stimmung: Wolken / Partikel je Wetterlage --------------------
const showClouds = computed(() => ['clouds', 'fog', 'rain', 'storm', 'snow'].includes(kind.value))
const isStorm = computed(() => kind.value === 'storm')

// --- Canvas: Ensemble-Feld + Partikel -----------------------------------------
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null
let W = 0
let H = 0
let dpr = 1
let particles: { x: number; y: number; v: number; s: number; a: number }[] = []
let stars: { x: number; y: number; r: number; p: number }[] = []

function resize() {
  const c = canvasRef.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.offsetWidth
  H = c.offsetHeight
  c.width = Math.floor(W * dpr)
  c.height = Math.floor(H * dpr)
  ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed()
}

function seed() {
  const mode = kind.value
  particles = []
  stars = []
  if (mode === 'clear-night') {
    const n = Math.floor((W * H) / 7000)
    for (let i = 0; i < n; i++)
      stars.push({ x: Math.random() * W, y: Math.random() * H * 0.75, r: Math.random() * 1.4 + 0.2, p: Math.random() * Math.PI * 2 })
  }
  if (mode === 'rain' || mode === 'storm') {
    const n = Math.floor(W / 3)
    for (let i = 0; i < n; i++)
      particles.push({ x: Math.random() * W, y: Math.random() * H, v: 8 + Math.random() * 8, s: 10 + Math.random() * 14, a: 0.08 + Math.random() * 0.2 })
  }
  if (mode === 'snow') {
    const n = Math.floor(W / 6)
    for (let i = 0; i < n; i++)
      particles.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 1.4, s: 1.5 + Math.random() * 2.5, a: 0.4 + Math.random() * 0.5 })
  }
}

// Ein Frame des Ensemble-Feldes zeichnen.
function drawField(t: number) {
  if (!ctx) return
  const rows = field.value
  if (!rows.length) return
  const hours = Math.min(24 * 7, rows[0].length)
  if (hours < 2) return

  // globales Min/Max über alle Member im Fenster
  let lo = Infinity
  let hi = -Infinity
  for (const r of rows)
    for (let i = 0; i < hours; i++) {
      const v = r[i]
      if (!Number.isNaN(v)) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
  if (!Number.isFinite(lo) || hi <= lo) return

  const top = H * 0.28
  const bot = H * 0.84
  const yOf = (v: number) => bot - ((v - lo) / (hi - lo)) * (bot - top)
  const rgb = strokeRGB.value

  // Member-Bahnen — je jünger die Vorhersage, desto enger; fächert nach rechts auf.
  for (let m = 0; m < rows.length; m++) {
    const row = rows[m]
    const phase = m * 1.7
    ctx.beginPath()
    let started = false
    for (let i = 0; i < hours; i++) {
      const v = row[i]
      if (Number.isNaN(v)) continue
      const x = (i / (hours - 1)) * W
      const breathe = reduced ? 0 : Math.sin(i * 0.12 + phase + t * 0.0006) * (0.8 + (i / hours) * 1.6)
      const y = yOf(v) + breathe
      started ? ctx.lineTo(x, y) : ((ctx.moveTo(x, y)), (started = true))
    }
    ctx.strokeStyle = `rgba(${rgb},0.07)`
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  // Kontrolllauf / Median heller
  const ctrl = rows[0]
  ctx.beginPath()
  let started = false
  for (let i = 0; i < hours; i++) {
    const v = ctrl[i]
    if (Number.isNaN(v)) continue
    const x = (i / (hours - 1)) * W
    started ? ctx.lineTo(x, yOf(v)) : ((ctx.moveTo(x, yOf(v))), (started = true))
  }
  ctx.strokeStyle = `rgba(${rgb},0.5)`
  ctx.lineWidth = 1.6
  ctx.stroke()

  // "Jetzt"-Knoten links
  const y0 = yOf(ctrl.find((v) => !Number.isNaN(v)) ?? (lo + hi) / 2)
  ctx.fillStyle = `rgba(${rgb},0.9)`
  ctx.beginPath()
  ctx.arc(2, y0, 3, 0, Math.PI * 2)
  ctx.fill()
}

// Gewitter-Blitze
const flash = ref(false)
let stormTimer: ReturnType<typeof setInterval> | undefined
function scheduleStorm() {
  clearInterval(stormTimer)
  if (!isStorm.value || reduced) return
  stormTimer = setInterval(() => {
    if (Math.random() < 0.5) {
      flash.value = true
      setTimeout(() => (flash.value = false), 140)
      setTimeout(() => {
        flash.value = true
        setTimeout(() => (flash.value = false), 90)
      }, 220)
    }
  }, 3200)
}

function frame(t: number) {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  drawField(t)

  const mode = kind.value
  if (mode === 'clear-night') {
    for (const s of stars) {
      ctx.globalAlpha = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t / 700 + s.p)
      ctx.fillStyle = '#eaf0ff'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (mode === 'rain' || mode === 'storm') {
    ctx.strokeStyle = mode === 'storm' ? 'rgba(200,190,255,0.5)' : 'rgba(150,210,235,0.5)'
    ctx.lineWidth = 1.1
    for (const p of particles) {
      ctx.globalAlpha = p.a
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.s * 0.25, p.y + p.s)
      ctx.stroke()
      p.y += p.v
      p.x -= p.v * 0.25
      if (p.y > H) {
        p.y = -10
        p.x = Math.random() * W
      }
    }
    ctx.globalAlpha = 1
  } else if (mode === 'snow') {
    ctx.fillStyle = '#ffffff'
    for (const p of particles) {
      ctx.globalAlpha = p.a
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2)
      ctx.fill()
      p.y += p.v
      p.x += Math.sin((p.y + p.x) / 40) * 0.6
      if (p.y > H) {
        p.y = -10
        p.x = Math.random() * W
      }
    }
    ctx.globalAlpha = 1
  }

  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  readColor()
  resize()
  window.addEventListener('resize', resize)
  if (reduced) frame(6000)
  else raf = requestAnimationFrame(frame)
  scheduleStorm()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(stormTimer)
  window.removeEventListener('resize', resize)
})
watch(kind, () => {
  readColor()
  seed()
  scheduleStorm()
  if (reduced) frame(6000)
})
// bei neuen Ensemble-Daten im reduced-mode einmal neu zeichnen
watch(field, () => {
  if (reduced) frame(6000)
})
</script>

<template>
  <div class="sky" aria-hidden="true">
    <div class="gradient" />
    <div class="horizon" />

    <div v-if="showClouds" class="clouds">
      <span class="cloud c1" />
      <span class="cloud c2" />
      <span class="cloud c3" />
    </div>

    <div class="shimmer" />

    <!-- Ensemble-Feld + Partikel -->
    <canvas ref="canvasRef" class="field" />

    <div class="flash" :class="{ on: flash }" />
    <div class="vignette" />
  </div>
</template>

<style scoped>
.sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.gradient {
  position: absolute;
  inset: 0;
  /* Ruhiger, dunklerer Grund — das Ensemble-Feld ist der Star, nicht der Verlauf. */
  background: linear-gradient(180deg, var(--sky-1) 0%, var(--sky-3) 72%, var(--sky-3) 100%);
  opacity: 0.72;
  transition: background 1.2s ease;
}
.horizon {
  position: absolute;
  left: -10%;
  right: -10%;
  top: 60%;
  height: 44vh;
  background: radial-gradient(120% 100% at 50% 0%, var(--sky-glow), transparent 70%);
  opacity: 0.4;
  transition: opacity 1.2s ease;
}
.field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.clouds {
  position: absolute;
  inset: 0;
}
.cloud {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.12), transparent 68%);
  filter: blur(26px);
}
.c1 {
  width: 46vw;
  height: 30vw;
  top: 4%;
  left: -8%;
  animation: float1 44s ease-in-out infinite alternate;
}
.c2 {
  width: 40vw;
  height: 26vw;
  top: 20%;
  right: -6%;
  animation: float2 56s ease-in-out infinite alternate;
}
.c3 {
  width: 34vw;
  height: 22vw;
  top: 38%;
  left: 24%;
  animation: float1 64s ease-in-out infinite alternate;
}
.shimmer {
  position: absolute;
  inset: 0;
  opacity: var(--shimmer-opacity, 0);
  background: radial-gradient(120% 60% at 70% 8%, var(--sky-glow), transparent 55%);
  animation: shimmer 6s ease-in-out infinite;
}
.flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(80% 50% at 60% 10%, rgba(220, 210, 255, 0.55), transparent 60%);
  opacity: 0;
}
.flash.on {
  opacity: 1;
}
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(135% 100% at 50% 12%, transparent 60%, rgba(0, 0, 0, 0.34) 100%);
}
@keyframes float1 {
  from {
    transform: translateX(-4%);
  }
  to {
    transform: translateX(6%);
  }
}
@keyframes float2 {
  from {
    transform: translateX(4%);
  }
  to {
    transform: translateX(-6%);
  }
}
@keyframes shimmer {
  0%,
  100% {
    opacity: calc(var(--shimmer-opacity) * 0.6);
  }
  50% {
    opacity: var(--shimmer-opacity);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cloud,
  .shimmer {
    animation: none;
  }
}
</style>
