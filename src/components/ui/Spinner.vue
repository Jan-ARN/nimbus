<script setup lang="ts">
// Schlichter Lade-Spinner: ein rotierender Ring (nur transform → GPU, günstig).
withDefaults(defineProps<{ size?: number }>(), { size: 26 })
</script>

<template>
  <span
    class="spinner"
    :style="{ width: size + 'px', height: size + 'px' }"
    role="status"
    aria-label="loading"
  />
</template>

<style scoped>
.spinner {
  display: inline-block;
  border-radius: 50%;
  border: 2.5px solid color-mix(in srgb, var(--muted-foreground) 28%, transparent);
  border-top-color: var(--primary);
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}
</style>
