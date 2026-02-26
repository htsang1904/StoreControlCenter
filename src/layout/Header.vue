<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const pageTitle = computed(() => {
  if (route.path.startsWith('/ticket/add-ticket')) {
    return 'Tạo yêu cầu mới'
  }
  if (route.path.startsWith('/ticket/')) {
    return 'Chi tiết yêu cầu'
  }
  if (route.path.startsWith('/QC')) {
    return 'Báo cáo QC'
  }
  return 'Yêu cầu hỗ trợ'
})
</script>

<template>
  <header class="fixed top-0 inset-x-0 md:ms-65 md:hs-overlay-minified:ms-16 transition-[margin] duration-300 ease-in-out z-50 px-3 sm:px-5 pt-3">
    <nav class="glass-card flex h-14 items-center justify-between rounded-2xl px-3 sm:px-4">
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          class="md:hidden flex justify-center items-center size-9 text-slate-500 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-haspopup="dialog"
          aria-expanded="true"
          aria-controls="hs-pro-sidebar"
          aria-label="Open sidebar"
          data-hs-overlay="#hs-pro-sidebar"
        >
          <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m8 9 3 3-3 3"></path>
          </svg>
          <span class="sr-only">Open sidebar</span>
        </button>

        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Trung tâm điều phối cửa hàng</p>
          <h1 class="font-heading truncate text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{{ pageTitle }}</h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Thông báo"
        >
          <span class="absolute end-2 top-2 inline-flex size-2 rounded-full bg-blue-500"></span>
          <svg class="size-4.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .738-1.674C19.41 13.854 18 12.105 18 8.8V8a6 6 0 1 0-12 0v.8c0 3.305-1.41 5.054-2.738 6.526"></path>
          </svg>
        </button>
      </div>
    </nav>
  </header>
</template>
