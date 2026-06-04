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
  drawerMode: {
    type: Boolean,
    default: false,
  },
  drawerOpen: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['toggle-desktop-sidebar', 'close-drawer'])

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

const adminTabs = [
  {
    key: 'tools',
    label: 'Công cụ Admin',
    path: '/tools',
    exact: true,
  },
  {
    key: 'admin_users',
    label: 'Nhân viên',
    path: '/tools/users',
  },
  {
    key: 'admin_stores',
    label: 'Cửa hàng',
    path: '/tools/stores',
  },
  {
    key: 'admin_qc_forms',
    label: 'Biểu mẫu QC',
    path: '/tools/qc-forms',
  },
]

const operationalTabs = computed(() => baseTabs)
const privilegedTabs = computed(() => (isAdmin.value ? adminTabs : []))
const isExpanded = computed(() => (props.drawerMode ? props.drawerOpen : props.desktopOpen))
const sidebarClasses = computed(() => {
  if (props.drawerMode) {
    return props.drawerOpen
      ? 'w-64 translate-x-0 opacity-100 pointer-events-auto'
      : 'w-64 -translate-x-full opacity-0 pointer-events-none shadow-none'
  }

  return props.desktopOpen
    ? 'hidden pc:block pc:w-64 pc:translate-x-0 pc:opacity-100 pc:pointer-events-auto'
    : 'hidden pc:block pc:w-20 pc:translate-x-0 pc:opacity-100 pc:pointer-events-auto'
})

const selectedPath = computed(() => route.path)

const isTabActive = (tab) => {
  const tabPath = String(tab?.path || '')
  if (!selectedPath.value) return false
  if (tab?.exact) return selectedPath.value === tabPath
  if (tabPath === '/') return selectedPath.value === '/'
  return selectedPath.value === tabPath || selectedPath.value.startsWith(`${tabPath}/`)
}

const tabIcon = (tabKey) => {
  if (tabKey === 'dashboard') return 'dashboard'
  if (tabKey === 'ticket') return 'confirmation_number'
  if (tabKey === 'qc') return 'verified_user'
  if (tabKey === 'tools') return 'admin_panel_settings'
  if (tabKey === 'admin_users') return 'group'
  if (tabKey === 'admin_stores') return 'storefront'
  if (tabKey === 'admin_qc_forms') return 'fact_check'
  return 'settings'
}

