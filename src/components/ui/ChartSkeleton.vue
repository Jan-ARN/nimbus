<script setup lang="ts">
// Ghost-Chart: schwache Achsen + flache Grundlinie statt leerem Kasten — liest
// sich als „ein Diagramm lädt", nicht als kaputte Fläche. Gleiche responsive
// Höhe wie die echten Charts.
</script>

<template>
  <div class="cs">
    <svg viewBox="0 0 900 320" preserveAspectRatio="none" class="cs-svg" aria-hidden="true">
      <!-- Gitterlinien -->
      <g stroke="rgba(147,168,205,0.14)" stroke-width="1">
        <line x1="44" y1="40" x2="888" y2="40" />
        <line x1="44" y1="110" x2="888" y2="110" />
        <line x1="44" y1="180" x2="888" y2="180" />
        <line x1="44" y1="250" x2="888" y2="250" />
      </g>
      <!-- flache Grundlinie -->
      <line x1="44" y1="215" x2="888" y2="215" stroke="rgba(147,168,205,0.22)" stroke-width="2" stroke-dasharray="5 5" />
    </svg>
    <div class="cs-sweep" />
  </div>
</template>

<style scoped>
.cs {
  position: relative;
  width: 100%;
  height: 230px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(147, 168, 205, 0.05);
}
@media (min-width: 640px) {
  .cs {
    height: 290px;
  }
}
@media (min-width: 1024px) {
  .cs {
    height: 340px;
  }
}
.cs-svg {
  width: 100%;
  height: 100%;
  display: block;
}
.cs-sweep {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(200, 216, 244, 0.12) 50%, transparent 100%);
  animation: cs-sweep 1.4s ease-in-out infinite;
}
@keyframes cs-sweep {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cs-sweep {
    display: none;
  }
}
</style>
