<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/plugins/toast'
import {
  listAdminPermissions,
  createAdminRole,
  listAdminRoles,
  updateAdminPermission,
  updateAdminRolePermissions,
} from '@/services/admin_service'

const toast = useToast()

const defaultRoleOptions = [
  { value: 'admin', label: 'Admin', description: 'Toàn quyền cấu hình và vận hành hệ thống.' },
  { value: 'store', label: 'Cửa hàng', description: 'Tạo và theo dõi ticket theo cửa hàng được gán.' },
  { value: 'handler', label: 'Bộ phận xử lý', description: 'Tiếp nhận, phản hồi và xử lý ticket.' },
  { value: 'qc', label: 'QC', description: 'Theo dõi và quản lý nghiệp vụ kiểm soát chất lượng.' },
]

const permissions = ref([])
const roles = ref([])
const rolePermissions = ref({})
const activeRole = ref('')
const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const createModalOpen = ref(false)
const editPermissionModalOpen = ref(false)
const permissionSearch = ref('')
const selectedGroup = ref('')
const createPermissionSearch = ref('')
const createSelectedGroup = ref('')
const editingPermissionId = ref(null)
const permissionForm = ref({ code: '', name: '', group: '', description: '', isActive: true, permissions: [] })
const sortDirections = ref({
  role: null,
  description: null,
  permissionCount: null,
  groupCount: null,
})
const sortableFields = ['role', 'description', 'permissionCount', 'groupCount']
const sortCycle = [null, 'desc', 'asc']

const roleOptions = computed(() => {
  if (!roles.value.length) return defaultRoleOptions
  return roles.value.map((role) => ({
    value: role.code,
    label: role.name,
    description: role.description || '',
  }))
})

const activeRoleMeta = computed(() => roleOptions.value.find((role) => role.value === activeRole.value) || null)
const modalOpen = computed(() => Boolean(activeRole.value))
const activePermissionSet = computed(() => new Set(rolePermissions.value[activeRole.value] || []))
const permissionGroups = computed(() => [...new Set(permissions.value.map((permission) => permission.group || 'Khác'))])

const toggleSort = (field) => {
  if (!sortableFields.includes(field)) return
  const currentDirection = sortDirections.value[field] ?? null
  const currentIndex = sortCycle.indexOf(currentDirection)
  const nextIndex = (currentIndex + 1) % sortCycle.length
  sortDirections.value = {
    role: null,
    description: null,
    permissionCount: null,
    groupCount: null,
  }
  sortDirections.value[field] = sortCycle[nextIndex]
}

const sortIndicator = (field) => {
  if (sortDirections.value[field] === 'desc') return '↓'
  if (sortDirections.value[field] === 'asc') return '↑'
  return '↕'
}

const sortIndicatorClass = (field) => (sortDirections.value[field] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')

const roleSortValue = (role, field) => {
  if (field === 'role') return String(role?.label || role?.value || '').toLowerCase()
  if (field === 'permissionCount' || field === 'groupCount') return Number(role?.[field] || 0)
  return String(role?.[field] || '').toLowerCase()
}

const roleRows = computed(() => {
  const rows = roleOptions.value.map((role) => {
  const permissionCodes = rolePermissions.value[role.value] || []
  const groups = new Set(
    permissions.value
      .filter((permission) => permissionCodes.includes(permission.code))
      .map((permission) => permission.group || 'Khác')
  )
  return {
    ...role,
    permissionCount: permissionCodes.length,
    groupCount: groups.size,
    permissions: permissionCodes,
  }
  })

  const activeField = sortableFields.find((field) => sortDirections.value[field])
  if (!activeField) return rows
  const direction = sortDirections.value[activeField]
  return [...rows].sort((left, right) => {
    const leftValue = roleSortValue(left, activeField)
    const rightValue = roleSortValue(right, activeField)
    if (typeof leftValue === 'number' || typeof rightValue === 'number') {
      return direction === 'asc' ? Number(leftValue) - Number(rightValue) : Number(rightValue) - Number(leftValue)
    }
    return direction === 'asc'
      ? String(leftValue).localeCompare(String(rightValue), 'vi')
      : String(rightValue).localeCompare(String(leftValue), 'vi')
  })
})

const filteredPermissions = computed(() => {
  const keyword = permissionSearch.value.trim().toLowerCase()
  return permissions.value.filter((permission) => {
    const matchesGroup = !selectedGroup.value || permission.group === selectedGroup.value
    const matchesKeyword = !keyword || [permission.name, permission.code, permission.description]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
    return matchesGroup && matchesKeyword
  })
})

const groupedPermissions = computed(() => {
  const groups = new Map()
  filteredPermissions.value.forEach((permission) => {
    const groupName = permission.group || 'Khác'
    if (!groups.has(groupName)) groups.set(groupName, [])
    groups.get(groupName).push(permission)
  })
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }))
})

