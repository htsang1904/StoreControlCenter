<script setup>
import { computed } from 'vue'
import CommonModal from '@/components/CommonModal.vue'
import { useConfirmDialogState } from '@/composables/useConfirmDialog'

const { state, cancel, accept } = useConfirmDialogState()

const confirmButtonClass = computed(() => {
  if (state.options.tone === 'danger') return 'app-button-danger'
  if (state.options.tone === 'warning') return 'app-button-warning'
  return 'app-button-primary'
})

const toneIconClass = computed(() => {
  if (state.options.tone === 'danger') return 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
  if (state.options.tone === 'warning') return 'bg-[var(--warning-bg)] text-[var(--warning-text)]'
  return 'bg-[var(--primary-softer)] text-[var(--primary)]'
})

const toneIcon = computed(() => {
  if (state.options.tone === 'danger') return 'delete'
  if (state.options.tone === 'warning') return 'warning'
  return 'check_circle'
})
</script>

<template>
  <CommonModal
    :model-value="state.open"
    max-width-class="max-w-[420px]"
    panel-class="!rounded-2xl shadow-[0_20px_55px_rgba(15,23,42,0.18)]"
    body-class="hidden"
    header-class="!border-b-0 !px-5 !pb-3 !pt-5 tablet:!px-5"
    footer-class="!border-t-0 !bg-[var(--surface-muted)] !px-5 !py-4 tablet:!px-5"
    :show-close="false"
    :close-on-backdrop="true"
    @update:model-value="(value) => { if (!value) cancel() }"
    @close="cancel"
  >
    <template #header>
      <div class="flex min-w-0 items-start gap-3">
        <span
          class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
          :class="toneIconClass"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[21px]">{{ toneIcon }}</span>
        </span>

        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold leading-6 text-[var(--text-primary)]">
            {{ state.options.title }}
          </h3>
          <p v-if="state.options.message" class="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">
            {{ state.options.message }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col-reverse gap-2 tablet:flex-row tablet:items-center tablet:justify-end">
        <button
          type="button"
          class="app-button-secondary inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--stroke)] px-4 text-sm font-semibold"
          @click="cancel"
        >
          {{ state.options.cancelText }}
        </button>
        <button
          type="button"
          :class="[confirmButtonClass, 'inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm']"
          @click="accept"
        >
          {{ state.options.confirmText }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
