<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAdminQcForms } from '@/services/admin_service'

const router = useRouter()

const loadingForms = ref(false)
const formsError = ref('')
const qcForms = ref([])
const searchInput = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalForms = ref(0)
const pageCount = ref(1)

const statusFilterSelectConfig = JSON.stringify({
  placeholder: 'Tất cả trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-slate-200 bg-white ps-3 pe-9 text-start text-sm text-slate-700 focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[90] w-full max-h-72 p-1 space-y-0.5 bg-white border border-slate-200 rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-slate-900" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const normalizedSearch = computed(() => String(searchInput.value || '').trim().toLowerCase())
const hasLocalFilters = computed(() => Boolean(normalizedSearch.value || statusFilter.value))

const displayForms = computed(() => {
  return qcForms.value.filter((form) => {
    const status = form.hasLatestVersion
      ? String(form.latestVersionStatus || 'draft').toLowerCase()
      : 'no_version'

    if (statusFilter.value && status !== statusFilter.value) return false

    const keyword = normalizedSearch.value
    if (!keyword) return true

    return (
      String(form.code || '').toLowerCase().includes(keyword)
      || String(form.name || '').toLowerCase().includes(keyword)
      || String(form.description || '').toLowerCase().includes(keyword)
      || String(form.latestVersionNo || '').toLowerCase().includes(keyword)
    )
  })
})

const summaryTotalForms = computed(() => (hasLocalFilters.value ? displayForms.value.length : totalForms.value))

const rangeStart = computed(() => {
  if (!displayForms.value.length) return 0
  if (hasLocalFilters.value) return 1
  return (currentPage.value - 1) * pageSize.value + 1
})

const rangeEnd = computed(() => {
  if (!displayForms.value.length) return 0
  if (hasLocalFilters.value) return displayForms.value.length
  return rangeStart.value + displayForms.value.length - 1
})

const visiblePageItems = computed(() => {
  const total = pageCount.value
  const page = currentPage.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'end-ellipsis', total]
  }

  if (page >= total - 3) {
    return [1, 'start-ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'start-ellipsis', page - 1, page, page + 1, 'end-ellipsis', total]
})

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
  if (normalized === 'published') return 'Đang phát hành'
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

const openEditPage = (formId) => {
  if (!formId) return
  router.push(`/tools/qc-forms/${formId}/edit`)
}

const goToPage = async (page) => {
  if (loadingForms.value) return
  if (page < 1 || page > pageCount.value || page === currentPage.value) return
  await loadQcForms(page)
}

onMounted(async () => {
  await loadQcForms()
  await initAdminFilterSelects()
})
</script>

<template>
  <div class="page-stack space-y-4 p-4 tablet:p-5 pc:p-6">
    <section class="rounded-xl border border-slate-200 bg-white">
      <div class="space-y-4 border-b border-slate-200 px-4 py-4 tablet:px-5">
        <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-900">Danh sách biểu mẫu QC</h3>
          </div>

          <div class="grid w-full grid-cols-1 gap-3 tablet:w-auto tablet:grid-cols-[minmax(280px,1fr)_190px_auto] tablet:items-center tablet:justify-end">
            <input
              v-model="searchInput"
              type="text"
              class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-hidden focus:ring-0"
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
              <option value="published">Đang phát hành</option>
              <option value="archived">Lưu trữ</option>
              <option value="no_version">Chưa có version</option>
            </select>

            <button
              type="button"
              class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 tablet:w-auto"
              @click="openCreatePage"
            >
              Tạo biểu mẫu
            </button>
          </div>
        </div>

        <p v-if="hasLocalFilters" class="text-xs text-slate-400">
          Bộ lọc hiện áp dụng trên các bản ghi của trang hiện tại.
        </p>
      </div>

      <p v-if="formsError" class="app-state-banner m-4 mb-0">
        {{ formsError }}
      </p>

      <div class="overflow-x-auto">
        <table class="min-w-[920px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-slate-50">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mã biểu mẫu</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tên biểu mẫu</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Version mới nhất</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Cập nhật</th>
              <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
            </tr>
          </thead>

          <tbody v-if="displayForms.length" class="divide-y divide-slate-100">
            <tr
              v-for="form in displayForms"
              :key="form.id"
              class="cursor-pointer transition-colors hover:bg-slate-50/80"
              @click="openFormDetail(form.id)"
            >
              <td class="px-4 py-3 text-sm font-semibold text-slate-900">{{ form.code }}</td>
              <td class="px-4 py-3">
                <p class="text-sm font-medium text-slate-900">{{ form.name }}</p>
                <p class="text-xs text-slate-500">{{ form.description || 'Không có mô tả' }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-slate-600">{{ form.latestVersionNo || '--' }}</td>
              <td class="px-4 py-3">
                <span class="app-badge inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(form.latestVersionStatus, form.hasLatestVersion)">
                  {{ statusLabel(form.latestVersionStatus, form.hasLatestVersion) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-slate-500">{{ formatDisplayDate(form.updatedAt) }}</td>
              <td class="px-4 py-3 text-end">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  @click.stop="openEditPage(form.id)"
                >
                  Chỉnh sửa
                </button>
              </td>
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

      <div class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <p class="text-sm text-slate-500">
          Hiển thị
          <span class="font-semibold text-slate-800">{{ rangeStart }}-{{ rangeEnd }}</span>
          trong
          <span class="font-semibold text-slate-800">{{ summaryTotalForms }}</span>
          kết quả
        </p>

        <div class="flex max-w-full items-center justify-between gap-3 tablet:justify-end">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            :disabled="currentPage <= 1 || loadingForms"
            @click="goToPage(currentPage - 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div class="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
            <template v-for="item in visiblePageItems" :key="String(item)">
              <button
                v-if="typeof item === 'number'"
                type="button"
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                :class="item === currentPage ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'"
                :disabled="item === currentPage || loadingForms"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
              <span v-else class="px-1 text-xs text-slate-400">...</span>
            </template>
          </div>

          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            :disabled="currentPage >= pageCount || loadingForms || pageCount === 0"
            @click="goToPage(currentPage + 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
