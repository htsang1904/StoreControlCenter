<script setup>
import { useToast } from '@/plugins/toast'

const { toasts, remove } = useToast()

const toneClass = (type) => {
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-slate-200 bg-white text-slate-800'
}
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,360px)] flex-col gap-2">
    <TransitionGroup name="toast" tag="div">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="pointer-events-auto rounded-xl border px-3 py-2 shadow-lg"
        :class="toneClass(item.type)"
      >
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">Thông báo</p>
            <p class="text-sm leading-5">{{ item.message }}</p>
          </div>
          <button
            type="button"
            class="rounded-md p-1 text-current/70 hover:bg-black/5 hover:text-current"
            aria-label="Close notification"
            @click="remove(item.id)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
