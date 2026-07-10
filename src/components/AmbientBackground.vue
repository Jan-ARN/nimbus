<script setup lang="ts">
// Rein dekorativ: zwei driftende Lichtfelder über tiefem Navy.
// Die warme Fläche nutzt --mood (aktuelle Temperatur), daher „lebendig".
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <div class="blob warm" />
    <div class="blob cool" />
    <div class="grain" />
    <div class="scanline" />
  </div>
</template>

<style scoped>
.ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, #0d1526 0%, transparent 60%),
    linear-gradient(180deg, #0a1120 0%, #070c16 100%);
  pointer-events: none;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.5;
  will-change: transform;
}
.warm {
  width: 60vw;
  height: 60vw;
  top: -22vw;
  right: -12vw;
  background: radial-gradient(circle, var(--mood, #ff8a52) 0%, transparent 68%);
  animation: driftA 26s ease-in-out infinite alternate;
}
.cool {
  width: 55vw;
  height: 55vw;
  bottom: -24vw;
  left: -14vw;
  background: radial-gradient(circle, #2b6fd6 0%, transparent 68%);
  opacity: 0.4;
  animation: driftB 32s ease-in-out infinite alternate;
}
.grain {
  position: absolute;
  inset: 0;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.scanline {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(
    rgba(140, 165, 210, 0.05) 1px,
    transparent 1px
  );
  background-size: 100% 3px;
  opacity: 0.35;
}
@keyframes driftA {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(-6vw, 5vw) scale(1.12);
  }
}
@keyframes driftB {
  from {
    transform: translate(0, 0) scale(1.05);
  }
  to {
    transform: translate(7vw, -4vw) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .blob {
    animation: none;
  }
}
</style>
