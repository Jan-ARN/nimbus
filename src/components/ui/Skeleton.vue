<script setup lang="ts">
// Platzhalter, der genau den Platz des späteren Inhalts einnimmt → kein Springen
// beim Laden. Höhe/Breite über die übergebene class steuern.
</script>

<template>
  <div class="sk" />
</template>

<style scoped>
.sk {
  border-radius: 10px;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--muted-foreground) 8%, transparent) 25%,
      color-mix(in srgb, var(--muted-foreground) 20%, transparent) 37%,
      color-mix(in srgb, var(--muted-foreground) 8%, transparent) 63%
    );
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}
@keyframes sk-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
    background: color-mix(in srgb, var(--muted-foreground) 12%, transparent);
  }
}
</style>
