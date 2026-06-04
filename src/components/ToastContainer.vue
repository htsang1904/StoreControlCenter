<script setup>
import { useToast } from '@/plugins/toast'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,360px)] flex-col">
    <TransitionGroup name="toast" tag="div" class="relative flex flex-col gap-3">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast-item group pointer-events-auto w-full overflow-hidden rounded-2xl border shadow-lg shadow-blue-100/60 backdrop-blur-md"
        :class="[
          item.type === 'success' ? 'border-[var(--success-border)] bg-white/95' : '',
          item.type === 'error' ? 'border-[var(--danger-border)] bg-white/95' : '',
          item.type === 'info' || !item.type ? 'border-[var(--info-border)] bg-white/95' : ''
        ]"
      >
        <div class="relative px-4 py-3.5">
          <div class="absolute inset-0 opacity-20" :class="[
            item.type === 'success' ? 'bg-gradient-to-r from-green-50 to-transparent' : '',
            item.type === 'error' ? 'bg-gradient-to-r from-rose-50 to-transparent' : '',
            item.type === 'info' || !item.type ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''
          ]"></div>
          
          <div class="relative flex items-start gap-3">
             <div class="mt-0.5 flex shrink-0 size-6 items-center justify-center rounded-full" :class="[
                item.type === 'success' ? 'bg-[var(--success-bg)] text-[var(--success-text)]' : '',
                item.type === 'error' ? 'bg-[var(--danger-bg)] text-[var(--danger-text)]' : '',
                item.type === 'info' || !item.type ? 'bg-[var(--info-bg)] text-[var(--info-text)]' : '',
             ]">
                <span v-if="item.type === 'success'" class="material-symbols-outlined text-[16px]">check</span>
                <span v-else-if="item.type === 'error'" class="material-symbols-outlined text-[16px]">close</span>
                <span v-else class="material-symbols-outlined text-[16px]">info</span>
             </div>

            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-bold tracking-wide" :class="[
                 item.type === 'success' ? 'text-[var(--success-text)]' : '',
                 item.type === 'error' ? 'text-[var(--danger-text)]' : '',
                 item.type === 'info' || !item.type ? 'text-[var(--info-text)]' : '',
              ]">
                {{ item.type === 'success' ? 'Thành công' : item.type === 'error' ? 'Có lỗi xảy ra' : 'Thông báo' }}
              </p>
              <p class="mt-0.5 text-[14px] leading-relaxed text-[var(--text-secondary)]">{{ item.message }}</p>
            </div>
            
            <button
              type="button"
              class="inline-flex shrink-0 rounded-full p-1 text-[var(--text-muted)] opacity-0 transition-all hover:bg-[var(--primary-softer)] hover:text-[var(--primary-strong)] group-hover:opacity-100 focus:opacity-100"
              aria-label="Close notification"
              @click="remove(item.id)"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-move,
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-active {
  position: absolute;
}
</style>
