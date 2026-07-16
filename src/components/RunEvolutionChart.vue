<script setup lang="ts">
// Kleine Vielfache: je künftiger Zieltag eine Mini-Kurve, die zeigt, wie sich die
// Höchstwert-Prognose Lauf für Lauf bewegt hat (ältester Lauf links → aktueller
// rechts). Ein Chip fasst zusammen, ob die Prognose sich entschieden hat.
import { computed } from 'vue'
import { ArrowUp, ArrowDown } from 'lucide-vue-next'
import type { RunTrajectory, Stability } from '@/lib/evolution'
import { localeTag } from '@/i18n'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ trajectories: RunTrajectory[] }>()
const { t } = useI18n()

// festes Mini-Koordinatensystem je Karte; jede Karte skaliert auf ihre eigene
// Spanne, damit die Form (springt/glättet sich) auch bei kleinem Bereich sichtbar ist.
const VW = 150
const VH = 46
const PAD = 5

interface Panel {
  date: string
  weekday: string
  day: string
  latest: number // jüngster Lauf = die aktuelle Prognose
  stability: Stability | null
  sinceYesterday: number | null // jüngster − vorletzter Lauf
  pts: string // polyline-Punkte
  dots: { x: number; y: number; latest: boolean }[]
}

function scaleX(i: number, n: number): number {
  return n <= 1 ? VW / 2 : PAD + (i / (n - 1)) * (VW - 2 * PAD)
}
function scaleY(v: number, lo: number, hi: number): number {
  return hi === lo ? VH / 2 : VH - PAD - ((v - lo) / (hi - lo)) * (VH - 2 * PAD)
}

const panels = computed<Panel[]>(() =>
  props.trajectories.map((tr) => {
    const runs = tr.runs
    const lo = Math.min(...runs)
    const hi = Math.max(...runs)
    const dots = runs.map((v, i) => ({
      x: scaleX(i, runs.length),
      y: scaleY(v, lo, hi),
      latest: i === runs.length - 1,
    }))
    const d = new Date(tr.date)
    return {
      date: tr.date,
      weekday: d.toLocaleDateString(localeTag(), { weekday: 'short' }),
      day: d.toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' }),
      latest: runs[runs.length - 1],
      stability: tr.ff?.stability ?? null,
      sinceYesterday: runs.length >= 2 ? runs[runs.length - 1] - runs[runs.length - 2] : null,
      pts: dots.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      dots,
    }
  }),
)

const stabColor: Record<Stability, string> = {
  stable: 'var(--cool)',
  drifting: 'var(--primary)',
  'flip-flopping': 'var(--warn)',
}
function stabLabel(s: Stability): string {
  return t(`evolution.stab.${s === 'flip-flopping' ? 'flip' : s}`)
}
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
    <div
      v-for="p in panels"
      :key="p.date"
      class="rounded-xl border border-border bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-3"
    >
      <div class="flex items-baseline justify-between">
        <span class="font-medium capitalize">{{ p.weekday }}</span>
        <span class="font-mono text-[11px] text-muted-foreground">{{ p.day }}</span>
      </div>

      <div class="my-1 flex items-baseline gap-2">
        <span class="readout text-2xl">{{ Math.round(p.latest) }}°</span>
        <span
          v-if="p.sinceYesterday != null && Math.abs(p.sinceYesterday) >= 0.5"
          class="inline-flex items-center font-mono text-[11px]"
          :style="{ color: p.sinceYesterday > 0 ? 'var(--hot)' : 'var(--cool)' }"
        >
          <component :is="p.sinceYesterday > 0 ? ArrowUp : ArrowDown" :size="11" />
          {{ Math.abs(p.sinceYesterday).toFixed(1) }}°
        </span>
      </div>

      <svg :viewBox="`0 0 ${VW} ${VH}`" class="block w-full" :style="{ height: VH + 'px' }">
        <polyline
          :points="p.pts"
          fill="none"
          :stroke="p.stability ? stabColor[p.stability] : 'var(--muted-foreground)'"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.85"
        />
        <circle
          v-for="(dot, i) in p.dots"
          :key="i"
          :cx="dot.x"
          :cy="dot.y"
          :r="dot.latest ? 3 : 1.6"
          :fill="dot.latest && p.stability ? stabColor[p.stability] : 'var(--muted-foreground)'"
          :opacity="dot.latest ? 1 : 0.45"
        />
      </svg>

      <div class="mt-1.5 flex items-center justify-between">
        <span
          v-if="p.stability"
          class="rounded-full px-2 py-0.5 text-[10px] font-medium"
          :style="{
            color: stabColor[p.stability],
            background: `color-mix(in srgb, ${stabColor[p.stability]} 14%, transparent)`,
          }"
        >
          {{ stabLabel(p.stability) }}
        </span>
        <span class="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{{ $t('evolution.axisHint') }}</span>
      </div>
    </div>
  </div>
</template>
