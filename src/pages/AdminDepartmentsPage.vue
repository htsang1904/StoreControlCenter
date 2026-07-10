<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useToast } from '@/plugins/toast'
import {
  createAdminDepartment,
  deleteAdminDepartment,
  listAdminDepartmentsManaged,
  updateAdminDepartment,
} from '@/services/admin_service'

const toast = useToast()

const departments = ref([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref(null)
const searchInput = ref('')
const statusFilter = ref('')
const statusFilterOpen = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const pagination = reactive({ total: 0, pageCount: 1 })
const modalOpen = ref(false)
const modalMode = ref('create')
const editingDepartmentId = ref(null)
const openActionMenuId = ref(null)
const actionMenuPosition = reactive({ top: 0, left: 0 })
const departmentForm = reactive({ name: '', code: '', isActive: true })
const statusFilterOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm khóa' },
]

const modalTitle = computed(() => (modalMode.value === 'edit' ? 'Cập nhật bộ phận' : 'Tạo bộ phận mới'))
const rangeStart = computed(() => {
  if (!departments.value.length) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})
const rangeEnd = computed(() => {
  if (!departments.value.length) return 0
  return rangeStart.value + departments.value.length - 1
})
const activeActionDepartment = computed(() => departments.value.find((department) => department.id === openActionMenuId.value) || null)
const statusFilterLabel = computed(() => statusFilterOptions.find((option) => option.value === statusFilter.value)?.label || 'Tất cả trạng thái')

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

const resetForm = () => {
  departmentForm.name = ''
  departmentForm.code = ''
  departmentForm.isActive = true
  editingDepartmentId.value = null
}

const loadDepartments = async (page = currentPage.value) => {
  loading.value = true
  try {
    const response = await listAdminDepartmentsManaged({
      page,
      pageSize: pageSize.value,
      q: searchInput.value,
      isActive: toStatusFilter(statusFilter.value),
    })
    departments.value = response.items
    currentPage.value = response.pagination.page
    pagination.total = response.pagination.total
    pagination.pageCount = response.pagination.pageCount
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không tải được danh sách bộ phận'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  resetForm()
  modalMode.value = 'create'
  modalOpen.value = true
}

const openEditModal = (department) => {
  openActionMenuId.value = null
  editingDepartmentId.value = department.id
  departmentForm.name = department.name
  departmentForm.code = department.code
  departmentForm.isActive = department.isActive
  modalMode.value = 'edit'
  modalOpen.value = true
}

const closeModal = () => {
  if (saving.value) return
  modalOpen.value = false
  resetForm()
}

const submitDepartment = async () => {
  const name = departmentForm.name.trim()
  const code = departmentForm.code.trim()
  if (!name) {
    toast.error('Vui lòng nhập tên bộ phận')
    return
  }
  if (!code) {
    toast.error('Vui lòng nhập mã bộ phận')
    return
  }

  saving.value = true
  try {
    const payload = { name, code, is_active: Boolean(departmentForm.isActive) }
    if (modalMode.value === 'edit' && editingDepartmentId.value) {
      await updateAdminDepartment(editingDepartmentId.value, payload)
      toast.success('Đã cập nhật bộ phận')
    } else {
      await createAdminDepartment(payload)
      toast.success('Đã tạo bộ phận')
    }
    closeModal()
    await loadDepartments(modalMode.value === 'edit' ? currentPage.value : 1)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể lưu bộ phận'
    toast.error(message)
  } finally {
    saving.value = false
  }
}

const toggleDepartmentStatus = async (department) => {
  if (!department?.id || saving.value) return
  openActionMenuId.value = null
  saving.value = true
  try {
    await updateAdminDepartment(department.id, { is_active: !department.isActive })
    toast.success(department.isActive ? 'Đã tạm khóa bộ phận' : 'Đã kích hoạt bộ phận')
    await loadDepartments(currentPage.value)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật trạng thái bộ phận'
    toast.error(message)
  } finally {
    saving.value = false
  }
}

const removeDepartment = async (department) => {
  if (!department?.id || deletingId.value) return
  openActionMenuId.value = null
  const confirmed = window.confirm(`Bạn muốn xoá hoặc ngưng hoạt động bộ phận ${department.name}?`)
  if (!confirmed) return

  deletingId.value = department.id
  try {
    const result = await deleteAdminDepartment(department.id)
    toast.success(result?.message || 'Đã xử lý bộ phận')
    await loadDepartments(currentPage.value)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể xoá bộ phận'
    toast.error(message)
  } finally {
    deletingId.value = null
  }
}

const toggleActionMenu = (department, event) => {
  const departmentId = department?.id
  if (!departmentId) return
  if (openActionMenuId.value === departmentId) {
    openActionMenuId.value = null
    return
  }

  const rect = event?.currentTarget?.getBoundingClientRect?.()
  if (rect) {
    const menuWidth = 176
    const menuHeight = 132
    const viewportPadding = 12
    const opensUp = rect.bottom + menuHeight + viewportPadding > window.innerHeight
    actionMenuPosition.top = opensUp
      ? Math.max(viewportPadding, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + 6)
    actionMenuPosition.left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - menuWidth)
    )
  }

  openActionMenuId.value = departmentId
}

