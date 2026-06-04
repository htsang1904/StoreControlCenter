<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: [String, Number],
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  metaClass: {
    type: String,
    default: 'bg-[var(--primary-softer)] text-[var(--text-secondary)]',
  },
  icon: {
    type: String,
    default: '',
  },
  iconClass: {
    type: String,
    default: 'bg-[var(--primary-softer)] text-[var(--text-secondary)]',
  },
  tone: {
    type: String,
    default: 'neutral',
  },
})

const toneClass = computed(() => {
  const allowedTones = new Set(['neutral', 'sky', 'teal', 'amber', 'emerald', 'rose'])
  return `app-metric-card--${allowedTones.has(props.tone) ? props.tone : 'neutral'}`
})
</script>

<template>
  <article class="app-metric-card h-full p-5" :class="toneClass">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="app-metric-card__eyebrow">{{ label }}</p>
        <p class="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] tablet:text-[2rem]">{{ value }}</p>
      </div>

      <div
        v-if="icon"
        class="app-metric-card__icon flex size-11 shrink-0 items-center justify-center rounded-[20px]"
      >
        <span class="material-symbols-outlined text-[20px]">{{ icon }}</span>
      </div>
    </div>

    <p v-if="meta" class="app-metric-card__meta mt-5">
      <span>{{ meta }}</span>
    </p>
  </article>
</template>
