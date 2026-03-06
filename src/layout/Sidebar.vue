<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const { state, logout, syncUserStores } = useApp()
const toast = useToast()
const syncingStores = ref(false)
const userMenuOpen = ref(false)
const userMenuRef = ref(null)
const props = defineProps({
  desktopOpen: {
    type: Boolean,
    default: true,
  },
})
const emit = defineEmits(['toggle-desktop-sidebar'])

const isAdmin = computed(() => String(state.userInfo?.role || '').toLowerCase() === 'admin')

const baseTabs = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    key: 'ticket',
    label: 'Quản lý Ticket',
    path: '/ticket',
  },
  {
    key: 'qc',
    label: 'Quản lý QC',
    path: '/QC',
  },
]

const tabs = computed(() => {
  if (!isAdmin.value) return baseTabs
  return [
    ...baseTabs,
    {
      key: 'tools',
      label: 'Công cụ Admin',
      path: '/tools',
    },
  ]
})

const selectedPath = computed(() => route.path)

const isTabActive = (tabPath) => {
  if (!selectedPath.value) return false
  if (tabPath === '/') return selectedPath.value === '/'
  return selectedPath.value === tabPath || selectedPath.value.startsWith(`${tabPath}/`)
}

const userName = computed(() => state.userInfo?.name || 'Người dùng')
const userRoleLabel = computed(() => {
  const role = String(state.userInfo?.role || '').toLowerCase()
  if (role === 'admin') return 'Quản trị viên'
  if (role === 'handler') return 'Bộ phận xử lý'
  if (role === 'qc') return 'Kiểm soát chất lượng'
  if (role === 'store') return 'Cửa hàng'
  return 'Tài khoản nội bộ'
})
const userInitials = computed(() => {
  const name = userName.value?.trim() || ''
  if (!name) return 'ND'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
})
const userMonogram = computed(() => userInitials.value?.slice(0, 1) || 'S')

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value
}

const closeUserMenu = () => {
  userMenuOpen.value = false
}

const handleLogout = () => {
  closeUserMenu()
  logout()
}

const handleUserMenuOutside = (event) => {
  if (!userMenuOpen.value) return
  const root = userMenuRef.value
  if (!root) return
  if (root.contains(event.target)) return
  closeUserMenu()
}

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

const handleSyncStoresFromMenu = async () => {
  await handleSyncStores()
  closeUserMenu()
}

watch(
  () => props.desktopOpen,
  (isOpen) => {
    if (!isOpen) closeUserMenu()
  }
)

onMounted(() => {
  document.addEventListener('click', handleUserMenuOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleUserMenuOutside)
})
</script>

<template>
  <aside
    id="hs-pro-sidebar"
    class="stitch-shell hs-overlay [--auto-close:md] hs-overlay-open:block hs-overlay-open:translate-x-0 hs-overlay-open:opacity-100 hs-overlay-open:pointer-events-auto -translate-x-full opacity-0 pointer-events-none transition-all duration-300 transform hidden fixed inset-y-0 start-0 z-[60] w-64 bg-white border-r border-slate-200 md:block"
    :class="props.desktopOpen ? 'md:w-64 md:translate-x-0 md:opacity-100 md:pointer-events-auto md:bg-white' : 'md:w-20 md:translate-x-0 md:opacity-100 md:pointer-events-auto md:bg-white'"
    role="dialog"
    tabindex="-1"
    aria-label="Sidebar"
  >
    <div class="flex h-full max-h-full flex-col">
      <div
        class="flex items-center gap-3 border-b border-slate-200 px-6 py-5"
        :class="props.desktopOpen ? 'md:justify-start md:px-6 md:py-5' : 'md:justify-center md:px-2 md:py-6'"
      >
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#136dec] text-white"
          :class="props.desktopOpen ? 'md:flex' : 'md:hidden'"
        >
          <span class="material-symbols-outlined text-[20px]">storefront</span>
        </div>
        <div class="min-w-0" :class="props.desktopOpen ? 'md:block' : 'md:hidden'">
          <p class="truncate text-sm font-bold tracking-tight text-slate-900">Store Control</p>
          <p class="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Hệ thống nội bộ</p>
        </div>

        <button
          type="button"
          class="hidden size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 md:inline-flex"
          :class="props.desktopOpen ? 'ml-auto' : 'md:mx-auto md:border md:border-slate-200 md:bg-slate-50'"
          :aria-label="props.desktopOpen ? 'Thu gọn sidebar' : 'Mở sidebar'"
          @click="emit('toggle-desktop-sidebar')"
        >
          <span class="material-symbols-outlined text-[20px]">
            {{ props.desktopOpen ? 'left_panel_close' : 'left_panel_open' }}
          </span>
        </button>

        <button
          type="button"
          class="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          data-hs-overlay="#hs-pro-sidebar"
          aria-label="Đóng sidebar"
        >
          <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <nav class="flex-1" :class="props.desktopOpen ? 'space-y-1 px-4 py-4' : 'px-0 py-6 md:flex md:flex-col md:items-center md:gap-3'">
        <router-link
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          class="flex items-center rounded-2xl text-sm font-medium transition-all duration-200"
          :title="tab.label"
          :class="[
            props.desktopOpen ? 'gap-3 px-4 py-2.5 md:justify-start' : 'mx-auto h-12 w-12 justify-center rounded-xl',
            props.desktopOpen
              ? (isTabActive(tab.path) ? 'bg-[#136dec]/10 text-[#136dec]' : 'text-slate-600 hover:bg-slate-50')
              : (isTabActive(tab.path) ? 'bg-[#136dec]/12 text-[#136dec]' : 'text-slate-700 hover:bg-slate-100'),
          ]"
        >
          <span class="material-symbols-outlined" :class="props.desktopOpen ? 'text-[20px]' : 'text-[24px]'">
            {{ tab.key === 'dashboard' ? 'dashboard' : tab.key === 'ticket' ? 'confirmation_number' : tab.key === 'qc' ? 'verified_user' : 'settings' }}
          </span>
          <span class="truncate" :class="props.desktopOpen ? 'md:inline' : 'md:hidden'">{{ tab.label }}</span>
        </router-link>
      </nav>

      <div class="border-t border-slate-200 p-4" :class="props.desktopOpen ? 'md:block' : 'md:hidden'">
        <div ref="userMenuRef" class="relative">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50"
            @click.stop="toggleUserMenu"
          >
            <div class="inline-flex size-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              {{ userInitials }}
            </div>
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-semibold text-slate-900">{{ userName }}</p>
              <p class="truncate text-xs text-slate-500">{{ userRoleLabel }}</p>
            </div>
            <span class="material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200" :class="userMenuOpen ? 'rotate-180' : ''">
              expand_more
            </span>
          </button>

          <div
            v-if="userMenuOpen"
            class="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
            @click.stop
          >
            <button
              type="button"
              class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="syncingStores"
              @click="handleSyncStoresFromMenu"
            >
              {{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ cửa hàng' }}
            </button>
            <button
              type="button"
              class="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
              @click="handleLogout"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div class="hidden mt-auto border-t border-slate-200 px-2 py-4 md:justify-center" :class="props.desktopOpen ? 'md:hidden' : 'md:flex'">
        <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
          <div class="inline-flex size-9 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
            {{ userMonogram }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.stitch-shell {
  font-family: 'Inter', sans-serif;
}
</style>