const closeActionMenu = () => {
  openActionMenuId.value = null
}

const handleActionMenuOutside = (event) => {
  if (!openActionMenuId.value) return
  const target = event.target
  if (target?.closest?.('[data-department-action-menu]')) return
  if (target?.closest?.('[data-department-action-trigger]')) return
  closeActionMenu()
}

const toggleStatusFilter = () => {
  statusFilterOpen.value = !statusFilterOpen.value
}

const selectStatusFilter = (value) => {
  statusFilter.value = value
  statusFilterOpen.value = false
  applyFilters()
}

const handleStatusFilterOutside = (event) => {
  if (!statusFilterOpen.value) return
  if (event.target?.closest?.('[data-department-status-filter]')) return
  statusFilterOpen.value = false
}

const applyFilters = () => {
  currentPage.value = 1
  loadDepartments(1)
}

const prevPage = () => {
  if (currentPage.value <= 1) return
  loadDepartments(currentPage.value - 1)
}

const nextPage = () => {
  if (currentPage.value >= pagination.pageCount) return
  loadDepartments(currentPage.value + 1)
}

onMounted(() => {
  loadDepartments(1)
  window.addEventListener('scroll', closeActionMenu, true)
  window.addEventListener('resize', closeActionMenu)
  document.addEventListener('click', handleActionMenuOutside)
  document.addEventListener('click', handleStatusFilterOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', closeActionMenu, true)
  window.removeEventListener('resize', closeActionMenu)
  document.removeEventListener('click', handleActionMenuOutside)
  document.removeEventListener('click', handleStatusFilterOutside)
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section overflow-hidden">
      <div class="app-section-header space-y-4">
        <div class="app-page-header">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">Bộ phận / phòng ban</h3>
          </div>

          <div class="grid w-full grid-cols-1 gap-3 tablet:w-auto tablet:grid-cols-[minmax(260px,1fr)_180px_auto] tablet:items-center tablet:justify-end">
            <input
            v-model="searchInput"
            type="search"
            class="h-9 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
            placeholder="Tìm theo tên hoặc mã bộ phận"
            @keyup.enter="applyFilters"
          />
            <div class="relative" data-department-status-filter>
              <button
                type="button"
                class="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus:border-[var(--primary)] focus:outline-hidden"
                @click="toggleStatusFilter"
              >
                <span class="truncate">{{ statusFilterLabel }}</span>
                <span class="material-symbols-outlined flex size-4 items-center justify-center text-[18px] leading-none text-[var(--text-muted)]">expand_more</span>
              </button>

              <div
                v-if="statusFilterOpen"
                class="absolute left-0 top-10 z-[80] w-full overflow-hidden rounded-xl border border-[var(--stroke)] bg-white py-1 shadow-lg"
              >
                <button
                  v-for="option in statusFilterOptions"
                  :key="option.value || 'all'"
                  type="button"
                  class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-muted)]"
                  :class="statusFilter === option.value ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'"
                  @click="selectStatusFilter(option.value)"
                >
                  <span>{{ option.label }}</span>
                  <span v-if="statusFilter === option.value" class="material-symbols-outlined text-[18px] text-[var(--primary)]">check</span>
                </button>
              </div>
            </div>
            <button type="button" class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]" @click="openCreateModal">
            Thêm bộ phận
            </button>
          </div>
        </div>
      </div>

      <div v-loading="loading" class="min-h-[320px]">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[var(--stroke)] text-sm">
            <thead class="bg-[var(--surface-muted)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              <tr>
                <th class="px-4 py-3">Bộ phận</th>
                <th class="px-4 py-3">Mã</th>
                <th class="px-4 py-3">Trạng thái</th>
                <th class="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--stroke)] bg-white">
              <tr v-for="department in departments" :key="department.id" class="hover:bg-[var(--surface-muted)]/60">
                <td class="px-4 py-3 font-semibold text-[var(--text-primary)]">{{ department.name }}</td>
                <td class="px-4 py-3 text-[var(--text-secondary)]">{{ department.code }}</td>
                <td class="px-4 py-3">
                  <span :class="statusClass(department.isActive)">{{ statusLabel(department.isActive) }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="relative inline-flex justify-end">
                    <button
                      type="button"
                      data-department-action-trigger
                      class="inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                      aria-label="Mở thao tác bộ phận"
                      @click="toggleActionMenu(department, $event)"
                    >
                      <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && departments.length === 0">
                <td colspan="4" class="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">Chưa có bộ phận phù hợp.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="app-pagination-bar app-page-header tablet:items-center">
        <p class="text-sm text-[var(--text-secondary)]">
          Hiển thị
          <span class="font-semibold text-[var(--text-primary)]">{{ rangeStart }}-{{ rangeEnd }}</span>
          trong
          <span class="font-semibold text-[var(--text-primary)]">{{ pagination.total }}</span>
          bộ phận
        </p>

        <div class="flex items-center gap-2">
          <button type="button" class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50" :disabled="currentPage <= 1 || loading" @click="prevPage">Trước</button>
          <span class="text-sm text-[var(--text-secondary)]">Trang {{ currentPage }} / {{ pagination.pageCount }}</span>
          <button type="button" class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50" :disabled="currentPage >= pagination.pageCount || loading" @click="nextPage">Sau</button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="activeActionDepartment"
        data-department-action-menu
        class="fixed z-[120] w-44 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white py-1 text-left shadow-xl"
        :style="{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }"
      >
        <button type="button" class="block w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" @click="openEditModal(activeActionDepartment)">
          Sửa
        </button>
        <button type="button" class="block w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" @click="toggleDepartmentStatus(activeActionDepartment)">
          {{ activeActionDepartment.isActive ? 'Tạm khóa' : 'Kích hoạt' }}
        </button>
        <button type="button" class="block w-full px-3 py-2 text-left text-sm text-[var(--danger-text)] hover:bg-[var(--danger-bg)]" :disabled="deletingId === activeActionDepartment.id" @click="removeDepartment(activeActionDepartment)">
          Xoá
        </button>
      </div>

      <div v-if="modalOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
          <div class="mb-4 flex items-center justify-between gap-4">
            <h2 class="text-lg font-bold text-[var(--text-primary)]">{{ modalTitle }}</h2>
            <button type="button" class="text-2xl leading-none text-[var(--text-secondary)]" @click="closeModal">×</button>
          </div>
          <form class="space-y-4" @submit.prevent="submitDepartment">
            <div>
              <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Tên bộ phận</label>
              <input v-model="departmentForm.name" class="app-input h-10 w-full rounded-lg px-3 text-sm" placeholder="Ví dụ: IT Support" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Mã bộ phận</label>
              <input v-model="departmentForm.code" class="app-input h-10 w-full rounded-lg px-3 text-sm" placeholder="Ví dụ: IT" />
            </div>
            <label class="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <input v-model="departmentForm.isActive" type="checkbox" class="size-4 rounded border-[var(--stroke)]" />
              Đang hoạt động
            </label>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="app-button-secondary rounded-lg px-4 py-2 text-sm font-semibold" @click="closeModal">Huỷ</button>
              <button type="submit" class="app-button-primary rounded-lg px-4 py-2 text-sm font-semibold" :disabled="saving">
                {{ saving ? 'Đang lưu...' : 'Lưu' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
