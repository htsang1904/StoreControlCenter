<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from '@/plugins/toast'
import {
  createAdminStore,
  listAdminStores,
  syncStoresNow,
  updateAdminStore,
} from '@/services/admin_service'

const toast = useToast()

const loadingStores = ref(false)
const savingStore = ref(false)
const syncingStores = ref(false)
const loadError = ref('')

const stores = ref([])
const currentPage = ref(1)
const pageSize = ref(12)
const totalStores = ref(0)
const pageCount = ref(1)

const searchInput = ref('')
const statusFilter = ref('')
const lastSyncSummary = ref(null)

const modalMode = ref('')
const editingStoreId = ref(null)
const storeForm = reactive({
  storeId: '',
  code: '',
  name: '',
  address: '',
  shortAddress: '',
  brandId: '',
  isActive: true,
})

const isModalOpen = computed(() => modalMode.value === 'create' || modalMode.value === 'edit')
const modalTitle = computed(() => (modalMode.value === 'edit' ? 'Cập nhật cửa hàng' : 'Tạo cửa hàng mới'))

const statusFilterSelectConfig = JSON.stringify({
  placeholder: 'Tất cả trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-slate-200 bg-white ps-3 pe-9 text-start text-sm text-slate-700 focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[90] w-full max-h-72 p-1 space-y-0.5 bg-white border border-slate-200 rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-blue-950" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const editStatusSelectConfig = JSON.stringify({
  placeholder: 'Chọn trạng thái',
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-9 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-lg border border-slate-200 bg-white ps-3 pe-9 text-start text-sm text-slate-700 focus:outline-hidden',
  dropdownClasses: 'mt-2 z-[100] w-full max-h-72 p-1 space-y-0.5 bg-white border border-slate-200 rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-3 w-full text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded-md focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full gap-2"><span data-title class="truncate"></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-blue-950" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})

const rangeStart = computed(() => {
  if (!stores.value.length) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const rangeEnd = computed(() => {
  if (!stores.value.length) return 0
  return rangeStart.value + stores.value.length - 1
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

const initAdminSelects = async ({ includeModal = false } = {}) => {
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  syncPrelineSelectValue('admin-stores-status-filter', statusFilter.value)
  if (!includeModal) return
  syncPrelineSelectValue('admin-stores-edit-status', storeForm.isActive)
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

const loadStores = async (page = currentPage.value) => {
  loadingStores.value = true
  loadError.value = ''

  try {
    const response = await listAdminStores({
      page,
      pageSize: pageSize.value,
      q: searchInput.value,
      isActive: toStatusFilter(statusFilter.value),
    })
    stores.value = response.items
    currentPage.value = response.pagination.page
    totalStores.value = response.pagination.total
    pageCount.value = response.pagination.pageCount
  } catch (error) {
    stores.value = []
    totalStores.value = 0
    pageCount.value = 1
    loadError.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được danh sách cửa hàng'
  } finally {
    loadingStores.value = false
  }
}

let filterDebounceTimer = null
watch([searchInput, statusFilter], () => {
  if (filterDebounceTimer) {
    window.clearTimeout(filterDebounceTimer)
  }
  filterDebounceTimer = window.setTimeout(() => {
    void loadStores(1)
  }, 250)
})

const goToPage = async (page) => {
  if (loadingStores.value) return
  if (page < 1 || page > pageCount.value || page === currentPage.value) return
  await loadStores(page)
}

const resetForm = () => {
  storeForm.storeId = ''
  storeForm.code = ''
  storeForm.name = ''
  storeForm.address = ''
  storeForm.shortAddress = ''
  storeForm.brandId = ''
  storeForm.isActive = true
}

const openCreateModal = () => {
  resetForm()
  editingStoreId.value = null
  modalMode.value = 'create'
  void initAdminSelects({ includeModal: true })
}

const openEditModal = (store) => {
  editingStoreId.value = store.id
  storeForm.storeId = String(store.storeId || '')
  storeForm.code = String(store.code || '')
  storeForm.name = String(store.name || '')
  storeForm.address = String(store.address || '')
  storeForm.shortAddress = String(store.shortAddress || '')
  storeForm.brandId = String(store.brandId || '')
  storeForm.isActive = store.isActive === true
  modalMode.value = 'edit'
  void initAdminSelects({ includeModal: true })
}

const closeModal = () => {
  modalMode.value = ''
  editingStoreId.value = null
}

const submitStore = async () => {
  if (savingStore.value) return

  savingStore.value = true
  try {
    const payload = {
      storeId: String(storeForm.storeId || '').trim(),
      code: String(storeForm.code || '').trim(),
      name: String(storeForm.name || '').trim(),
      address: String(storeForm.address || '').trim(),
      shortAddress: String(storeForm.shortAddress || '').trim(),
      brandId: String(storeForm.brandId || '').trim(),
      isActive: Boolean(storeForm.isActive),
    }

    if (modalMode.value === 'edit' && editingStoreId.value) {
      await updateAdminStore(editingStoreId.value, payload)
      toast.success('Cập nhật cửa hàng thành công')
    } else {
      await createAdminStore(payload)
      toast.success('Tạo cửa hàng thành công')
    }

    closeModal()
    await loadStores(currentPage.value)
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể lưu thông tin cửa hàng'
    toast.error(message)
  } finally {
    savingStore.value = false
  }
}

const handleSyncStores = async () => {
  if (syncingStores.value) return

  syncingStores.value = true
  try {
    const response = await syncStoresNow()
    lastSyncSummary.value = response?.data || null
    toast.success(response?.message || 'Đồng bộ cửa hàng thành công')
    await loadStores(1)
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể đồng bộ cửa hàng'
    toast.error(message)
  } finally {
    syncingStores.value = false
  }
}

onMounted(async () => {
  await loadStores()
  await initAdminSelects()
})
</script>

<template>
  <div class="page-stack space-y-4 p-4 tablet:p-5 pc:p-6">
    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="space-y-4 border-b border-slate-200 px-4 py-4 tablet:px-5">
        <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <h3 class="text-base font-semibold text-blue-950">Danh sách cửa hàng</h3>
          </div>

          <div class="grid w-full grid-cols-1 gap-3 tablet:w-auto tablet:grid-cols-[minmax(260px,1fr)_180px_auto_auto] tablet:items-center tablet:justify-end">
            <input
              v-model="searchInput"
              type="text"
              class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-hidden focus:ring-0"
              placeholder="Tìm theo mã, tên, địa chỉ, storeId..."
            />

            <select
              id="admin-stores-status-filter"
              v-model="statusFilter"
              class="hidden"
              :data-hs-select="statusFilterSelectConfig"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm khóa</option>
            </select>

            <button
              type="button"
              class="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="syncingStores"
              @click="handleSyncStores"
            >
              {{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ từ nguồn ngoài' }}
            </button>
            <button
              type="button"
              class="inline-flex h-9 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              @click="openCreateModal"
            >
              Tạo cửa hàng
            </button>
          </div>
        </div>

        <div v-if="lastSyncSummary" class="grid grid-cols-2 gap-3 tablet:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-[11px] uppercase tracking-wide text-slate-400">Synced</p>
            <p class="mt-1 text-base font-semibold text-blue-950">{{ Number(lastSyncSummary.synced || 0) }}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-[11px] uppercase tracking-wide text-slate-400">Created</p>
            <p class="mt-1 text-base font-semibold text-blue-950">{{ Number(lastSyncSummary.created || 0) }}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-[11px] uppercase tracking-wide text-slate-400">Updated</p>
            <p class="mt-1 text-base font-semibold text-blue-950">{{ Number(lastSyncSummary.updated || 0) }}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-[11px] uppercase tracking-wide text-slate-400">Skipped</p>
            <p class="mt-1 text-base font-semibold text-blue-950">{{ Number(lastSyncSummary.skipped || 0) }}</p>
          </div>
        </div>
      </div>

      <p v-if="loadError" class="app-state-banner m-4 mb-0">
        {{ loadError }}
      </p>

      <div class="overflow-x-auto" v-loading="loadingStores">
        <table class="min-w-[960px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-slate-50">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mã</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Thông tin cửa hàng</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Store ID</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Brand ID</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</th>
              <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
            </tr>
          </thead>

          <tbody v-if="stores.length" class="divide-y divide-slate-100">
            <tr v-for="store in stores" :key="store.id" class="transition-colors hover:bg-slate-50/70">
              <td class="px-4 py-3 text-sm font-semibold text-blue-950">{{ store.code || '--' }}</td>
              <td class="px-4 py-3">
                <p class="text-sm font-semibold text-blue-950">{{ store.name || 'Chưa đặt tên' }}</p>
                <p class="text-xs text-slate-500">{{ store.shortAddress || store.address || '--' }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-slate-700">{{ store.storeId || '--' }}</td>
              <td class="px-4 py-3 text-sm text-slate-700">{{ store.brandId || '--' }}</td>
              <td class="px-4 py-3">
                <span :class="statusClass(store.isActive)">{{ statusLabel(store.isActive) }}</span>
              </td>
              <td class="px-4 py-3 text-end">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  @click="openEditModal(store)"
                >
                  Chỉnh sửa
                </button>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="6" class="px-4 py-12">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">storefront</span>
                    </div>
                    <p class="app-state-title">Không có cửa hàng phù hợp.</p>
                    <p class="app-state-body">Điều chỉnh bộ lọc hoặc tạo cửa hàng mới.</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3">
        <p class="text-sm text-slate-500">Trang {{ currentPage }} / {{ pageCount }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            Trước
          </button>
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="currentPage >= pageCount"
            @click="goToPage(currentPage + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </section>
  </div>

  <div
    v-if="isModalOpen"
    class="fixed inset-0 z-[90] flex items-center justify-center bg-blue-600/40 px-4"
    @click.self="closeModal"
  >
    <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl tablet:p-6">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-blue-950">{{ modalTitle }}</h3>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          @click="closeModal"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Store ID *</label>
          <input
            v-model="storeForm.storeId"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mã cửa hàng</label>
          <input
            v-model="storeForm.code"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div class="tablet:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tên cửa hàng *</label>
          <input
            v-model="storeForm.name"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div class="tablet:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Địa chỉ</label>
          <input
            v-model="storeForm.address"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Địa chỉ ngắn</label>
          <input
            v-model="storeForm.shortAddress"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Brand ID</label>
          <input
            v-model="storeForm.brandId"
            type="text"
            class="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-hidden focus:ring-0"
          />
        </div>

        <div class="tablet:col-span-2">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</label>
          <select
            id="admin-stores-edit-status"
            v-model="storeForm.isActive"
            class="hidden"
            :data-hs-select="editStatusSelectConfig"
          >
            <option :value="true">Đang hoạt động</option>
            <option :value="false">Tạm khóa</option>
          </select>
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          @click="closeModal"
        >
          Hủy
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="savingStore"
          @click="submitStore"
        >
          {{ savingStore ? 'Đang lưu...' : 'Lưu' }}
        </button>
      </div>
    </div>
  </div>
</template>
