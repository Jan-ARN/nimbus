<script setup lang="ts">
// Nimbus-Wortmarke: Sonne/Mond auf dem Horizont im Instrument-Ring.
// Zeichnet mit currentColor → reitet auf dem Himmel-Theme mit (blau bei Tag,
// amber bei Hitze, …). Ein SVG, überall wiederverwendbar.
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    role="img"
    aria-label="Nimbus"
  >
    <circle cx="16" cy="16" r="13.5" stroke="currentColor" stroke-width="1.3" opacity=".5" />
    <path d="M4.5 19.5 a11.5 11.5 0 0 0 23 0" fill="currentColor" opacity=".12" />
    <path d="M4.5 19.5 H27.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    <circle cx="16" cy="19.5" r="4.3" fill="currentColor" />
    <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M16 12 V9.2" />
      <path d="M10.3 14 L8.6 12.3" />
      <path d="M21.7 14 L23.4 12.3" />
    </g>
  </svg>
</template>
