<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import CommonModal from '@/components/CommonModal.vue'
import appLogo from '@/assets/images/logo-color.png'

const route = useRoute()
const { state, logout, syncUserStores, updateUserAvatar } = useApp()
const toast = useToast()
const syncingStores = ref(false)
const savingAvatar = ref(false)
const userMenuOpen = ref(false)
const profileModalOpen = ref(false)
const storesModalOpen = ref(false)
const avatarPreviewUrl = ref('')
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
const hasAnyPermission = (permissions = []) => {
  if (isAdmin.value) return true
  const userPermissions = Array.isArray(state.userInfo?.permissions) ? state.userInfo.permissions : []
  return permissions.some((permission) => userPermissions.includes(permission))
}

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
    permissions: ['users.read', 'users.update'],
  },
  {
    key: 'admin_stores',
    label: 'Cửa hàng',
    path: '/tools/stores',
    permissions: ['stores.manage'],
  },
  {
    key: 'admin_departments',
    label: 'Bộ phận',
    path: '/tools/departments',
    permissions: ['departments.manage'],
  },
  {
    key: 'admin_permissions',
    label: 'Phân quyền',
    path: '/tools/permissions',
    permissions: ['permissions.manage'],
  },
  {
    key: 'admin_qc_forms',
    label: 'Biểu mẫu QC',
    path: '/tools/qc-forms',
  },
]

const operationalTabs = computed(() => baseTabs)
const privilegedTabs = computed(() => {
  if (!isAdmin.value) return []
  return adminTabs.filter((tab) => !tab.permissions || hasAnyPermission(tab.permissions))
})
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
  if (tabKey === 'admin_departments') return 'corporate_fare'
  if (tabKey === 'admin_permissions') return 'admin_panel_settings'
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
const userDepartmentName = computed(() => state.userInfo?.department?.name || state.userInfo?.department_name || '')
const userEmail = computed(() => state.userInfo?.email || '')
const userPhone = computed(() => state.userInfo?.phone_number || state.userInfo?.phoneNumber || '')
const userStores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))
const userStoreCount = computed(() => userStores.value.length)
const userStoreLabel = computed(() => `${userStoreCount.value} cửa hàng`)
const userAvatarUrl = computed(() => {
  const url = state.userInfo?.avatar_url || state.userInfo?.avatarUrl || ''
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}${url}`
})
const displayAvatarUrl = computed(() => avatarPreviewUrl.value || userAvatarUrl.value)

const storeDisplayName = (store) => store.shortAddress || store.address || store.name || store.code || store.storeId || `Cửa hàng #${store.id}`

const handleAvatarImageError = (event) => {
  event.currentTarget?.classList.add('hidden')
}

const handleAvatarChange = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = URL.createObjectURL(file)

  savingAvatar.value = true
  try {
    await updateUserAvatar(file)
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value)
      avatarPreviewUrl.value = ''
    }
    toast.success('Đã cập nhật avatar')
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể cập nhật avatar'
    toast.error(message)
  } finally {
    savingAvatar.value = false
    event.target.value = ''
  }
}

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value
}

const closeUserMenu = () => {
  userMenuOpen.value = false
}

const openProfileModal = () => {
  closeUserMenu()
  profileModalOpen.value = true
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
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
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
        <img
          :src="appLogo"
          alt="Store OPS"
          class="h-auto w-[132px] object-contain"
          :class="isExpanded ? 'pc:block' : 'pc:hidden'"
        />

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
            <div class="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--text-secondary)]">
              <span>{{ userInitials }}</span>
              <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="User avatar" class="absolute inset-0 size-full object-cover" @error="handleAvatarImageError" />
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
              class="inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
              @click="openProfileModal"
            >
              Thông tin tài khoản
            </button>
            <button
              type="button"
              class="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
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
          <div class="relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-xl font-semibold text-[var(--text-secondary)]">
            <span>{{ userMonogram }}</span>
            <img v-if="userAvatarUrl" :src="userAvatarUrl" alt="User avatar" class="absolute inset-0 size-full object-cover" @error="handleAvatarImageError" />
          </div>
        </div>
      </div>
    </div>
  </aside>

  <CommonModal
    v-model="profileModalOpen"
    title="Thông tin tài khoản"
    max-width-class="max-w-lg"
    body-class="px-0 py-0"
  >
    <div class="divide-y divide-[var(--stroke)]">
      <div class="px-4 py-3.5 tablet:px-5">
        <div class="flex items-center gap-2.5">
          <div class="relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-base font-bold text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--stroke)]">
            <span>{{ userInitials }}</span>
            <img v-if="displayAvatarUrl" :src="displayAvatarUrl" alt="Avatar preview" class="absolute inset-0 size-full object-cover" @error="handleAvatarImageError" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-base font-semibold text-[var(--text-primary)]">{{ userName }}</p>
            <p v-if="userEmail" class="truncate text-xs text-[var(--text-secondary)]">{{ userEmail }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-2.5 px-4 py-4 tablet:px-5">
        <div class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Tên</label>
          <input :value="userName" type="text" disabled class="app-input h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-100" />
        </div>

        <div v-if="userEmail" class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Email</label>
          <input :value="userEmail" type="text" disabled class="app-input h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-100" />
        </div>

        <div v-if="userPhone" class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Số điện thoại</label>
          <input :value="userPhone" type="text" disabled class="app-input h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-100" />
        </div>

        <div class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Vai trò</label>
          <input :value="userRoleLabel" type="text" disabled class="app-input h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-100" />
        </div>

        <div v-if="userDepartmentName" class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Bộ phận</label>
          <input :value="userDepartmentName" type="text" disabled class="app-input h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-100" />
        </div>

        <div class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Avatar</label>
          <div class="flex items-center gap-2.5">
            <div class="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--stroke)]">
              <span>{{ userInitials }}</span>
              <img v-if="displayAvatarUrl" :src="displayAvatarUrl" alt="Avatar preview" class="absolute inset-0 size-full object-cover" @error="handleAvatarImageError" />
            </div>
            <label class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" :class="savingAvatar ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
              {{ savingAvatar ? 'Đang lưu...' : 'Thay avatar' }}
              <input type="file" accept="image/*" class="sr-only" :disabled="savingAvatar" @change="handleAvatarChange" />
            </label>
          </div>
        </div>

        <div v-if="userStoreCount" class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5">
          <label class="text-xs font-bold text-[var(--text-secondary)]">Cửa hàng</label>
          <button type="button" class="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="storesModalOpen = true">
            {{ userStoreLabel }}
            <span class="material-symbols-outlined text-[16px]">visibility</span>
          </button>
        </div>
      </div>
    </div>
  </CommonModal>

  <CommonModal
    v-model="storesModalOpen"
    title="Cửa hàng đang quản lý"
    max-width-class="max-w-xl"
  >
    <div class="space-y-2">
      <div
        v-for="store in userStores"
        :key="store.id || store.storeId || store.code"
        class="rounded-xl border border-[var(--stroke)] bg-white p-3"
      >
        <p class="font-semibold text-[var(--text-primary)]">{{ storeDisplayName(store) }}</p>
        <p v-if="store.code || store.storeId" class="mt-1 text-xs text-[var(--text-secondary)]">
          <span v-if="store.code">Mã: {{ store.code }}</span>
          <span v-if="store.code && store.storeId"> · </span>
          <span v-if="store.storeId">Store ID: {{ store.storeId }}</span>
        </p>
      </div>
    </div>
  </CommonModal>
</template>

<style scoped>
.stitch-shell {
  font-family: var(--font-ui);
}
</style>