const createFilteredPermissions = computed(() => {
  const keyword = createPermissionSearch.value.trim().toLowerCase()
  return permissions.value.filter((permission) => {
    const matchesGroup = !createSelectedGroup.value || permission.group === createSelectedGroup.value
    const matchesKeyword = !keyword || [permission.name, permission.code, permission.description]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
    return matchesGroup && matchesKeyword
  })
})

const createGroupedPermissions = computed(() => {
  const groups = new Map()
  createFilteredPermissions.value.forEach((permission) => {
    const groupName = permission.group || 'Khác'
    if (!groups.has(groupName)) groups.set(groupName, [])
    groups.get(groupName).push(permission)
  })
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }))
})

const isPermissionChecked = (code) => activePermissionSet.value.has(code)
const isPermissionLocked = (code) => activeRole.value === 'admin' && code === 'permissions.manage'

const setRolePermissions = (role, permissionsList) => {
  rolePermissions.value = {
    ...rolePermissions.value,
    [role]: [...new Set(permissionsList)],
  }
}

const togglePermission = (code) => {
  if (isPermissionLocked(code)) return
  const current = new Set(rolePermissions.value[activeRole.value] || [])
  if (current.has(code)) current.delete(code)
  else current.add(code)
  setRolePermissions(activeRole.value, Array.from(current))
}

const openRoleDetail = (role) => {
  activeRole.value = role.value
  permissionSearch.value = ''
  selectedGroup.value = ''
}

const closeRoleDetail = () => {
  if (saving.value) return
  activeRole.value = ''
  permissionSearch.value = ''
  selectedGroup.value = ''
}

const openCreatePermission = () => {
  permissionForm.value = { code: '', name: '', group: '', description: '', isActive: true, permissions: [] }
  createPermissionSearch.value = ''
  createSelectedGroup.value = ''
  createModalOpen.value = true
}

const closeCreatePermission = () => {
  if (creating.value) return
  createModalOpen.value = false
}

const openEditPermission = (permission) => {
  editingPermissionId.value = permission.id
  permissionForm.value = {
    code: permission.code,
    name: permission.name,
    group: permission.group,
    description: permission.description,
    isActive: permission.isActive,
    roles: [],
  }
  editPermissionModalOpen.value = true
}

const closeEditPermission = () => {
  if (creating.value) return
  editPermissionModalOpen.value = false
  editingPermissionId.value = null
}

const togglePermissionFormPermission = (permissionCode) => {
  const selected = new Set(permissionForm.value.permissions || [])
  if (selected.has(permissionCode)) selected.delete(permissionCode)
  else selected.add(permissionCode)
  permissionForm.value.permissions = Array.from(selected)
}

