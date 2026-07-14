<script setup lang="ts">
// Platzhalter, der genau den Platz des späteren Inhalts einnimmt → kein Springen
// beim Laden. Sichtbare Grundfläche + heller Sweep, damit es klar als Ladezustand
// lesbar ist (nicht als kaputte leere Box). Höhe/Breite über die class steuern.
</script>

<template>
  <div class="sk" />
</template>

<style scoped>
.sk {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(147, 168, 205, 0.11);
}
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(200, 216, 244, 0.16) 50%,
    transparent 100%
  );
  animation: sk-sweep 1.25s ease-in-out infinite;
}
@keyframes sk-sweep {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk {
    background: rgba(147, 168, 205, 0.14);
  }
  .sk::after {
    animation: none;
    display: none;
  }
}
</style>
