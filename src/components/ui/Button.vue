<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:opacity-90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        outline: 'border border-border bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted text-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type Props = {
  variant?: VariantProps<typeof button>['variant']
  size?: VariantProps<typeof button>['size']
  class?: string
}
const props = defineProps<Props>()
const classes = computed(() => cn(button({ variant: props.variant, size: props.size }), props.class))
</script>

<template>
  <button :class="classes"><slot /></button>
</template>
