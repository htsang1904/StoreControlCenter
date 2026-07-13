<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FileUploadItem from '@/components/FileUploadItem.vue'
import TicketCreateChat from '@/components/ticket-chat-create/TicketCreateChat.vue'
import { useTicketCreateChat } from '@/composables/useTicketCreateChat'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import { createTicket, getActiveDepartments, getTicketById, updateTicket, uploadTicketAttachments } from '@/services/ticket_service'

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()

const chatState = useTicketCreateChat()

const pageLoading = ref(true)
const submitting = ref(false)
const departments = ref([])
const formError = ref('')
const editTicketStoreOption = ref(null)
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
  const storeId = String(
    rawStore?.storeId ||
    rawStore?.store_id ||
    rawStore?.id ||
    rawStore?.value ||
    ''
  ).trim()
  if (!storeId) return null

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
    value: storeId,
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

  const options = [...normalized]
  if (editTicketStoreOption.value?.value && !options.some((store) => store.value === editTicketStoreOption.value.value)) {
    options.unshift(editTicketStoreOption.value)
  }

  if (options.length > 0) {
    return options
  }

  const fallbackId = String(state.userInfo?.store_id || import.meta.env.VITE_DEFAULT_STORE_ID || '').trim()
  if (fallbackId) {
    return [
      {
        value: fallbackId,
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

function ticketStoreOption(ticket) {
  const storeId = String(ticket?.store?.storeId || ticket?.store_id || '').trim()
  if (!storeId) return null

  const label = String(
    ticket?.store?.shortAddress ||
    ticket?.store?.short_address ||
    ticket?.store?.name ||
    ticket?.store?.address ||
    ticket?.store?.code ||
    ticket?.store_name ||
    ''
  ).trim()

  return {
    value: storeId,
    label: label || `Cửa hàng ${storeId}`,
  }
}

async function fetchDepartments() {
  const result = await getActiveDepartments()
  const records = result?.data?.departments || result?.data || []
  departments.value = Array.isArray(records) ? records : []
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
}

async function fetchTicketForEdit() {
  if (!isEditMode.value) return

  const result = await getTicketById(editTicketId.value)
  const ticket = result?.data?.ticket || result?.data

  if (!ticket?.id) {
    throw new Error('Không tìm thấy ticket để chỉnh sửa.')
  }

  formData.title = ticket.title || ''
  formData.description = ticket.description || ''
  formData.store_id = String(ticket?.store?.storeId || ticket?.store_id || '').trim()
  editTicketStoreOption.value = ticketStoreOption(ticket)
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
      store_id: String(formData.store_id || '').trim(),
      responsible_department_id: Number(formData.responsible_department_id),
      type: formData.type || null,
      attachments_media: Array.isArray(formData.attachments_media)
        ? formData.attachments_media.map((file) => ({
          id: file?.id,
          name: file?.name,
          url: file?.url,
          size: file?.size,
          mime: file?.mime,
          ext: file?.ext,
          formats: file?.formats || null,
        }))
        : [],
    }

    const result = isEditMode.value
      ? await updateTicket(editTicketId.value, payload)
      : await createTicket(payload)

    const successMsg = result?.message || (isEditMode.value ? 'Cập nhật yêu cầu thành công' : 'Tạo yêu cầu thành công')
    toast.success(successMsg)
    await new Promise((resolve) => setTimeout(resolve, 220))
    if (isEditMode.value && route.query.returnTo === 'inbox') {
      await router.push({ path: '/ticket/inbox', query: { ticket: String(editTicketId.value) } })
      return
    }

    const targetRoute = isEditMode.value ? '/ticket' : '/ticket/inbox'
    await router.push(targetRoute)
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

function onTicketCreated(ticketId) {
  if (ticketId) {
    router.push({ path: '/ticket/inbox', query: { ticket: ticketId } })
  } else {
    router.push('/ticket/inbox')
  }
}

onMounted(async () => {
  pageLoading.value = true
  try {
    await fetchDepartments()
    await fetchTicketForEdit()
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu ticket.'
    toast.error(formError.value)
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
  <!-- Ticket Creation Chat Assistant (Full View) -->
  <template v-if="!isEditMode">
    <div class="h-[calc(100vh-64px)] w-full overflow-hidden bg-[var(--surface-muted)] tablet:h-[calc(100vh-80px)]">
      <TicketCreateChat :chat-state="chatState" @close="goBack" @ticket-created="onTicketCreated" />
    </div>
  </template>

  <!-- Edit Ticket Form (Standard Page Stack Layout) -->
  <template v-else>
    <div class="app-page page-stack overflow-visible">
      <div class="flex min-w-0 items-start gap-3">
        <button
          type="button"
          class="app-button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Quay lại danh sách ticket"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div class="min-w-0">
          <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Cập nhật ticket
          </p>
          <h1 class="app-page-title mt-1">{{ pageTitle }}</h1>
          <p class="app-page-subtitle">{{ pageDescription }}</p>
        </div>
      </div>

      <div>
        <div class="app-section" v-loading="pageLoading">
          <form @submit.prevent="submitTicket">
            <div class="p-4 tablet:p-5 pc:p-6">
              <div class="space-y-5">
                <div>
                  <h2 class="text-base font-semibold text-[var(--text-primary)]">Người tạo yêu cầu</h2>
                  <p class="mt-1 text-sm text-[var(--text-secondary)]">Thông tin người gửi được lấy từ tài khoản hiện tại.</p>
                </div>

                <div class="grid grid-cols-1 gap-4 tablet:grid-cols-2 pc:gap-6">
                  <div class="space-y-2">
                    <label for="requester-name" class="block text-sm text-[var(--text-secondary)] font-medium">Tên</label>
                    <input id="requester-name" type="text" class="app-input app-input--muted py-2.5 tablet:py-3 px-4 block w-full rounded-lg tablet:text-sm" :value="requesterName" readonly />
                  </div>

                  <div class="space-y-2">
                    <label for="requester-email" class="block text-sm text-[var(--text-secondary)] font-medium">Email</label>
                    <input id="requester-email" type="text" class="app-input app-input--muted py-2.5 tablet:py-3 px-4 block w-full rounded-lg tablet:text-sm" :value="requesterEmail" readonly />
                  </div>
                </div>

                <div class="space-y-2 border-t border-[var(--stroke)] pt-5">
                  <label for="ticket-store" class="inline-block text-sm font-medium text-[var(--text-primary)]">Cửa hàng <span class="text-[var(--danger-text)]">*</span></label>
                  <select
                    id="ticket-store"
                    v-model="formData.store_id"
                    class="hidden"
                    data-hs-select='{
                      "placeholder": "Chọn cửa hàng",
                      "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                      "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 tablet:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-[var(--stroke)] rounded-lg text-start text-sm focus:outline-hidden",
                      "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto",
                      "optionClasses": "py-2 px-4 w-full text-sm text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-lg focus:outline-hidden",
                      "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-[var(--text-primary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                      "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-[var(--text-secondary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                    }'
                  >
                    <option value="">Chọn cửa hàng</option>
                    <option v-for="store in availableStores" :key="store.value" :value="store.value">
                      {{ store.label }}
                    </option>
                  </select>
                  <p v-if="errors.store_id" class="app-field-error">{{ errors.store_id }}</p>
                </div>

                <h2 class="text-xl font-semibold text-[var(--text-primary)] mt-3">Chi tiết yêu cầu</h2>

                <div class="space-y-2">
                  <label for="ticket-title" class="inline-block text-sm font-medium text-[var(--text-primary)]">Tiêu đề <span class="text-[var(--danger-text)]">*</span></label>
                  <input
                    id="ticket-title"
                    v-model="formData.title"
                    type="text"
                    class="app-input py-2.5 tablet:py-3 px-4 block w-full rounded-lg tablet:text-sm disabled:opacity-50 disabled:pointer-events-none"
                    :class="errors.title ? 'app-input-invalid' : ''"
                    placeholder="Nhập tiêu đề"
                  />
                  <p v-if="errors.title" class="app-field-error">{{ errors.title }}</p>
                </div>

                <div class="grid grid-cols-1 gap-4 border-t border-[var(--stroke)] pt-5 tablet:grid-cols-2 pc:gap-6">
                  <div class="space-y-2">
                    <label for="ticket-department" class="inline-block text-sm font-medium text-[var(--text-primary)]">Bộ phận <span class="text-[var(--danger-text)]">*</span></label>
                    <select
                      id="ticket-department"
                      v-model="formData.responsible_department_id"
                      class="hidden"
                      data-hs-select='{
                        "placeholder": "Chọn bộ phận xử lý",
                        "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                        "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 tablet:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-[var(--stroke)] rounded-lg text-start text-sm focus:outline-hidden",
                        "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto",
                        "optionClasses": "py-2 px-4 w-full text-sm text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-lg focus:outline-hidden",
                        "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-[var(--text-primary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                        "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-[var(--text-secondary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                      }'
                    >
                      <option value="">Chọn bộ phận xử lý</option>
                      <option v-for="department in departments" :key="department.id" :value="department.id">
                        {{ department.name }}
                      </option>
                    </select>
                    <p v-if="errors.responsible_department_id" class="app-field-error">{{ errors.responsible_department_id }}</p>
                  </div>

                  <div class="space-y-2">
                    <label for="ticket-type" class="inline-block text-sm font-medium text-[var(--text-primary)]">Phân loại</label>
                    <select
                      id="ticket-type"
                      v-model="formData.type"
                      class="hidden"
                      data-hs-select='{
                        "placeholder": "Chọn loại yêu cầu",
                        "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                        "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 tablet:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-[var(--stroke)] rounded-lg text-start text-sm focus:outline-hidden",
                        "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-lg overflow-hidden overflow-y-auto",
                        "optionClasses": "py-2 px-4 w-full text-sm text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-lg focus:outline-hidden",
                        "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-[var(--text-primary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                        "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-[var(--text-secondary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                      }'
                    >
                      <option value="">Chọn loại yêu cầu</option>
                      <option v-for="type in issueTypes" :key="type.value" :value="type.value">
                        {{ type.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="space-y-2 border-t border-[var(--stroke)] pt-5">
                  <label for="ticket-description" class="inline-block text-sm font-medium text-[var(--text-primary)]">Nội dung <span class="text-[var(--danger-text)]">*</span></label>
                  <textarea
                    id="ticket-description"
                    v-model="formData.description"
                    class="app-input py-2 tablet:py-2.5 px-3 block w-full rounded-lg tablet:text-sm disabled:opacity-50 disabled:pointer-events-none"
                    :class="errors.description ? 'app-input-invalid' : ''"
                    rows="6"
                    placeholder="Nhập nội dung ..."
                  ></textarea>
                  <p v-if="errors.description" class="app-field-error">{{ errors.description }}</p>
                </div>

                <div class="space-y-2">
                  <label class="inline-block text-sm font-medium text-[var(--text-primary)]">Hình ảnh đính kèm</label>
                  <FileUploadItem v-model="formData.attachments_media" :upload-handler="handleTicketUpload" />
                </div>
              </div>

              <div class="app-page-header mt-6 border-t border-[var(--stroke)] pt-5 tablet:items-center">
                <p class="text-sm text-[var(--text-secondary)]">Kiểm tra lại nội dung trước khi lưu thay đổi.</p>
                <div class="app-toolbar flex-col-reverse tablet:justify-end">
                <button
                  type="button"
                  class="app-button-secondary inline-flex w-full items-center justify-center gap-x-2 rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 tablet:w-auto"
                  :disabled="submitting"
                  @click="goBack"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  class="app-button-primary inline-flex w-full items-center justify-center gap-x-2 rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 tablet:min-w-[148px] tablet:w-auto"
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
</template>

<style scoped></style>
