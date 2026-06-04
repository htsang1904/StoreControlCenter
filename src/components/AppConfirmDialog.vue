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
</script>

<template>
  <CommonModal
    :model-value="state.open"
    :title="state.options.title"
    :description="state.options.message"
    max-width-class="max-w-md"
    body-class="hidden"
    :close-on-backdrop="true"
    @update:model-value="(value) => { if (!value) cancel() }"
    @close="cancel"
  >
    <template #footer>
      <div class="flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
        <button
          type="button"
          class="app-button-secondary inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold"
          @click="cancel"
        >
          {{ state.options.cancelText }}
        </button>
        <button
          type="button"
          :class="[confirmButtonClass, 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold']"
          @click="accept"
        >
          {{ state.options.confirmText }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
