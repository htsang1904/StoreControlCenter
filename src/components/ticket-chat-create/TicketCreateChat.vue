<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CHAT_STEPS } from '@/composables/useTicketCreateChat'
import FileUploadItem from '@/components/FileUploadItem.vue'
import { getActiveDepartments, createTicket, uploadTicketAttachments } from '@/services/ticket_service'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const props = defineProps({
  chatState: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'ticket-created'])

const { state, syncUserStores } = useApp()
const toast = useToast()

const {
  currentStep,
  formData,
  messages,
  resetState,
  addMessage,
  selectTicketType,
  selectStore,
  selectDepartment,
  submitContent
} = props.chatState

// Data from API
const availableStores = computed(() => {
  const userStores = Array.isArray(state.userInfo?.stores)
    ? state.userInfo.stores
    : (Array.isArray(state.userInfo?.store_list)
      ? state.userInfo.store_list
      : (Array.isArray(state.userInfo?.list_store) ? state.userInfo.list_store : []))

  const normalized = userStores
    .map(s => {
      const rawValue = s?.storeId || s?.store_id || s?.id || s?.value
      const id = String(rawValue || '').trim()
      if (!id) return null
      const label = String(s?.shortAddress || s?.short_address || s?.store_name || s?.name || s?.address || s?.code || s?.label || '').trim()
      return { value: id, label: label || `Cửa hàng ${id}` }
    })
    .filter(Boolean)

  if (normalized.length > 0) return normalized

  const fallbackId = String(state.userInfo?.store_id || import.meta.env.VITE_DEFAULT_STORE_ID || '').trim()
  if (fallbackId) {
    return [{ value: fallbackId, label: state.userInfo?.store_name || import.meta.env.VITE_DEFAULT_STORE_NAME || `Cửa hàng ${fallbackId}` }]
  }
  return []
})

const departments = ref([])
const loadingDeps = ref(false)

const chatContainerRef = ref(null)

// Store search
const searchStoreQuery = ref('')

const filteredStores = computed(() => {
  if (!searchStoreQuery.value.trim()) return availableStores.value
  const query = searchStoreQuery.value.toLowerCase()
  return availableStores.value.filter(store => store.label.toLowerCase().includes(query))
})

// Content inputs
const inputDescription = ref('')
const inputAttachments = ref([])

onMounted(async () => {
  resetState()
  loadingDeps.value = true
  try {
    const syncStoresTask = typeof syncUserStores === 'function'
      ? syncUserStores().catch(err => console.warn('Failed to sync stores:', err))
      : Promise.resolve()

    const [result] = await Promise.all([
      getActiveDepartments(),
      syncStoresTask
    ])
    const records = result?.data?.departments || result?.data || []
    departments.value = Array.isArray(records) ? records : []
  } catch (error) {
    console.error('Failed to load departments', error)
  } finally {
    loadingDeps.value = false
  }
})

watch(() => messages.value.length, async () => {
  await nextTick()
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
})

const ticketTypes = [
  { value: 'thay_moi', label: 'Thay mới' },
  { value: 'sua_chua', label: 'Sửa chữa' }
]

function handleSelectTicketType(type) {
  if (currentStep.value !== CHAT_STEPS.SELECT_TICKET_TYPE) return
  selectTicketType(type.value, type.label)
}

function handleSelectStore(store) {
  if (currentStep.value !== CHAT_STEPS.SELECT_STORE) return
  selectStore(store.value, store.label)
}

function handleSelectDepartment(dept) {
  if (currentStep.value !== CHAT_STEPS.SELECT_DEPARTMENT) return
  selectDepartment(dept.id, dept.name)
}

function handleContentSubmit() {
  if (currentStep.value !== CHAT_STEPS.INPUT_CONTENT) return
  if (!inputDescription.value.trim()) {
    toast.error('Vui lòng nhập nội dung chi tiết.')
    return
  }
  submitContent(inputDescription.value, inputAttachments.value)
}

const handleTicketUpload = async (fileData) => {
  const result = await uploadTicketAttachments(fileData)
  return result?.data?.files?.[0] || result?.files?.[0]
}

function removeAttachment(index) {
  if (Array.isArray(inputAttachments.value)) {
    inputAttachments.value.splice(index, 1)
  }
}

const isSubmitting = ref(false)

async function handleConfirm() {
  if (currentStep.value !== CHAT_STEPS.CONFIRM) return
  
  isSubmitting.value = true
  currentStep.value = CHAT_STEPS.CREATING
  
  try {
    const descText = formData.description.trim()

    const payload = {
      title: formData.title.trim(),
      description: descText,
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
      attachment_file_ids: Array.isArray(formData.attachments_media)
        ? formData.attachments_media
          .map((file) => Number(file?.id))
          .filter((id) => Number.isInteger(id) && id > 0)
        : [],
    }

    const result = await createTicket(payload)
    toast.success('Tạo yêu cầu thành công!')
    
    currentStep.value = CHAT_STEPS.DONE
    addMessage('bot', 'text', 'Ticket của bạn đã được tạo thành công.')
    
    const newTicketId = result?.data?.id || result?.id
    emit('ticket-created', newTicketId)
    
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Không thể tạo yêu cầu. Vui lòng thử lại.'
    toast.error(message)
    addMessage('bot', 'text', `Đã có lỗi xảy ra: ${message}. Hãy thử lại.`)
    currentStep.value = CHAT_STEPS.CONFIRM // Revert back
  } finally {
    isSubmitting.value = false
  }
}

