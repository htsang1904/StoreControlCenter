<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import CommonModal from '@/components/CommonModal.vue'
import AppPagination from '@/components/AppPagination.vue'
import { useToast } from '@/plugins/toast'
import {
  listAdminDepartments,
  listAdminStores,
  listAdminUsers,
  updateAdminUser,
} from '@/services/admin_service'

const toast = useToast()

const loadingUsers = ref(false)
const savingUser = ref(false)
const loadError = ref('')
const users = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const pageSizeOptions = [20, 50, 100]
const totalUsers = ref(0)
const pageCount = ref(1)

const searchInput = ref('')
const roleFilter = ref('')
const statusFilter = ref('')

const departmentOptions = ref([])
const storeOptions = ref([])

const editingUser = ref(null)
const editForm = reactive({
  name: '',
  phoneNumber: '',
  role: 'store',
  isActive: true,
  departmentId: '',
  storeIds: [],
})

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'handler', label: 'Handler' },
  { value: 'qc', label: 'QC' },
  { value: 'store', label: 'Store' },
]

const roleFilterSelectConfig = JSON.stringify({
  placeholder: 'Tất cả role',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[90] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const statusFilterSelectConfig = JSON.stringify({
  placeholder: 'Tất cả trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[90] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const editRoleSelectConfig = JSON.stringify({
  placeholder: 'Chọn role',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[100] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const editStatusSelectConfig = JSON.stringify({
  placeholder: 'Chọn trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[100] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const editDepartmentSelectConfig = JSON.stringify({
  placeholder: 'Chưa gán bộ phận',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[100] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const rangeStart = computed(() => {
  if (!users.value.length) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const rangeEnd = computed(() => {
  if (!users.value.length) return 0
  return rangeStart.value + users.value.length - 1
})

const roleLabel = (role) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'handler') return 'Handler'
  if (normalized === 'qc') return 'QC'
  return 'Store'
}

const statusLabel = (isActive) => (isActive ? 'Đang hoạt động' : 'Tạm khóa')
const statusClass = (isActive) => (
  isActive
    ? 'app-badge app-badge--success inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold'
    : 'app-badge app-badge--neutral inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold'
)

const toStatusFilter = (value) => {
  if (value === 'active') return true
  if (value === 'inactive') return false
  return undefined
}

const normalizeStoreIds = (source = []) => {
  const ids = Array.isArray(source) ? source : []
  return [...new Set(
    ids
      .map((item) => Number(item))
      .filter((id) => Number.isInteger(id) && id > 0)
  )]
}

const syncPrelineSelectValue = (elementId, value) => {
  const selectElement = document.getElementById(elementId)
  if (!selectElement) return

  const normalizedValue = value === undefined || value === null ? '' : String(value)
  selectElement.value = normalizedValue

  const hsSelect = window.HSSelect?.getInstance?.(selectElement, true)
  if (hsSelect?.element?.setValue) {
    hsSelect.element.setValue(normalizedValue)
  }
}

const initAdminSelects = async ({ includeModal = false } = {}) => {
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  syncPrelineSelectValue('admin-users-role-filter', roleFilter.value)
  syncPrelineSelectValue('admin-users-status-filter', statusFilter.value)
  if (!includeModal) return
  syncPrelineSelectValue('admin-users-edit-role', editForm.role)
  syncPrelineSelectValue('admin-users-edit-status', editForm.isActive)
  syncPrelineSelectValue('admin-users-edit-department', editForm.departmentId)
}

const loadUsers = async (page = currentPage.value) => {
  loadingUsers.value = true
  loadError.value = ''

  try {
    const response = await listAdminUsers({
      page,
      pageSize: pageSize.value,
      q: searchInput.value,
      role: roleFilter.value,
      isActive: toStatusFilter(statusFilter.value),
    })
    users.value = response.items
    currentPage.value = response.pagination.page
    totalUsers.value = response.pagination.total
    pageCount.value = response.pagination.pageCount
  } catch (error) {
    users.value = []
    totalUsers.value = 0
    pageCount.value = 1
    loadError.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được danh sách nhân viên'
  } finally {
    loadingUsers.value = false
  }
}

const loadReferences = async () => {
  try {
    const [departments, stores] = await Promise.all([
      listAdminDepartments(),
      listAdminStores({ page: 1, pageSize: 500 }),
    ])
    departmentOptions.value = departments
    storeOptions.value = stores.items
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được danh mục bộ phận/cửa hàng'
    toast.error(message)
  }
}

let filterDebounceTimer = null
watch([searchInput, roleFilter, statusFilter], () => {
  if (filterDebounceTimer) {
    window.clearTimeout(filterDebounceTimer)
  }
  filterDebounceTimer = window.setTimeout(() => {
    void loadUsers(1)
  }, 250)
})

const goToPage = async (page) => {
  if (loadingUsers.value) return
  if (page < 1 || page > pageCount.value || page === currentPage.value) return
  await loadUsers(page)
}

const changePageSize = async (size) => {
  pageSize.value = size
  await loadUsers(1)
}

const openEditModal = (user) => {
  editingUser.value = user
  editForm.name = String(user?.name || '')
  editForm.phoneNumber = String(user?.phoneNumber || '')
  editForm.role = String(user?.role || 'store')
  editForm.isActive = user?.isActive === true
  editForm.departmentId = user?.departmentId ? String(user.departmentId) : ''
  editForm.storeIds = normalizeStoreIds(user?.storeIds || [])
  void initAdminSelects({ includeModal: true })
}

const closeEditModal = () => {
  editingUser.value = null
}

const submitUserUpdate = async () => {
  if (!editingUser.value?.id || savingUser.value) return

  savingUser.value = true
  try {
    const payload = {
      name: String(editForm.name || '').trim(),
      phone_number: String(editForm.phoneNumber || '').trim(),
      role: String(editForm.role || '').toLowerCase(),
      is_active: Boolean(editForm.isActive),
      department_id: editForm.departmentId ? Number(editForm.departmentId) : null,
      store_ids: normalizeStoreIds(editForm.storeIds),
    }

    await updateAdminUser(editingUser.value.id, payload)
    toast.success('Cập nhật nhân viên thành công')
    closeEditModal()
    await loadUsers(currentPage.value)
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể cập nhật nhân viên'
    toast.error(message)
  } finally {
    savingUser.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadReferences(),
    loadUsers(),
  ])
  await initAdminSelects()
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section">
      <div class="app-section-header space-y-4">
        <div class="app-page-header">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">Danh sách nhân viên</h3>
          </div>

          <div class="grid w-full grid-cols-1 gap-3 tablet:w-auto tablet:grid-cols-[minmax(280px,1fr)_180px_180px] tablet:justify-end">
            <input
              v-model="searchInput"
              type="text"
              class="h-9 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
              placeholder="Tìm theo tên, email, SĐT..."
            />

            <select
              id="admin-users-role-filter"
              v-model="roleFilter"
              class="hidden"
              :data-hs-select="roleFilterSelectConfig"
            >
              <option value="">Tất cả role</option>
              <option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>

            <select
              id="admin-users-status-filter"
              v-model="statusFilter"
              class="hidden"
              :data-hs-select="statusFilterSelectConfig"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm khóa</option>
            </select>
          </div>
        </div>
      </div>

      <p v-if="loadError" class="app-state-banner m-4 mb-0">
        {{ loadError }}
      </p>

      <div class="app-table-scroll" v-loading="loadingUsers">
        <table class="min-w-[960px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-[var(--surface-muted)]">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Nhân viên</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Role</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Bộ phận</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Cửa hàng</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Trạng thái</th>
            </tr>
          </thead>

          <tbody v-if="users.length" class="divide-y divide-slate-100">
            <tr
              v-for="user in users"
              :key="user.id"
              class="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
              @click="openEditModal(user)"
            >
              <td class="px-4 py-3 align-top">
                <p class="text-sm font-semibold text-[var(--text-primary)]">{{ user.name || user.email }}</p>
                <p class="text-xs text-[var(--text-secondary)]">{{ user.email }}</p>
                <p class="text-xs text-[var(--text-muted)]">{{ user.phoneNumber || 'Chưa có SĐT' }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ roleLabel(user.role) }}</td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ user.department?.name || 'Chưa gán' }}</td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">
                <p v-if="user.stores.length">{{ user.stores.length }} cửa hàng</p>
                <p v-else>Chưa gán</p>
              </td>
              <td class="px-4 py-3">
                <span :class="statusClass(user.isActive)">{{ statusLabel(user.isActive) }}</span>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="5" class="px-4 py-12">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">group</span>
                    </div>
                    <p class="app-state-title">Không có nhân viên phù hợp.</p>
                    <p class="app-state-body">Điều chỉnh bộ lọc hoặc thử lại sau.</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination :page="currentPage" :page-count="pageCount" :page-size="pageSize" :page-size-options="pageSizeOptions" :total="totalUsers" :loading="loadingUsers" item-label="người dùng" @update:page="goToPage" @update:page-size="changePageSize" />
    </section>
  </div>

  <CommonModal
    :model-value="Boolean(editingUser)"
    title="Cập nhật nhân viên"
    :description="editingUser?.email || ''"
    max-width-class="max-w-2xl"
    :close-disabled="savingUser"
    @update:model-value="(value) => { if (!value) closeEditModal() }"
    @close="closeEditModal"
  >
      <div class="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Tên hiển thị</label>
          <input
            v-model="editForm.name"
            type="text"
            class="h-9 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Số điện thoại</label>
          <input
            v-model="editForm.phoneNumber"
            type="text"
            class="h-9 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Role</label>
          <select
            id="admin-users-edit-role"
            v-model="editForm.role"
            class="hidden"
            :data-hs-select="editRoleSelectConfig"
          >
            <option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Trạng thái</label>
          <select
            id="admin-users-edit-status"
            v-model="editForm.isActive"
            class="hidden"
            :data-hs-select="editStatusSelectConfig"
          >
            <option :value="true">Đang hoạt động</option>
            <option :value="false">Tạm khóa</option>
          </select>
        </div>

        <div class="tablet:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Bộ phận</label>
          <select
            id="admin-users-edit-department"
            v-model="editForm.departmentId"
            class="hidden"
            :data-hs-select="editDepartmentSelectConfig"
          >
            <option value="">Chưa gán bộ phận</option>
            <option v-for="department in departmentOptions" :key="department.id" :value="String(department.id)">
              {{ department.name }} ({{ department.code }})
            </option>
          </select>
        </div>

        <div class="tablet:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Cửa hàng được gán</label>
          <select
            v-model="editForm.storeIds"
            multiple
            class="min-h-40 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
          >
            <option v-for="store in storeOptions" :key="store.id" :value="store.id">
              {{ store.code || store.storeId || `#${store.id}` }} - {{ store.name || store.shortAddress || 'Chưa đặt tên' }}
            </option>
          </select>
          <p class="mt-1 text-xs text-[var(--text-muted)]">Giữ Ctrl/Cmd để chọn nhiều cửa hàng.</p>
        </div>
      </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
        <button
          type="button"
          class="app-button-secondary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-medium tablet:w-auto"
          :disabled="savingUser"
          @click="closeEditModal"
        >
          Hủy
        </button>
        <button
          type="button"
          class="app-button-primary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
          :disabled="savingUser"
          @click="submitUserUpdate"
        >
          {{ savingUser ? 'Đang lưu...' : 'Lưu thay đổi' }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