const loadPermissions = async () => {
  loading.value = true
  try {
    const [permissionItems, roleItems] = await Promise.all([
      listAdminPermissions(),
      listAdminRoles(),
    ])
    permissions.value = permissionItems
    roles.value = roleItems
    rolePermissions.value = roleItems.reduce((map, role) => {
      map[role.code] = Array.isArray(role.permissions) ? role.permissions : []
      return map
    }, {})
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không tải được dữ liệu phân quyền'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

const saveActiveRole = async () => {
  if (!activeRole.value) return
  saving.value = true
  try {
    const result = await updateAdminRolePermissions(activeRole.value, rolePermissions.value[activeRole.value] || [])
    setRolePermissions(activeRole.value, result?.permissions || rolePermissions.value[activeRole.value] || [])
    toast.success('Đã cập nhật quyền')
    closeRoleDetail()
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật quyền'
    toast.error(message)
  } finally {
    saving.value = false
  }
}

const submitPermission = async () => {
  const payload = {
    code: permissionForm.value.code.trim(),
    name: permissionForm.value.name.trim(),
    description: permissionForm.value.description.trim(),
    is_active: Boolean(permissionForm.value.isActive),
    permissions: permissionForm.value.permissions,
  }

  if (!payload.code) {
    toast.error('Vui lòng nhập mã quyền')
    return
  }
  if (!payload.name) {
    toast.error('Vui lòng nhập tên quyền')
    return
  }
  creating.value = true
  try {
    await createAdminRole(payload)
    toast.success('Đã tạo nhóm quyền')
    createModalOpen.value = false
    await loadPermissions()
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể tạo quyền'
    toast.error(message)
  } finally {
    creating.value = false
  }
}

const submitPermissionEdit = async () => {
  if (!editingPermissionId.value) return
  const payload = {
    code: permissionForm.value.code.trim(),
    name: permissionForm.value.name.trim(),
    group: permissionForm.value.group.trim(),
    description: permissionForm.value.description.trim(),
    is_active: Boolean(permissionForm.value.isActive),
  }

  if (!payload.code || !payload.name || !payload.group) {
    toast.error('Vui lòng nhập đầy đủ mã, tên và nhóm quyền')
    return
  }

  creating.value = true
  try {
    await updateAdminPermission(editingPermissionId.value, payload)
    toast.success('Đã cập nhật quyền')
    editPermissionModalOpen.value = false
    editingPermissionId.value = null
    await loadPermissions()
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật quyền'
    toast.error(message)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadPermissions()
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section overflow-hidden" v-loading="loading">
      <div class="app-section-header">
        <div class="app-page-header">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">Danh sách nhóm quyền</h3>
          </div>
          <button type="button" class="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]" @click="openCreatePermission">
            Thêm nhóm quyền
          </button>
        </div>
      </div>

      <div class="app-table-scroll">
        <table class="min-w-[820px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-[var(--surface-muted)]">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('role')">
                  <span>Nhóm quyền</span>
                  <span :class="sortIndicatorClass('role')">{{ sortIndicator('role') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('description')">
                  <span>Mô tả</span>
                  <span :class="sortIndicatorClass('description')">{{ sortIndicator('description') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('permissionCount')">
                  <span>Số quyền</span>
                  <span :class="sortIndicatorClass('permissionCount')">{{ sortIndicator('permissionCount') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('groupCount')">
                  <span>Module</span>
                  <span :class="sortIndicatorClass('groupCount')">{{ sortIndicator('groupCount') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="role in roleRows" :key="role.value" class="transition-colors hover:bg-[var(--surface-muted)]">
              <td class="px-4 py-3">
                <p class="text-sm font-semibold text-[var(--text-primary)]">{{ role.label }}</p>
                <p class="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">{{ role.value }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ role.description }}</td>
              <td class="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{{ role.permissionCount }}</td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ role.groupCount }}</td>
              <td class="px-4 py-3 text-end">
                <button type="button" class="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] hover:text-[var(--text-primary)]" @click="openRoleDetail(role)">
                  Chi tiết
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="createModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
        <div class="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--stroke)] px-5 py-4">
            <div>
              <h2 class="text-lg font-bold text-[var(--text-primary)]">Thêm nhóm quyền</h2>
              <p class="mt-1 text-sm text-[var(--text-secondary)]">Tạo role/nhóm quyền mới và chọn các thao tác được phép.</p>
            </div>
            <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="closeCreatePermission">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submitPermission">
            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div class="grid gap-4 tablet:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Mã định danh</label>
                <input v-model="permissionForm.code" class="h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" placeholder="vd: area_manager" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Tên nhóm quyền</label>
                <input v-model="permissionForm.name" class="h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" placeholder="vd: Quản lý khu vực" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Mô tả</label>
              <textarea v-model="permissionForm.description" rows="3" class="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" placeholder="Mô tả nhóm quyền này dùng để làm gì..."></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <input v-model="permissionForm.isActive" type="checkbox" class="size-4 rounded border-[var(--stroke)]" />
              Đang hoạt động
            </label>
            <div>
              <p class="mb-2 text-sm font-semibold text-[var(--text-primary)]">Quyền truy cập</p>
              <div class="grid min-h-[340px] overflow-hidden rounded-xl border border-[var(--stroke)] tablet:grid-cols-[240px_1fr]">
                <aside class="min-h-0 border-b border-[var(--stroke)] bg-[var(--surface-muted)] p-3 tablet:border-b-0 tablet:border-r">
                  <input
                    v-model="createPermissionSearch"
                    type="search"
                    class="mb-3 h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden"
                    placeholder="Tìm quyền..."
                  />
                  <div class="max-h-[260px] space-y-1 overflow-y-auto pr-1">
                    <button
                      type="button"
                      class="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                      :class="!createSelectedGroup ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-white'"
                      @click="createSelectedGroup = ''"
                    >
                      Tất cả quyền
                    </button>
                    <button
                      v-for="group in permissionGroups"
                      :key="group"
                      type="button"
                      class="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                      :class="createSelectedGroup === group ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-white'"
                      @click="createSelectedGroup = group"
                    >
                      {{ group }}
                    </button>
                  </div>
                </aside>

                <div class="min-h-0 overflow-hidden">
                  <div class="grid grid-cols-[48px_1fr] bg-[var(--surface-muted)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <span></span>
                    <span>Tên quyền</span>
                  </div>
                  <div class="max-h-[300px] overflow-y-auto">
                    <template v-for="group in createGroupedPermissions" :key="group.group">
                      <div class="border-t border-[var(--stroke)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {{ group.group }}
                      </div>
                      <label v-for="permission in group.items" :key="permission.code" class="grid cursor-pointer grid-cols-[48px_1fr] items-start gap-2 border-t border-[var(--stroke)] px-4 py-3 hover:bg-[var(--surface-muted)]">
                        <input type="checkbox" class="mt-1 size-5 rounded border-[var(--stroke)]" :checked="permissionForm.permissions.includes(permission.code)" @change="togglePermissionFormPermission(permission.code)" />
                        <span>
                          <span class="block text-sm font-semibold text-[var(--text-primary)]">{{ permission.name }}</span>
                          <span class="mt-0.5 block font-mono text-xs text-[var(--text-secondary)]">{{ permission.code }}</span>
                          <span v-if="permission.description" class="mt-1 block text-xs text-[var(--text-muted)]">{{ permission.description }}</span>
                        </span>
                      </label>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div class="flex justify-end gap-2 border-t border-[var(--stroke)] bg-white p-5">
              <button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="closeCreatePermission">
                Đóng
              </button>
              <button type="submit" class="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:opacity-60" :disabled="creating">
                {{ creating ? 'Đang tạo...' : 'Tạo nhóm quyền' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="editPermissionModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
        <div class="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--stroke)] px-5 py-4">
            <div>
              <h2 class="text-lg font-bold text-[var(--text-primary)]">Chỉnh sửa quyền</h2>
              <p class="mt-1 text-sm text-[var(--text-secondary)]">Cập nhật mã, tên, nhóm và mô tả quyền.</p>
            </div>
            <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="closeEditPermission">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <form class="space-y-4 p-5" @submit.prevent="submitPermissionEdit">
            <div class="grid gap-4 tablet:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Mã quyền</label>
                <input v-model="permissionForm.code" class="h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Tên quyền</label>
                <input v-model="permissionForm.name" class="h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Nhóm</label>
              <input v-model="permissionForm.group" class="h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Mô tả</label>
              <textarea v-model="permissionForm.description" rows="3" class="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden"></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <input v-model="permissionForm.isActive" type="checkbox" class="size-4 rounded border-[var(--stroke)]" />
              Đang hoạt động
            </label>
            <div class="flex justify-end gap-2 border-t border-[var(--stroke)] pt-4">
              <button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="closeEditPermission">
                Đóng
              </button>
              <button type="submit" class="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:opacity-60" :disabled="creating">
                {{ creating ? 'Đang lưu...' : 'Lưu thay đổi' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="modalOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
        <div class="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div class="flex items-center justify-between gap-4 border-b border-[var(--stroke)] bg-[var(--primary)] px-5 py-4 text-white">
            <div>
              <h2 class="text-lg font-bold">{{ activeRoleMeta?.label }}</h2>
              <p class="mt-1 text-sm text-white/80">{{ activeRoleMeta?.description }}</p>
            </div>
            <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25" @click="closeRoleDetail">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 tablet:grid-cols-[240px_1fr]">
            <aside class="min-h-0 rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-3">
              <input
                v-model="permissionSearch"
                type="search"
                class="mb-3 h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden"
                placeholder="Tìm quyền..."
              />
              <div class="h-[calc(100%-3rem)] space-y-1 overflow-y-auto pr-1">
                <button
                  type="button"
                  class="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  :class="!selectedGroup ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-white'"
                  @click="selectedGroup = ''"
                >
                  Tất cả quyền
                </button>
                <button
                  v-for="group in permissionGroups"
                  :key="group"
                  type="button"
                  class="block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  :class="selectedGroup === group ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-white'"
                  @click="selectedGroup = group"
                >
                  {{ group }}
                </button>
              </div>
            </aside>

            <div class="min-h-0 overflow-hidden rounded-xl border border-[var(--stroke)]">
              <div class="grid grid-cols-[48px_1fr_72px] bg-[var(--surface-muted)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <span></span>
                <span>Tên quyền</span>
                <span class="text-right">Sửa</span>
              </div>
              <div class="h-[calc(100%-2.75rem)] overflow-y-auto">
                <template v-for="group in groupedPermissions" :key="group.group">
                  <div class="border-t border-[var(--stroke)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {{ group.group }}
                  </div>
                  <label
                    v-for="permission in group.items"
                    :key="permission.code"
                    class="grid cursor-pointer grid-cols-[48px_1fr_72px] items-start gap-2 border-t border-[var(--stroke)] px-4 py-3 transition-colors hover:bg-[var(--surface-muted)]"
                    :class="isPermissionLocked(permission.code) ? 'opacity-70' : ''"
                  >
                    <input
                      type="checkbox"
                      class="mt-1 size-5 rounded border-[var(--stroke)]"
                      :checked="isPermissionChecked(permission.code)"
                      :disabled="isPermissionLocked(permission.code)"
                      @change="togglePermission(permission.code)"
                    />
                    <span>
                      <span class="block text-sm font-semibold text-[var(--text-primary)]">{{ permission.name }}</span>
                      <span class="mt-0.5 block font-mono text-xs text-[var(--text-secondary)]">{{ permission.code }}</span>
                      <span v-if="permission.description" class="mt-1 block text-xs text-[var(--text-muted)]">{{ permission.description }}</span>
                    </span>
                    <button type="button" class="justify-self-end rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-white" @click.prevent="openEditPermission(permission)">
                      Sửa
                    </button>
                  </label>
                </template>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-[var(--stroke)] bg-white px-5 py-4">
            <button type="button" class="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]" @click="closeRoleDetail">
              Đóng
            </button>
            <button type="button" class="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:opacity-60" :disabled="saving" @click="saveActiveRole">
              {{ saving ? 'Đang lưu...' : 'Lưu quyền' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
