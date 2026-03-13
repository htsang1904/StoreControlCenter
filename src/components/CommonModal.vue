<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  maxWidthClass: {
    type: String,
    default: 'max-w-lg',
  },
  panelClass: {
    type: String,
    default: '',
  },
  bodyClass: {
    type: String,
    default: '',
  },
  closeDisabled: {
    type: Boolean,
    default: false,
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
  showClose: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const titleId = `common-modal-title-${Math.random().toString(36).slice(2, 10)}`

const panelClasses = computed(() => {
  return [
    'flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white',
    props.maxWidthClass,
    props.panelClass,
  ]
    .filter(Boolean)
    .join(' ')
})

const bodyClasses = computed(() => {
  return ['min-h-0 flex-1 overflow-y-auto px-5 py-4 tablet:px-6', props.bodyClass].filter(Boolean).join(' ')
})

function closeModal() {
  if (props.closeDisabled) return
  emit('update:modelValue', false)
  emit('close')
}

function handleBackdropClick() {
  if (!props.closeOnBackdrop) return
  closeModal()
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  closeModal()
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (typeof document === 'undefined') return

    if (isOpen) {
      document.body.classList.add('overflow-hidden')
      document.addEventListener('keydown', handleKeydown)
      return
    }

    document.body.classList.remove('overflow-hidden')
    document.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4"
      @click.self="handleBackdropClick"
    >
      <div
        :class="panelClasses"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
      >
        <div
          v-if="$slots.header || title || description || showClose"
          class="flex items-center gap-4 border-b border-slate-200 px-5 py-4 tablet:px-6"
        >
          <slot name="header">
            <div class="min-w-0 flex-1">
              <h3 v-if="title" :id="titleId" class="text-base font-semibold text-slate-900">
                {{ title }}
              </h3>
              <p v-if="description" class="mt-1 text-sm leading-6 text-slate-500">
                {{ description }}
              </p>
            </div>
          </slot>

          <button
            v-if="showClose"
            type="button"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="closeDisabled"
            aria-label="Đóng modal"
            @click="closeModal"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div :class="bodyClasses">
          <slot />
        </div>

        <div v-if="$slots.footer" class="border-t border-slate-200 px-5 py-4 tablet:px-6">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
