<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FileUploadItem from '@/components/FileUploadItem.vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import { createTicket, getActiveDepartments, getTicketById, updateTicket, uploadTicketAttachments } from '@/services/ticket_service'

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()

const pageLoading = ref(true)
const submitting = ref(false)
const departments = ref([])
const formError = ref('')
const formData = reactive({
  store_id: '',
  title: '',
  description: '',
  responsible_department_id: '',
  type: '',
  attachments_media: [],
})

const errors = reactive({
  store_id: '',
  title: '',
  description: '',
  responsible_department_id: '',
})

function normalizeStoreOption(rawStore) {
  const storeId = Number(
    rawStore?.storeId ||
    rawStore?.store_id ||
    rawStore?.id ||
    rawStore?.value
  )
  if (!Number.isInteger(storeId) || storeId <= 0) return null

  const label = String(
    rawStore?.shortAddress ||
    rawStore?.short_address ||
    rawStore?.store_name ||
    rawStore?.name ||
    rawStore?.address ||
    rawStore?.code ||
    rawStore?.label ||
    ''
  ).trim()

  return {
    value: String(storeId),
    label: label || `Cửa hàng ${storeId}`,
  }
}

const availableStores = computed(() => {
  const userStores = Array.isArray(state.userInfo?.stores)
    ? state.userInfo.stores
    : (Array.isArray(state.userInfo?.store_list)
      ? state.userInfo.store_list
      : (Array.isArray(state.userInfo?.list_store) ? state.userInfo.list_store : []))

  const normalized = userStores
    .map(normalizeStoreOption)
    .filter(Boolean)

  if (normalized.length > 0) {
    return normalized
  }

  const fallbackId = Number(state.userInfo?.store_id || import.meta.env.VITE_DEFAULT_STORE_ID || 0)
  if (Number.isInteger(fallbackId) && fallbackId > 0) {
    return [
      {
        value: String(fallbackId),
        label: state.userInfo?.store_name || import.meta.env.VITE_DEFAULT_STORE_NAME || `Cửa hàng ${fallbackId}`,
      },
    ]
  }

  return []
})

const requesterName = computed(() => state.userInfo?.name || '')
const requesterEmail = computed(() => state.userInfo?.email || '')
const editTicketId = computed(() => Number(route.params.id || 0))
const isEditMode = computed(() => Number.isInteger(editTicketId.value) && editTicketId.value > 0)
const pageTitle = computed(() => (isEditMode.value ? 'Chỉnh sửa yêu cầu' : 'Tạo yêu cầu'))
const pageDescription = computed(() => (
  isEditMode.value
    ? 'Cập nhật lại nội dung yêu cầu trước khi lưu thay đổi.'
    : 'Điền thông tin cần thiết để gửi yêu cầu tới bộ phận phụ trách.'
))
const submitButtonText = computed(() => {
  if (submitting.value) {
    return isEditMode.value ? 'Đang lưu...' : 'Đang gửi...'
  }
  return isEditMode.value ? 'Lưu thay đổi' : 'Gửi yêu cầu'
})

const issueTypes = [
  { label: 'Sự cố hệ thống', value: 'system_issue' },
  { label: 'Sự cố vận hành', value: 'operation_issue' },
  { label: 'Yêu cầu hỗ trợ', value: 'support_request' },
  { label: 'Khác', value: 'other' },
]

function clearErrors() {
  errors.store_id = ''
  errors.title = ''
  errors.description = ''
  errors.responsible_department_id = ''
  formError.value = ''
}

function validateForm() {
  clearErrors()

  if (!formData.store_id) {
    errors.store_id = 'Vui lòng chọn cửa hàng'
  }

  if (!formData.title.trim()) {
    errors.title = 'Vui lòng nhập tiêu đề'
  }

  if (!formData.description.trim()) {
    errors.description = 'Vui lòng nhập nội dung'
  }

  if (!formData.responsible_department_id) {
    errors.responsible_department_id = 'Vui lòng chọn bộ phận xử lý'
  }

  return !errors.store_id && !errors.title && !errors.description && !errors.responsible_department_id && !formError.value
}

async function fetchDepartments() {
  const result = await getActiveDepartments()
  departments.value = result?.data?.departments || []
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
}

async function fetchTicketForEdit() {
  if (!isEditMode.value) return

  const result = await getTicketById(editTicketId.value)
  const ticket = result?.data?.ticket

  if (!ticket?.id) {
    throw new Error('Không tìm thấy ticket để chỉnh sửa.')
  }

  formData.title = ticket.title || ''
  formData.description = ticket.description || ''
  formData.store_id = ticket.store_id ? String(ticket.store_id) : ''
  formData.responsible_department_id = ticket.responsible_department?.id ? String(ticket.responsible_department.id) : ''
  formData.type = ticket.type || ''
  formData.attachments_media = Array.isArray(ticket.attachments_media) ? ticket.attachments_media : []
  await nextTick()
  syncPrelineSelectValue('ticket-store', formData.store_id)
  syncPrelineSelectValue('ticket-department', formData.responsible_department_id)
  syncPrelineSelectValue('ticket-type', formData.type)
}

