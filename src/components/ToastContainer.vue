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
        class="toast-item group pointer-events-auto w-full overflow-hidden rounded-2xl border shadow-lg shadow-slate-200/50 backdrop-blur-md"
        :class="[
          item.type === 'success' ? 'border-emerald-100 bg-white/95' : '',
          item.type === 'error' ? 'border-rose-100 bg-white/95' : '',
          item.type === 'info' || !item.type ? 'border-indigo-100 bg-white/95' : ''
        ]"
      >
        <div class="relative px-4 py-3.5">
          <div class="absolute inset-0 opacity-20" :class="[
            item.type === 'success' ? 'bg-gradient-to-r from-emerald-50 to-transparent' : '',
            item.type === 'error' ? 'bg-gradient-to-r from-rose-50 to-transparent' : '',
            item.type === 'info' || !item.type ? 'bg-gradient-to-r from-indigo-50 to-transparent' : ''
          ]"></div>
          
          <div class="relative flex items-start gap-3">
             <div class="mt-0.5 flex shrink-0 size-6 items-center justify-center rounded-full" :class="[
                item.type === 'success' ? 'bg-emerald-100 text-emerald-600' : '',
                item.type === 'error' ? 'bg-rose-100 text-rose-600' : '',
                item.type === 'info' || !item.type ? 'bg-indigo-100 text-indigo-600' : '',
             ]">
                <span v-if="item.type === 'success'" class="material-symbols-outlined text-[16px]">check</span>
                <span v-else-if="item.type === 'error'" class="material-symbols-outlined text-[16px]">close</span>
                <span v-else class="material-symbols-outlined text-[16px]">info</span>
             </div>

            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-bold tracking-wide" :class="[
                 item.type === 'success' ? 'text-emerald-900' : '',
                 item.type === 'error' ? 'text-rose-900' : '',
                 item.type === 'info' || !item.type ? 'text-indigo-900' : '',
              ]">
                {{ item.type === 'success' ? 'Thành công' : item.type === 'error' ? 'Có lỗi xảy ra' : 'Thông báo' }}
              </p>
              <p class="mt-0.5 text-[14px] leading-relaxed text-slate-600">{{ item.message }}</p>
            </div>
            
            <button
              type="button"
              class="inline-flex shrink-0 rounded-full p-1 text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
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
