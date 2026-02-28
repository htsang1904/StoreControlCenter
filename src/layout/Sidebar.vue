<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const { state, logout, syncUserStores } = useApp()
const toast = useToast()
const syncingStores = ref(false)

const tabs = [
  {
    label: 'Tổng quan',
    icon: 'https://cdn.lordicon.com/lrzdmsmx.json',
    path: '/dashboard',
  },
  {
    label: 'Yêu cầu xử lý',
    icon: 'https://cdn.lordicon.com/rguyoaum.json',
    path: '/ticket',
  },
  {
    label: 'Báo cáo QC',
    icon: 'https://cdn.lordicon.com/wwcdwkaf.json',
    path: '/QC',
  },
]

const selectedPath = computed(() => route.path)
const isTabActive = (tabPath) => {
  if (!selectedPath.value) return false
  if (tabPath === '/') return selectedPath.value === '/'
  return selectedPath.value === tabPath || selectedPath.value.startsWith(`${tabPath}/`)
}
const userName = computed(() => state.userInfo?.name || 'Người dùng')
const userContact = computed(() => state.userInfo?.phone || state.userInfo?.phoneNumber || state.userInfo?.email || '')
const userInitials = computed(() => {
  const name = userName.value?.trim() || ''
  if (!name) return 'ND'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
})

const handleSyncStores = async () => {
  if (syncingStores.value) return

  syncingStores.value = true

  try {
    const result = await syncUserStores()
    const syncedStores = Number(result?.data?.syncedStores || 0)
    toast.success(`Đã đồng bộ ${syncedStores} cửa hàng`)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể đồng bộ cửa hàng'
    toast.error(message)
  } finally {
    syncingStores.value = false
  }
}
</script>

<template>
  <aside
    id="hs-pro-sidebar"
    class="hs-overlay [--auto-close:md] hs-overlay-open:translate-x-0 -translate-x-full transition-all duration-300 transform w-65 hs-overlay-minified:w-16 overflow-hidden hidden fixed inset-y-0 z-60 start-0 px-2 py-3 md:hs-overlay-minified:px-1.5 md:block md:translate-x-0 md:end-auto md:bottom-0"
    role="dialog"
    tabindex="-1"
    aria-label="Sidebar"
  >
    <div class="glass-card relative flex h-full max-h-full flex-col rounded-2xl">
      <header class="px-3 py-3 flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 md:hs-overlay-minified:px-1.5 md:hs-overlay-minified:justify-center">
        <div class="min-w-0 flex-1 md:hs-overlay-minified:hidden">
          <a class="inline-flex w-full items-center rounded-xl px-2 py-1.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/80" href="#" aria-label="Guta">
            <img class="h-5 w-auto max-w-[132px] object-contain" src="/src/assets/images/logo.png" alt="StoreControlCenter" />
          </a>
        </div>

        <button
          type="button"
          class="hidden md:flex justify-center items-center size-9 text-slate-500 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-haspopup="dialog"
          aria-expanded="true"
          aria-controls="hs-pro-sidebar"
          aria-label="Minify navigation"
          data-hs-overlay-minifier="#hs-pro-sidebar"
        >
          <svg class="hs-overlay-minified:hidden shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m10 15-3-3 3-3"></path>
          </svg>
          <svg class="hidden hs-overlay-minified:block shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m8 9 3 3-3 3"></path>
          </svg>
        </button>

        <button
          type="button"
          class="flex md:hidden justify-center items-center size-7 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-full dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
          data-hs-overlay="#hs-pro-sidebar"
          aria-expanded="true"
          aria-label="Close sidebar"
        >
          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div class="p-2.5 md:hs-overlay-minified:px-1 md:hs-overlay-minified:py-2">
        <ul class="space-y-1">
          <li v-for="tab in tabs" :key="tab.path">
            <router-link
              :to="tab.path"
              class="group hover-target relative flex w-full items-center gap-2 rounded-xl py-2 px-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:hs-overlay-minified:size-10 md:hs-overlay-minified:mx-auto md:hs-overlay-minified:justify-center md:hs-overlay-minified:gap-0 md:hs-overlay-minified:px-0"
              :class="{ active: isTabActive(tab.path) }"
            >
              <span class="nav-icon flex shrink-0 justify-center items-center size-6">
                <lord-icon
                  :src="tab.icon"
                  trigger="hover"
                  :colors="isTabActive(tab.path) ? 'primary:#ffffff,secondary:#ffffff' : 'primary:#1e293b,secondary:#1e293b'"
                  target=".hover-target"
                ></lord-icon>
              </span>
              <span class="truncate transition-opacity duration-300 md:hs-overlay-minified:hidden">{{ tab.label }}</span>
            </router-link>
          </li>
        </ul>
      </div>

      <div class="mt-auto p-2.5">
        <div class="md:hs-overlay-minified:hidden">
          <div class="hs-dropdown [--strategy:absolute] [--placement:top-left] relative inline-flex w-full">
            <button
              type="button"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800"
            >
              <div class="flex items-center gap-2.5">
                <div class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {{ userInitials }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{{ userName }}</p>
                  <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ userContact || 'Tài khoản nội bộ' }}</p>
                </div>
                <svg class="size-4 shrink-0 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </div>
            </button>

            <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-58 transition-[opacity,margin] duration opacity-0 hidden z-70 bg-white border border-slate-200 rounded-xl shadow-lg dark:bg-slate-900 dark:border-slate-700">
              <div class=" p-1.5">
                <button
                  type="button"
                  class="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="syncingStores"
                  @click="handleSyncStores"
                >
                  <span>{{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ cửa hàng' }}</span>
                  <svg v-if="syncingStores" class="animate-spin size-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                </button>
                <button type="button" class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15" @click="logout">
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="hidden md:hs-overlay-minified:flex justify-center items-center">
          <button
            type="button"
            class="inline-flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-0 text-[13px] font-semibold leading-none text-blue-700 transition-colors hover:bg-slate-100"
            :title="userName"
            aria-label="Mở rộng thanh bên"
            data-hs-overlay-minifier="#hs-pro-sidebar"
          >
            {{ userInitials }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
@custom-variant dark (&:where(.dark, .dark *));
@reference "tailwindcss";

.active {
  @apply bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500;
}

.nav-icon :deep(lord-icon) {
  width: 22px;
  height: 22px;
  display: block;
}
</style>
