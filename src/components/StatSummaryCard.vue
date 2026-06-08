<script setup>
import { computed, reactive, ref } from 'vue'

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
    default: '',
  },
  hint: {
    type: String,
    default: '',
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

const valueClass = computed(() => {
  const toneClasses = {
    neutral: 'text-[var(--text-primary)]',
    sky: 'text-[var(--info-text)]',
    teal: 'text-teal-700',
    amber: 'text-[var(--warning-text)]',
    emerald: 'text-[var(--success-text)]',
    rose: 'text-[var(--danger-text)]',
  }

  return toneClasses[props.tone] || toneClasses.neutral
})

const hintIconRef = ref(null)
const tooltipVisible = ref(false)
const tooltipPosition = reactive({ top: 0, left: 0 })

function showTooltip() {
  const rect = hintIconRef.value?.getBoundingClientRect()
  if (!rect) return

  tooltipPosition.top = rect.top - 8
  tooltipPosition.left = rect.left + rect.width / 2
  tooltipVisible.value = true
}

function hideTooltip() {
  tooltipVisible.value = false
}
</script>

<template>
  <article class="app-metric-card h-full p-5" :class="toneClass">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <p class="app-metric-card__eyebrow">{{ label }}</p>
        <span
          ref="hintIconRef"
          class="app-metric-card__hint inline-flex items-center"
          @mouseenter="showTooltip"
          @mouseleave="hideTooltip"
          @focusin="showTooltip"
          @focusout="hideTooltip"
        >
          <span
            class="material-symbols-outlined app-metric-card__hint-icon text-[var(--text-secondary)]/70"
            tabindex="0"
            aria-hidden="true"
          >help</span>
        </span>
      </div>
      <p class="mt-3 text-3xl font-semibold tracking-tight tablet:text-[2rem]" :class="valueClass">{{ value }}</p>
    </div>

    <p v-if="meta" class="app-metric-card__meta mt-3" :class="metaClass">
      <span>{{ meta }}</span>
    </p>

    <Teleport to="body">
      <span
        v-if="tooltipVisible"
        class="app-metric-card__tooltip app-metric-card__tooltip--fixed pointer-events-none fixed z-[9999] w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs font-medium normal-case leading-5 tracking-normal shadow-lg"
        :style="{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }"
      >
        {{ hint || label }}
      </span>
    </Teleport>
  </article>
</template>