const tabClasses = (tab) => {
  const isActive = isTabActive(tab)

  if (isExpanded.value) {
    return isActive
      ? 'gap-2.5 rounded-2xl bg-[var(--primary-softer)] px-3 py-2 text-[var(--text-primary)] pc:justify-start'
      : 'gap-2.5 rounded-2xl px-3 py-2 text-[var(--text-secondary)] pc:justify-start hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
  }

  return isActive
    ? 'mx-auto h-10 w-10 justify-center rounded-2xl bg-[var(--primary-softer)] text-[var(--text-primary)]'
    : 'mx-auto h-10 w-10 justify-center rounded-2xl text-[var(--text-secondary)] hover:bg-[var(--primary-softer)]'
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
  () => isExpanded.value,
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
  <button
    v-if="props.drawerMode && props.drawerOpen"
    type="button"
    class="fixed inset-0 z-[55] bg-blue-950/20"
    aria-label="Đóng sidebar"
    @click="emit('close-drawer')"
  ></button>

  <aside
    id="hs-pro-sidebar"
    class="stitch-shell fixed inset-y-0 start-0 z-[60] bg-white border-r border-[var(--stroke)] transition-all duration-300 ease-in-out"
    :class="sidebarClasses"
    role="dialog"
    tabindex="-1"
    aria-label="Sidebar"
  >
    <div class="flex h-full max-h-full flex-col">
      <div
        class="flex items-center gap-2.5 px-4 py-3.5"
        :class="isExpanded ? 'pc:justify-start pc:px-4 pc:py-3.5' : 'pc:justify-center pc:px-1.5 pc:py-4'"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-white"
          :class="isExpanded ? 'pc:flex' : 'pc:hidden'"
        >
          <span class="material-symbols-outlined text-[18px]">storefront</span>
        </div>
        <div class="min-w-0" :class="isExpanded ? 'pc:block' : 'pc:hidden'">
          <p class="truncate text-sm font-bold tracking-tight text-[var(--text-primary)]">Quản trị cửa hàng</p>
        </div>

        <button
          v-if="!props.drawerMode"
          type="button"
          class="hidden size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] pc:inline-flex"
          :class="isExpanded ? 'ml-auto' : 'pc:mx-auto pc:border pc:border-[var(--stroke)] pc:bg-[var(--surface-muted)]'"
          :aria-label="isExpanded ? 'Thu gọn sidebar' : 'Mở sidebar'"
          @click="emit('toggle-desktop-sidebar')"
        >
          <span class="material-symbols-outlined text-[18px]">
            {{ isExpanded ? 'left_panel_close' : 'left_panel_open' }}
          </span>
        </button>

        <button
          v-if="props.drawerMode"
          type="button"
          class="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--primary-softer)]"
          aria-label="Đóng sidebar"
          @click="emit('close-drawer')"
        >
          <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <nav class="flex-1" :class="isExpanded ? 'space-y-4 px-3 py-3' : 'px-0 py-5 pc:flex pc:flex-col pc:items-center pc:gap-4'">
        <div>
          <p
            v-if="isExpanded"
            class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]"
          >
            Vận hành
          </p>
          <div :class="isExpanded ? 'space-y-1' : 'space-y-3'">
            <router-link
              v-for="tab in operationalTabs"
              :key="tab.path"
              :to="tab.path"
              class="flex items-center rounded-xl text-sm font-medium transition-colors"
              :title="tab.label"
              :class="tabClasses(tab)"
            >
              <span class="material-symbols-outlined shrink-0" :class="isExpanded ? 'text-[18px]' : 'text-[20px]'">
                {{ tabIcon(tab.key) }}
              </span>
              <span class="truncate" :class="isExpanded ? 'pc:inline' : 'pc:hidden'">{{ tab.label }}</span>
            </router-link>
          </div>
        </div>

        <div v-if="privilegedTabs.length" class="min-w-0">
          <div
            v-if="isExpanded"
            class="mb-3 pt-3"
          >
            <p class="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Quản trị hệ thống
            </p>
          </div>
          <div
            v-else
            class="mx-auto h-px w-8 bg-[var(--primary-soft)]"
          ></div>

          <div :class="isExpanded ? 'space-y-1' : 'mt-4 space-y-3'">
            <router-link
              v-for="tab in privilegedTabs"
              :key="tab.path"
              :to="tab.path"
              class="flex items-center rounded-xl text-sm font-medium transition-colors"
              :title="tab.label"
              :class="tabClasses(tab)"
            >
              <span class="material-symbols-outlined shrink-0" :class="isExpanded ? 'text-[18px]' : 'text-[20px]'">
                {{ tabIcon(tab.key) }}
              </span>
              <span class="truncate" :class="isExpanded ? 'pc:inline' : 'pc:hidden'">{{ tab.label }}</span>
            </router-link>
          </div>
        </div>
      </nav>

      <div class="border-t border-[var(--stroke)] p-4" :class="isExpanded ? 'pc:block' : 'pc:hidden'">
        <div ref="userMenuRef" class="relative">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl border p-2.5 transition-colors"
            :class="userMenuOpen ? 'border-[var(--stroke)] bg-white' : 'border-transparent bg-[var(--surface-muted)] hover:border-[var(--stroke)] hover:bg-white'"
            @click.stop="toggleUserMenu"
          >
            <div class="inline-flex size-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--text-secondary)]">
              {{ userInitials }}
            </div>
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-semibold text-[var(--text-primary)]">{{ userName }}</p>
              <p class="truncate text-xs text-[var(--text-secondary)]">{{ userRoleLabel }}</p>
            </div>
            <span class="material-symbols-outlined text-[20px] text-[var(--text-secondary)]" :class="userMenuOpen ? 'rotate-180' : ''">
              expand_more
            </span>
          </button>

          <div
            v-if="userMenuOpen"
            class="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-[var(--stroke)] bg-white p-2.5"
            @click.stop
          >
            <button
              type="button"
              class="inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="syncingStores"
              @click="handleSyncStoresFromMenu"
            >
              {{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ cửa hàng' }}
            </button>
            <button
              type="button"
              class="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--danger-text)] transition-colors hover:bg-[var(--surface-muted)]"
              @click="handleLogout"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div class="hidden mt-auto border-t border-[var(--stroke)] px-2 py-4 pc:justify-center" :class="isExpanded ? 'pc:hidden' : 'pc:flex'">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--stroke)] bg-[var(--surface-muted)]">
          <div class="inline-flex size-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xl font-semibold text-[var(--text-secondary)]">
            {{ userMonogram }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.stitch-shell {
  font-family: var(--font-ui);
}
</style>