function syncPrelineSelectValue(elementId, value) {
  const selectElement = document.getElementById(elementId)
  if (!selectElement) return

  const normalizedValue = value ? String(value) : ''
  selectElement.value = normalizedValue

  const hsSelect = window.HSSelect?.getInstance?.(selectElement, true)
  if (hsSelect?.element?.setValue) {
    hsSelect.element.setValue(normalizedValue)
  }
}

async function submitTicket() {
  if (submitting.value || !validateForm()) {
    return
  }

  submitting.value = true
  formError.value = ''

  try {
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      store_id: Number(formData.store_id),
      responsible_department_id: Number(formData.responsible_department_id),
      type: formData.type || null,
      attachment_file_ids: formData.attachments_media
        .map((file) => Number(file?.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    }

    const result = isEditMode.value
      ? await updateTicket(editTicketId.value, payload)
      : await createTicket(payload)

    const successMsg = result?.message || (isEditMode.value ? 'Cập nhật yêu cầu thành công' : 'Tạo yêu cầu thành công')
    toast.success(successMsg)
    await new Promise((resolve) => setTimeout(resolve, 220))
    await router.push('/ticket')
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || (isEditMode.value
      ? 'Không thể cập nhật yêu cầu. Vui lòng thử lại.'
      : 'Không thể tạo yêu cầu. Vui lòng thử lại.')
    formError.value = message
    toast.error(message)
  } finally {
    submitting.value = false
  }
}

const handleTicketUpload = async (formData) => {
  const result = await uploadTicketAttachments(formData)
  return result?.data?.files?.[0] || result?.files?.[0]
}

function goBack() {
  router.back()
}

onMounted(async () => {
  pageLoading.value = true
  try {
    await fetchDepartments()
    await fetchTicketForEdit()
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu ticket.'
  } finally {
    await nextTick()
    if (window.HSStaticMethods?.autoInit) {
      window.HSStaticMethods.autoInit()
    }
    syncPrelineSelectValue('ticket-store', formData.store_id)
    if (isEditMode.value) {
      syncPrelineSelectValue('ticket-department', formData.responsible_department_id)
      syncPrelineSelectValue('ticket-type', formData.type)
    }
    pageLoading.value = false
  }
})

watch(
  () => availableStores.value,
  async (stores) => {
    if (!Array.isArray(stores) || stores.length === 0) return

    const current = String(formData.store_id || '')
    const existsInOptions = stores.some((store) => store.value === current)
    if (existsInOptions) {
      await nextTick()
      syncPrelineSelectValue('ticket-store', current)
      return
    }

    const preferred = String(state.userInfo?.store_id || '')
    const preferredExists = stores.some((store) => store.value === preferred)
    formData.store_id = preferredExists ? preferred : stores[0].value
    await nextTick()
    syncPrelineSelectValue('ticket-store', formData.store_id)
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="page-stack mx-2 overflow-visible space-y-4 sm:mx-3 md:mx-0">
    <div class="flex min-w-0 items-start gap-3">
      <button
        type="button"
        class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        aria-label="Quay lại danh sách ticket"
        @click="goBack"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      </button>
      <div class="min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {{ isEditMode ? 'Cập nhật ticket' : 'Ticket mới' }}
        </p>
        <h1 class="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
      </div>
    </div>

    <div>
      <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden transition-all duration-200" :class="submitting ? 'shadow-md' : ''" v-loading="pageLoading">
        <form @submit.prevent="submitTicket">
          <div class="bg-white rounded-xl shadow-xs">
            <div class="p-4 sm:p-7">
              <div class="space-y-4 sm:space-y-6">
                <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {{ formError }}
                </div>

                <h2 class="text-xl font-semibold text-gray-800 mt-1">Người tạo yêu cầu</h2>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                  <div class="space-y-2">
                    <label for="requester-name" class="block text-sm text-gray-700 font-medium">Tên</label>
                    <input id="requester-name" type="text" class="py-2.5 sm:py-3 px-4 block w-full border border-gray-200 rounded-lg sm:text-sm bg-slate-50 text-slate-700" :value="requesterName" readonly />
                  </div>

                  <div class="space-y-2">
                    <label for="requester-email" class="block text-sm text-gray-700 font-medium">Email</label>
                    <input id="requester-email" type="text" class="py-2.5 sm:py-3 px-4 block w-full border border-gray-200 rounded-lg sm:text-sm bg-slate-50 text-slate-700" :value="requesterEmail" readonly />
                  </div>
                </div>

                <div class="space-y-2">
                  <label for="ticket-store" class="inline-block text-sm font-medium text-gray-800">Cửa hàng <span class="text-red-500">*</span></label>
                  <select
                    id="ticket-store"
                    v-model="formData.store_id"
                    class="hidden"
                    data-hs-select='{
                      "placeholder": "Chọn cửa hàng",
                      "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                      "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 sm:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden",
                      "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto",
                      "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden",
                      "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                      "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-gray-500\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                    }'
                  >
                    <option value="">Chọn cửa hàng</option>
                    <option v-for="store in availableStores" :key="store.value" :value="store.value">
                      {{ store.label }}
                    </option>
                  </select>
                  <p v-if="errors.store_id" class="text-xs text-red-600">{{ errors.store_id }}</p>
                </div>

                <h2 class="text-xl font-semibold text-gray-800 mt-3">Chi tiết yêu cầu</h2>

                <div class="space-y-2">
                  <label for="ticket-title" class="inline-block text-sm font-medium text-gray-800">Tiêu đề <span class="text-red-500">*</span></label>
                  <input
                    id="ticket-title"
                    v-model="formData.title"
                    type="text"
                    class="py-2.5 sm:py-3 px-4 block w-full border rounded-lg sm:text-sm disabled:opacity-50 disabled:pointer-events-none"
                    :class="errors.title ? 'border-red-300' : 'border-gray-200'"
                    placeholder="Nhập tiêu đề"
                  />
                  <p v-if="errors.title" class="text-xs text-red-600">{{ errors.title }}</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                  <div class="space-y-2">
                    <label for="ticket-department" class="inline-block text-sm font-medium text-gray-800">Bộ phận <span class="text-red-500">*</span></label>
                    <select
                      id="ticket-department"
                      v-model="formData.responsible_department_id"
                      class="hidden"
                      data-hs-select='{
                        "placeholder": "Chọn bộ phận xử lý",
                        "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                        "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 sm:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden",
                        "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto",
                        "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden",
                        "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                        "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-gray-500\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                      }'
                    >
                      <option value="">Chọn bộ phận xử lý</option>
                      <option v-for="department in departments" :key="department.id" :value="department.id">
                        {{ department.name }}
                      </option>
                    </select>
                    <p v-if="errors.responsible_department_id" class="text-xs text-red-600">{{ errors.responsible_department_id }}</p>
                  </div>

                  <div class="space-y-2">
                    <label for="ticket-type" class="inline-block text-sm font-medium text-gray-800">Phân loại</label>
                    <select
                      id="ticket-type"
                      v-model="formData.type"
                      class="hidden"
                      data-hs-select='{
                        "placeholder": "Chọn loại yêu cầu",
                        "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                        "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 sm:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden",
                        "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto",
                        "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden",
                        "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                        "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-gray-500\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                      }'
                    >
                      <option value="">Chọn loại yêu cầu</option>
                      <option v-for="type in issueTypes" :key="type.value" :value="type.value">
                        {{ type.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="space-y-2">
                  <label for="ticket-description" class="inline-block text-sm font-medium text-gray-800">Nội dung <span class="text-red-500">*</span></label>
                  <textarea
                    id="ticket-description"
                    v-model="formData.description"
                    class="py-2 sm:py-2.5 px-3 block w-full border rounded-lg sm:text-sm disabled:opacity-50 disabled:pointer-events-none"
                    :class="errors.description ? 'border-red-300' : 'border-gray-200'"
                    rows="6"
                    placeholder="Nhập nội dung ..."
                  ></textarea>
                  <p v-if="errors.description" class="text-xs text-red-600">{{ errors.description }}</p>
                </div>

                <div class="space-y-2">
                  <label class="inline-block text-sm font-medium text-gray-800">Hình ảnh đính kèm</label>
                  <FileUploadItem v-model="formData.attachments_media" :upload-handler="handleTicketUpload" />
                </div>
              </div>

              <div class="mt-6 flex justify-end gap-x-2">
                <button
                  type="button"
                  class="py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-blue-600 text-blue-600 hover:border-blue-700 hover:text-blue-700 focus:outline-hidden focus:border-blue-700 focus:text-blue-700 disabled:opacity-50"
                  :disabled="submitting"
                  @click="goBack"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  class="py-3 px-4 inline-flex min-w-[148px] justify-center items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  :disabled="submitting || pageLoading"
                >
                  <span v-if="submitting" class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  <span>{{ submitButtonText }}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