const getApiBaseUrl = () => String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const toAbsoluteUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${getApiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`
}

function handleCancel() {
  emit('close')
}

// Convert markdown-like **Bold** to HTML for preview
function renderMessage(content) {
  return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-[var(--app-bg)] relative">
    <!-- Header -->
    <div class="flex h-16 shrink-0 items-center justify-between border-b border-[var(--stroke)] bg-white px-4 tablet:px-6">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-xs">
          <span class="material-symbols-outlined text-[20px]">auto_awesome</span>
        </div>
        <div>
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">Trợ lý tạo ticket</h2>
          <p class="text-xs text-[var(--text-secondary)]">Đang hoạt động</p>
        </div>
      </div>
      
      <button
        type="button"
        class="inline-flex size-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] hover:text-[var(--primary-strong)] focus:bg-[var(--primary-softer)] focus:text-[var(--primary-strong)] focus:outline-hidden"
        title="Huỷ và quay lại"
        aria-label="Huỷ và quay lại"
        @click="handleCancel"
      >
        <span class="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>

    <!-- Chat Area -->
    <div ref="chatContainerRef" class="ticket-inbox-scrollbar flex-1 overflow-y-auto px-3 py-4 tablet:px-4 scroll-smooth">
      <div class="flex flex-col gap-5 mx-auto pb-2">
        <template v-for="msg in messages" :key="msg.id">
          <!-- Bot Message -->
          <div v-if="msg.role === 'bot'" class="flex gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-xs mt-1">
              <span class="material-symbols-outlined text-[16px]">auto_awesome</span>
            </div>
            <div class="flex flex-col gap-2 max-w-[85%] tablet:max-w-[75%]">
              
              <!-- Regular text -->
              <div v-if="msg.type === 'text'" class="rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm border border-[var(--stroke)] text-sm text-[var(--text-secondary)] leading-relaxed" v-html="renderMessage(msg.content)">
              </div>
              
              <!-- Ticket Type Selection Action -->
              <div v-if="msg.type === 'action_ticket_type'" class="rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm border border-[var(--stroke)]">
                <p class="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{{ msg.content }}</p>
                <div v-if="currentStep === CHAT_STEPS.SELECT_TICKET_TYPE" class="flex flex-wrap gap-2">
                  <button 
                    v-for="typeOption in ticketTypes" :key="typeOption.value"
                    @click="handleSelectTicketType(typeOption)"
                    class="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus:outline-hidden"
                  >
                    {{ typeOption.label }}
                  </button>
                </div>
              </div>

              <!-- Store Selection Action -->
              <div v-if="msg.type === 'action_store'" class="rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm border border-[var(--stroke)]">
                <p class="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{{ msg.content }}</p>
                <!-- Search Input for Store -->
                <div v-if="currentStep === CHAT_STEPS.SELECT_STORE" class="mb-3 relative">
                  <input
                    v-model="searchStoreQuery"
                    type="text"
                    class="w-full rounded-xl app-input bg-[var(--app-bg)] py-2.5 pl-9 pr-3 text-sm transition-colors"
                    placeholder="Tìm cửa hàng..."
                  />
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>
                  </div>
                </div>

                <div v-if="currentStep === CHAT_STEPS.SELECT_STORE" class="flex flex-col gap-2 max-h-[220px] overflow-y-auto ticket-inbox-scrollbar pr-1 -mr-1">
                  <button 
                    v-for="store in filteredStores" :key="store.value"
                    @click="handleSelectStore(store)"
                    class="w-full shrink-0 rounded-xl border border-[var(--stroke)] bg-white p-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus:outline-hidden"
                  >
                    {{ store.label }}
                  </button>
                  <p v-if="filteredStores.length === 0 && searchStoreQuery" class="text-sm text-[var(--text-secondary)] py-2 text-center">Không tìm thấy cửa hàng nào phù hợp.</p>
                  <p v-if="availableStores.length === 0" class="text-sm text-[var(--danger-text)] py-2">Bạn không có quyền ở cửa hàng nào.</p>
                </div>
              </div>

              <!-- Department Selection Action -->
              <div v-if="msg.type === 'action_department'" class="rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm border border-[var(--stroke)]">
                <p class="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{{ msg.content }}</p>
                <div v-if="currentStep === CHAT_STEPS.SELECT_DEPARTMENT" class="flex flex-wrap gap-2">
                  <button 
                    v-for="dept in departments" :key="dept.id"
                    @click="handleSelectDepartment(dept)"
                    class="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus:outline-hidden"
                  >
                    {{ dept.name }}
                  </button>
                  <div v-if="loadingDeps" class="text-xs text-[var(--primary)] flex items-center gap-1.5 px-2">
                    <span class="inline-block size-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent"></span> Đang tải...
                  </div>
                </div>
              </div>

              <!-- Content Input Action -->
              <div v-if="msg.type === 'action_content'" class="min-w-[280px] rounded-2xl rounded-tl-none bg-[var(--surface-muted)] p-4 shadow-sm tablet:min-w-[400px]">
                <p class="text-sm text-[var(--text-secondary)] leading-relaxed mb-4 font-medium">{{ msg.content }}</p>
                <div v-if="currentStep === CHAT_STEPS.INPUT_CONTENT" class="flex flex-col gap-4">
                  <div class="overflow-hidden rounded-2xl border border-[var(--stroke)] bg-white transition-colors focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]">
                    <textarea 
                      v-model="inputDescription"
                      rows="4" 
                      placeholder="Mô tả chi tiết nội dung (Bắt buộc)..." 
                      class="app-input block w-full resize-none border-0 bg-transparent px-4 py-3.5 text-sm leading-relaxed text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                    ></textarea>
                    
                    <div class="flex items-center gap-2 px-3 pb-3">
                      <FileUploadItem v-model="inputAttachments" :upload-handler="handleTicketUpload" icon-only hide-previews />
                      
                      <div v-if="inputAttachments.length > 0" class="flex flex-wrap gap-2 ml-2">
                        <div v-for="(file, index) in inputAttachments" :key="file.id" class="flex items-center gap-1.5 rounded-md border border-[var(--stroke)] bg-[var(--app-bg)] pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-xs max-w-[160px]">
                          <span class="material-symbols-outlined text-[14px] shrink-0 text-[var(--text-muted)]">attach_file</span>
                          <span class="truncate">{{ file.name || 'Tệp đính kèm' }}</span>
                          <button type="button" class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--stroke-strong)] ml-0.5" aria-label="Xóa tệp" @click="removeAttachment(index)">
                            <span class="material-symbols-outlined text-[12px] leading-none">close</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex justify-end">
                    <button 
                      @click="handleContentSubmit"
                      class="app-button-primary inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 outline-none"
                      :disabled="!inputDescription.trim()"
                    >
                      Tiếp tục
                    </button>
                  </div>
                </div>
              </div>

              <!-- Confirm Action -->
              <div v-if="msg.type === 'action_confirm'" class="rounded-2xl rounded-tl-none bg-[var(--surface-muted)] p-4 shadow-sm">
                <p class="text-sm text-[var(--text-secondary)] mb-4">{{ msg.content }}</p>
                <div v-if="currentStep === CHAT_STEPS.CONFIRM" class="flex flex-wrap gap-2">
                  <button 
                    @click="handleConfirm"
                    class="app-button-primary inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus:outline-hidden"
                  >
                    Tạo ticket ngay
                  </button>
                  <button 
                    @click="resetState"
                    class="app-button-secondary inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold focus:outline-hidden"
                  >
                    Làm lại từ đầu
                  </button>
                </div>
                <div v-else-if="currentStep === CHAT_STEPS.CREATING" class="flex items-center gap-2 text-sm text-[var(--primary)] font-medium px-1">
                  <span class="inline-block size-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent"></span>
                  Đang tạo ticket...
                </div>
              </div>

            </div>
          </div>
          
          <!-- User Message -->
          <div v-else class="flex gap-3 justify-end">
            <div class="flex flex-col gap-2 max-w-[85%] tablet:max-w-[75%] items-end">
              <div v-if="msg.type === 'text'" class="rounded-2xl rounded-tr-none bg-[var(--primary)] p-3.5 shadow-xs text-sm text-white leading-relaxed" v-html="renderMessage(msg.content)">
              </div>
              <div v-if="msg.type === 'attachment_preview'" class="flex flex-col items-end gap-2">
                <div class="rounded-2xl rounded-tr-none bg-[var(--primary)] p-3.5 shadow-xs text-sm text-white">
                  {{ msg.content }}
                </div>
                <div class="flex flex-wrap justify-end gap-2">
                  <div v-for="file in msg.attachments" :key="file.id" class="relative size-20 overflow-hidden rounded-lg border border-[var(--stroke)] bg-white shadow-xs">
                    <img v-if="file.url && !file.error" :src="toAbsoluteUrl(file.url)" class="absolute inset-0 size-full object-cover" @error="file.error = true" />
                    <div v-if="file.error || !file.url" class="flex size-full flex-col items-center justify-center bg-[var(--primary-softer)] p-1 text-center text-[var(--text-secondary)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer" :title="file.name">
                      <span class="material-symbols-outlined text-[18px] mb-0.5">description</span>
                      <span class="truncate w-full text-[9px] font-medium px-1">{{ file.name || 'Lỗi ảnh' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- User avatar -->
            <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--text-secondary)] mt-1">
              <span class="material-symbols-outlined text-[16px]">person</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticket-inbox-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #b8d7f4 transparent;
}

.ticket-inbox-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.ticket-inbox-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ticket-inbox-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: #b8d7f4;
}
</style>
