<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppPagination from '@/components/AppPagination.vue'
import { listAdminQcForms } from '@/services/admin_service'

const router = useRouter()

const loadingForms = ref(false)
const formsError = ref('')
const qcForms = ref([])
const searchInput = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const pageSizeOptions = [20, 50, 100]
const totalForms = ref(0)
const pageCount = ref(1)
const sortDirections = ref({
  code: null,
  name: null,
  version: null,
  status: null,
  createdAt: null,
  updatedAt: null,
})
const sortableFields = ['code', 'name', 'version', 'status', 'createdAt', 'updatedAt']
const sortCycle = [null, 'desc', 'asc']

const statusFilterSelectConfig = JSON.stringify({
  placeholder: 'Tất cả trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[90] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const normalizedSearch = computed(() => String(searchInput.value || '').trim().toLowerCase())
const hasLocalFilters = computed(() => Boolean(normalizedSearch.value || statusFilter.value))

const toggleSort = (field) => {
  if (!sortableFields.includes(field)) return
  const currentDirection = sortDirections.value[field] ?? null
  const currentIndex = sortCycle.indexOf(currentDirection)
  const nextIndex = (currentIndex + 1) % sortCycle.length
  sortDirections.value = {
    code: null,
    name: null,
    version: null,
    status: null,
    createdAt: null,
    updatedAt: null,
  }
  sortDirections.value[field] = sortCycle[nextIndex]
}

const sortIndicator = (field) => {
  if (sortDirections.value[field] === 'desc') return '↓'
  if (sortDirections.value[field] === 'asc') return '↑'
  return '↕'
}

const sortIndicatorClass = (field) => (sortDirections.value[field] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')

const formStatusValue = (form) => (
  form.hasLatestVersion
    ? String(form.displayVersionStatus || form.latestVersionStatus || 'draft').toLowerCase()
    : 'no_version'
)

const formSortValue = (form, field) => {
  if (field === 'version') return String(form?.displayVersionNo || form?.latestVersionNo || '').toLowerCase()
  if (field === 'status') return formStatusValue(form)
  if (field === 'createdAt' || field === 'updatedAt') return new Date(form?.[field] || 0).getTime() || 0
  return String(form?.[field] || '').toLowerCase()
}

const displayForms = computed(() => {
  const filteredForms = qcForms.value.filter((form) => {
    const status = form.hasLatestVersion
      ? String(form.displayVersionStatus || form.latestVersionStatus || 'draft').toLowerCase()
      : 'no_version'

    if (statusFilter.value && status !== statusFilter.value) return false

    const keyword = normalizedSearch.value
    if (!keyword) return true

    return (
      String(form.code || '').toLowerCase().includes(keyword)
      || String(form.name || '').toLowerCase().includes(keyword)
      || String(form.description || '').toLowerCase().includes(keyword)
      || String(form.displayVersionNo || '').toLowerCase().includes(keyword)
      || String(form.latestVersionNo || '').toLowerCase().includes(keyword)
    )
  })

  const activeField = sortableFields.find((field) => sortDirections.value[field])
  if (!activeField) return filteredForms
  const direction = sortDirections.value[activeField]
  return [...filteredForms].sort((left, right) => {
    const leftValue = formSortValue(left, activeField)
    const rightValue = formSortValue(right, activeField)
    if (typeof leftValue === 'number' || typeof rightValue === 'number') {
      return direction === 'asc' ? Number(leftValue) - Number(rightValue) : Number(rightValue) - Number(leftValue)
    }
    return direction === 'asc'
      ? String(leftValue).localeCompare(String(rightValue), 'vi')
      : String(rightValue).localeCompare(String(leftValue), 'vi')
  })
})

const summaryTotalForms = computed(() => (hasLocalFilters.value ? displayForms.value.length : totalForms.value))

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

const initAdminFilterSelects = async () => {
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  syncPrelineSelectValue('admin-qc-forms-status-filter', statusFilter.value)
}

const formatDisplayDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const statusLabel = (status, hasLatestVersion = true) => {
  if (!hasLatestVersion) return 'Chưa có version'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'Đang áp dụng'
  if (normalized === 'archived') return 'Lưu trữ'
  return 'Bản nháp'
}

const statusClass = (status, hasLatestVersion = true) => {
  if (!hasLatestVersion) return 'app-badge--neutral'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'app-badge--success'
  if (normalized === 'archived') return 'app-badge--neutral'
  return 'app-badge--warning'
}

const loadQcForms = async (page = currentPage.value) => {
  loadingForms.value = true
  formsError.value = ''

  try {
    const response = await listAdminQcForms({
      page,
      pageSize: pageSize.value,
    })
    qcForms.value = response.items
    currentPage.value = response.pagination.page
    totalForms.value = response.pagination.total
    pageCount.value = response.pagination.pageCount
  } catch (error) {
    qcForms.value = []
    totalForms.value = 0
    pageCount.value = 1
    formsError.value = error?.response?.data?.message || error?.message || 'Không tải được danh sách biểu mẫu QC'
  } finally {
    loadingForms.value = false
  }
}

const openCreatePage = () => {
  router.push('/tools/qc-forms/create')
}

const openFormDetail = (formId) => {
  if (!formId) return
  router.push(`/tools/qc-forms/${formId}`)
}

const goToPage = async (page) => {
  if (loadingForms.value) return
  if (page < 1 || page > pageCount.value || page === currentPage.value) return
  await loadQcForms(page)
}

const changePageSize = async (size) => {
  pageSize.value = size
  await loadQcForms(1)
}

onMounted(async () => {
  await loadQcForms()
  await initAdminFilterSelects()
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section">
      <div class="app-section-header space-y-4">
        <div class="app-page-header">
          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">Danh sách biểu mẫu QC</h3>
          </div>

          <div class="grid w-full grid-cols-1 gap-3 tablet:w-auto tablet:grid-cols-[minmax(280px,1fr)_190px_auto] tablet:items-center tablet:justify-end">
            <input
              v-model="searchInput"
              type="text"
              class="h-9 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
              placeholder="Tìm theo mã, tên, mô tả..."
            />

            <select
              id="admin-qc-forms-status-filter"
              v-model="statusFilter"
              class="hidden"
              :data-hs-select="statusFilterSelectConfig"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đang áp dụng</option>
              <option value="archived">Lưu trữ</option>
              <option value="no_version">Chưa có version</option>
            </select>

            <button
              type="button"
              class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] tablet:w-auto"
              @click="openCreatePage"
            >
              Tạo biểu mẫu
            </button>
          </div>
        </div>

        <p v-if="hasLocalFilters" class="text-xs text-[var(--text-muted)]">
          Bộ lọc hiện áp dụng trên các bản ghi của trang hiện tại.
        </p>
      </div>

      <p v-if="formsError" class="app-state-banner m-4 mb-0">
        {{ formsError }}
      </p>

      <div v-if="displayForms.length" class="divide-y divide-[var(--stroke)] tablet:hidden">
        <article
          v-for="form in displayForms"
          :key="form.id"
          class="cursor-pointer bg-white px-4 py-4 transition-colors active:bg-[var(--surface-muted)]"
          @click="openFormDetail(form.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-[var(--text-primary)]">{{ form.code }}</p>
              <p class="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[var(--text-primary)]">{{ form.name }}</p>
              <p class="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{{ form.description || 'Không có mô tả' }}</p>
            </div>
            <span class="app-badge shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(form.displayVersionStatus || form.latestVersionStatus, form.hasLatestVersion)">
              {{ statusLabel(form.displayVersionStatus || form.latestVersionStatus, form.hasLatestVersion) }}
            </span>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div class="rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
              <p class="text-[var(--text-muted)]">Version</p>
              <p class="mt-1 truncate font-semibold text-[var(--text-primary)]">{{ form.displayVersionNo || '--' }}</p>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
              <p class="text-[var(--text-muted)]">Ngày tạo</p>
              <p class="mt-1 truncate font-semibold text-[var(--text-primary)]">{{ formatDisplayDate(form.createdAt) }}</p>
            </div>
            <div class="rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
              <p class="text-[var(--text-muted)]">Cập nhật</p>
              <p class="mt-1 truncate font-semibold text-[var(--text-primary)]">{{ formatDisplayDate(form.updatedAt) }}</p>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="px-4 py-8 tablet:hidden">
        <div class="app-state-panel app-state-panel--compact">
          <div class="app-state-stack mx-auto">
            <div class="app-state-icon mx-auto">
              <span class="material-symbols-outlined text-[24px]">inventory_2</span>
            </div>
            <p class="app-state-title">{{ loadingForms ? 'Đang tải danh sách biểu mẫu...' : 'Chưa có biểu mẫu QC nào.' }}</p>
            <p class="app-state-body">{{ loadingForms ? 'Danh sách biểu mẫu sẽ xuất hiện sau khi tải xong.' : 'Tạo biểu mẫu mới để bắt đầu xây dựng checklist QC cho hệ thống.' }}</p>
          </div>
        </div>
      </div>

      <div class="app-table-scroll hidden tablet:block">
        <table class="min-w-[1040px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-[var(--surface-muted)]">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('code')">
                  <span>Mã biểu mẫu</span>
                  <span :class="sortIndicatorClass('code')">{{ sortIndicator('code') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('name')">
                  <span>Tên biểu mẫu</span>
                  <span :class="sortIndicatorClass('name')">{{ sortIndicator('name') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('version')">
                  <span>Version đang dùng</span>
                  <span :class="sortIndicatorClass('version')">{{ sortIndicator('version') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('status')">
                  <span>Trạng thái</span>
                  <span :class="sortIndicatorClass('status')">{{ sortIndicator('status') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('createdAt')">
                  <span>Ngày tạo</span>
                  <span :class="sortIndicatorClass('createdAt')">{{ sortIndicator('createdAt') }}</span>
                </button>
              </th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('updatedAt')">
                  <span>Ngày cập nhật</span>
                  <span :class="sortIndicatorClass('updatedAt')">{{ sortIndicator('updatedAt') }}</span>
                </button>
              </th>
            </tr>
          </thead>

          <tbody v-if="displayForms.length" class="divide-y divide-slate-100">
            <tr
              v-for="form in displayForms"
              :key="form.id"
              class="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]/80"
              @click="openFormDetail(form.id)"
            >
              <td class="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{{ form.code }}</td>
              <td class="px-4 py-3">
                <p class="text-sm font-medium text-[var(--text-primary)]">{{ form.name }}</p>
                <p class="text-xs text-[var(--text-secondary)]">{{ form.description || 'Không có mô tả' }}</p>
              </td>
              <td class="px-4 py-3">
                <p class="text-sm font-semibold text-[var(--text-primary)]">{{ form.displayVersionNo || '--' }}</p>
              </td>
              <td class="px-4 py-3">
                <span class="app-badge inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(form.displayVersionStatus || form.latestVersionStatus, form.hasLatestVersion)">
                  {{ statusLabel(form.displayVersionStatus || form.latestVersionStatus, form.hasLatestVersion) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ formatDisplayDate(form.createdAt) }}</td>
              <td class="px-4 py-3 text-sm text-[var(--text-secondary)]">{{ formatDisplayDate(form.updatedAt) }}</td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="6" class="px-4 py-10">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">inventory_2</span>
                    </div>
                    <p class="app-state-title">{{ loadingForms ? 'Đang tải danh sách biểu mẫu...' : 'Chưa có biểu mẫu QC nào.' }}</p>
                    <p class="app-state-body">{{ loadingForms ? 'Danh sách biểu mẫu sẽ xuất hiện sau khi tải xong.' : 'Tạo biểu mẫu mới để bắt đầu xây dựng checklist QC cho hệ thống.' }}</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination :page="currentPage" :page-count="pageCount" :page-size="pageSize" :page-size-options="pageSizeOptions" :total="summaryTotalForms" :loading="loadingForms" item-label="biểu mẫu" @update:page="goToPage" @update:page-size="changePageSize" />
    </section>
  </div>
</template>
