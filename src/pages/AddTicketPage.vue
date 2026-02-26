<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FileUploadItem from '@/components/FileUploadItem.vue'
import { useApp } from '@/plugins/app'
import { createTicket, getActiveDepartments } from '@/services/ticket_service'

const router = useRouter()
const { state } = useApp()

const pageLoading = ref(true)
const submitting = ref(false)
const departments = ref([])
const formError = ref('')
const successMessage = ref('')

const formData = reactive({
  title: '',
  description: '',
  responsible_department_id: '',
  type: '',
})

const errors = reactive({
  title: '',
  description: '',
  responsible_department_id: '',
})

const storeId = computed(() => {
  const value = Number(state.userInfo?.store_id || import.meta.env.VITE_DEFAULT_STORE_ID || 1)
  return Number.isInteger(value) && value > 0 ? value : 0
})

const storeName = computed(() => {
  return state.userInfo?.store_name || import.meta.env.VITE_DEFAULT_STORE_NAME || 'Cửa hàng mặc định'
})

const requesterName = computed(() => state.userInfo?.name || '')
const requesterEmail = computed(() => state.userInfo?.email || '')

const issueTypes = [
  { label: 'Sự cố hệ thống', value: 'system_issue' },
  { label: 'Sự cố vận hành', value: 'operation_issue' },
  { label: 'Yêu cầu hỗ trợ', value: 'support_request' },
  { label: 'Khác', value: 'other' },
]

function clearErrors() {
  errors.title = ''
  errors.description = ''
  errors.responsible_department_id = ''
  formError.value = ''
}

function validateForm() {
  clearErrors()

  if (!formData.title.trim()) {
    errors.title = 'Vui lòng nhập tiêu đề'
  }

  if (!formData.description.trim()) {
    errors.description = 'Vui lòng nhập nội dung'
  }

  if (!formData.responsible_department_id) {
    errors.responsible_department_id = 'Vui lòng chọn bộ phận xử lý'
  }

  if (!storeId.value) {
    formError.value = 'Không xác định được cửa hàng để tạo yêu cầu.'
  }

  return !errors.title && !errors.description && !errors.responsible_department_id && !formError.value
}

async function fetchDepartments() {
  const result = await getActiveDepartments()
  departments.value = result?.data?.departments || []
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
}

async function submitTicket() {
  if (submitting.value || !validateForm()) {
    return
  }

  submitting.value = true
  formError.value = ''
  successMessage.value = ''

  try {
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      store_id: storeId.value,
      responsible_department_id: Number(formData.responsible_department_id),
      type: formData.type || null,
      attachments: [],
    }

    const result = await createTicket(payload)
    successMessage.value = result?.message || 'Tạo yêu cầu thành công'
    setTimeout(() => {
      router.push('/ticket')
    }, 500)
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || 'Không thể tạo yêu cầu. Vui lòng thử lại.'
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(async () => {
  pageLoading.value = true
  try {
    await fetchDepartments()
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || 'Không thể tải danh mục bộ phận.'
  } finally {
    await nextTick()
    if (window.HSStaticMethods?.autoInit) {
      window.HSStaticMethods.autoInit()
    }
    pageLoading.value = false
  }
})
</script>

<template>
  <div>
    <div class="header max-w-full p-2.5 text-[18px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500 flex items-center">
      <button @click="goBack" type="button" class="cursor-pointer p-1 mr-2 inline-flex items-center rounded-lg bg-white/40 text-white shadow-2xs hover:bg-white/30 focus:outline-hidden focus:bg-white/30">
        <svg class="shrink-0 size-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      Tạo yêu cầu
    </div>

    <div class="max-w-full px-4 py-4 mx-auto">
      <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden" v-loading="pageLoading || submitting">
        <form @submit.prevent="submitTicket">
          <div class="bg-white rounded-xl shadow-xs">
            <div class="p-4 sm:p-7">
              <div class="space-y-4 sm:space-y-6">
                <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {{ formError }}
                </div>

                <div v-if="successMessage" class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {{ successMessage }}
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
                  <label for="store-name" class="inline-block text-sm font-medium text-gray-800">Cửa hàng</label>
                  <input id="store-name" type="text" class="py-2.5 sm:py-3 px-4 block w-full border border-gray-200 rounded-lg sm:text-sm bg-slate-50 text-slate-700" :value="storeName" readonly />
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
                  <FileUploadItem />
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
                  class="py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50"
                  :disabled="submitting || pageLoading"
                >
                  <span v-if="submitting" class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  <span>{{ submitting ? 'Đang gửi...' : 'Gửi yêu cầu' }}</span>
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
