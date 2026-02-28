<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  claimTicket,
  createTicketLog,
  getTicketById,
  listTicketAssignees,
  listTicketLogs,
  reopenTicket,
  resolveTicket,
  unassignTicketUser,
  uploadTicketAttachments,
} from '@/services/ticket_service'

const props = defineProps({
  id: {
    type: [String, Number],
    default: '',
  },
})

const router = useRouter()
const { state } = useApp()

const loading = ref(false)
const errorMessage = ref('')
const ticket = ref(null)

const logs = ref([])
const logsLoading = ref(false)
const logsError = ref('')
const assignees = ref([])
const assigneesLoading = ref(false)
const assigneesError = ref('')
const assigning = ref(false)
const resolving = ref(false)
const reopening = ref(false)

const replyMessage = ref('')
const replyError = ref('')
const submittingReply = ref(false)
const replyFiles = ref([])
const replyFileInputRef = ref(null)
const imagePreview = ref({
  open: false,
  src: '',
  name: '',
})

const ticketId = computed(() => Number(props.id || 0))
const hasTicket = computed(() => Boolean(ticket.value?.id))
const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const currentUserId = computed(() => Number(state.userInfo?.id || 0))
const canManageAssignment = computed(() => userRole.value === 'handler' || userRole.value === 'admin')
const isCurrentUserAssignee = computed(() => assignees.value.some((item) => Number(item?.id) === currentUserId.value))
const isRequester = computed(() => Number(ticket.value?.requester?.id || ticket.value?.requester_id || 0) === currentUserId.value)
const isOpenTicketStatus = computed(() => ['new', 'assigned', 'in_progress'].includes(String(ticket.value?.status || '')))
const isResolvedTicket = computed(() => String(ticket.value?.status || '') === 'resolved')
const canReply = computed(() => {
  if (!hasTicket.value || isResolvedTicket.value) return false
  if (userRole.value === 'admin') return true
  if (userRole.value === 'handler') {
    return isOpenTicketStatus.value && isCurrentUserAssignee.value
  }
  if (userRole.value === 'store') {
    return isRequester.value
  }
  return false
})
const replyBlockedReason = computed(() => {
  if (!hasTicket.value) return 'Không tìm thấy thông tin ticket.'
  if (isResolvedTicket.value) return 'Ticket đã xử lý xong nên không thể gửi phản hồi.'
  if (userRole.value === 'handler' && !isCurrentUserAssignee.value) {
    return 'Bạn cần tiếp nhận ticket (Nhận xử lý ticket) trước khi gửi phản hồi.'
  }
  if (userRole.value === 'store' && !isRequester.value) {
    return 'Chỉ người tạo ticket mới có quyền phản hồi.'
  }
  return ''
})
const canClaimTicket = computed(() => canManageAssignment.value && hasTicket.value && isOpenTicketStatus.value && !isCurrentUserAssignee.value)
const canLeaveTicket = computed(() => canManageAssignment.value && hasTicket.value && isOpenTicketStatus.value && isCurrentUserAssignee.value)
const canResolveTicket = computed(() => {
  if (!hasTicket.value) return false
  if (String(ticket.value?.status || '') !== 'in_progress') return false
  if (userRole.value === 'admin') return true
  return canManageAssignment.value && isCurrentUserAssignee.value
})
const canReopenTicket = computed(() => hasTicket.value && isResolvedTicket.value && (userRole.value === 'store' || userRole.value === 'admin'))

const ticketCode = computed(() => ticket.value?.ticket_code || `#${ticket.value?.id || props.id}`)
const requesterDisplay = computed(() => {
  if (!ticket.value) return '--'
  return ticket.value.requester?.name || ticket.value.requester_name || `#${ticket.value.requester_id || '--'}`
})
const storeDisplay = computed(() => {
  if (!ticket.value) return '--'
  return (
    ticket.value.store?.name ||
    ticket.value.store?.shortAddress ||
    ticket.value.store?.address ||
    ticket.value.store?.code ||
    ticket.value.store_name ||
    ticket.value.store_id ||
    '--'
  )
})
const departmentDisplay = computed(() => ticket.value?.responsible_department?.name || '--')
const isTicketEditable = computed(() => {
  if (!hasTicket.value) return false
  const isEditableStatus = ticket.value.status === 'new'
  const noHandler = Number(ticket.value.handler?.id || ticket.value.handler_id || 0) <= 0
  const canEdit = userRole.value === 'store' || userRole.value === 'admin'
  return canEdit && isEditableStatus && noHandler
})

const summaryItems = computed(() => {
  if (!hasTicket.value) return []
  return [
    { key: 'status', label: 'Trạng thái', value: normalizeStatus(ticket.value.status), className: statusClass(ticket.value.status) },
    { key: 'requester', label: 'Người tạo', value: requesterDisplay.value, className: '' },
    { key: 'store', label: 'Cửa hàng', value: storeDisplay.value, className: '' },
    { key: 'department', label: 'Bộ phận phụ trách', value: departmentDisplay.value, className: '' },
  ]
})

const conversationItems = computed(() => {
  if (!hasTicket.value) return []

  const rootAttachments = normalizeAttachmentList(ticket.value.attachments_media)
  const rootCard = {
    id: `ticket-${ticket.value.id}`,
    sender_name: requesterDisplay.value,
    sender_role: normalizeUserRoleLabel(ticket.value?.requester?.role || 'store'),
    sender_type: 'store',
    createdAt: ticket.value.createdAt || null,
    message: ticket.value.description || '--',
    attachments: rootAttachments,
  }

  const logCards = logs.value.map((log, index) => ({
    id: log?.id || `log-${index}`,
    sender_name: log?.sender?.name || '--',
    sender_role: normalizeUserRoleLabel(log?.sender?.role || log?.sender_type || 'handler'),
    sender_type: log?.sender_type || 'handler',
    createdAt: log?.createdAt || null,
    message: log?.message || '--',
    attachments: normalizeAttachmentList(log?.attachments),
  }))

  return [rootCard, ...logCards]
})

function normalizeStatusKey(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'assigned') return 'in_progress'
  return value
}

function normalizeStatus(status) {
  const normalized = normalizeStatusKey(status)
  const map = {
    new: 'Mới tạo',
    in_progress: 'Đang xử lý',
    resolved: 'Đã xử lý',
    closed: 'Đã đóng',
    rejected: 'Từ chối',
  }
  return map[normalized] || status || 'Chưa xác định'
}

function statusClass(status) {
  const normalized = normalizeStatusKey(status)
  const map = {
    new: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return map[normalized] || 'bg-slate-100 text-slate-700'
}

function normalizeUserRoleLabel(role) {
  const map = {
    store: 'Cửa hàng trưởng',
    handler: 'Nhân viên hỗ trợ',
    qc: 'Kiểm soát chất lượng',
    admin: 'Quản trị viên',
    system: 'Hệ thống',
  }
  return map[String(role || '').toLowerCase()] || 'Người dùng'
}

function avatarInitial(name) {
  const source = String(name || '').trim()
  return source ? source.charAt(0).toUpperCase() : 'U'
}

function avatarClass(senderType) {
  const type = String(senderType || '').toLowerCase()
  if (type === 'store') return 'bg-sky-500 text-white'
  if (type === 'admin') return 'bg-violet-500 text-white'
  if (type === 'system') return 'bg-slate-500 text-white'
  return 'bg-orange-400 text-white'
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
}

function toAbsoluteUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

function normalizeAttachmentList(source) {
  const items = Array.isArray(source) ? source : []
  return items
    .map((item, index) => ({
      id: item?.id || `attachment-${index}`,
      name: String(item?.name || item?.original_name || `Tệp ${index + 1}`),
      mime: String(item?.mime || ''),
      size: Number(item?.size || 0),
      url: String(item?.url || ''),
    }))
    .filter((item) => item.url || item.name)
}

function formatFileSize(size) {
  const value = Number(size || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function isImageFile(mime) {
  return String(mime || '').startsWith('image/')
}

function openImagePreview(url, name = '') {
  if (!url) return
  imagePreview.value = {
    open: true,
    src: toAbsoluteUrl(url),
    name: name || 'Ảnh đính kèm',
  }
}

function closeImagePreview() {
  imagePreview.value = {
    open: false,
    src: '',
    name: '',
  }
}

function goBack() {
  router.push('/ticket')
}

function goToEdit() {
  if (!hasTicket.value) return
  router.push(`/ticket/${ticket.value.id}/edit`)
}

function openReplyFilePicker() {
  if (!canReply.value) return
  replyFileInputRef.value?.click()
}

function addReplyFiles(event) {
  const files = Array.from(event?.target?.files || [])
  if (!files.length) return

  const existing = [...replyFiles.value]
  const existsMap = new Set(existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`))

  files.forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (!existsMap.has(key)) {
      existing.push(file)
      existsMap.add(key)
    }
  })

  replyFiles.value = existing
  event.target.value = ''
}

function removeReplyFile(index) {
  replyFiles.value = replyFiles.value.filter((_, idx) => idx !== index)
}

async function fetchTicketDetail() {
  loading.value = true
  errorMessage.value = ''
  ticket.value = null

  try {
    if (!Number.isInteger(ticketId.value) || ticketId.value <= 0) {
      throw new Error('Mã yêu cầu không hợp lệ.')
    }

    const result = await getTicketById(ticketId.value)
    const detail = result?.data?.ticket || result?.ticket || result?.data?.data || null

    if (!detail?.id) {
      throw new Error('Không tìm thấy dữ liệu yêu cầu.')
    }

    ticket.value = detail
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể tải chi tiết yêu cầu.'
  } finally {
    loading.value = false
  }
}

async function fetchTicketLogs() {
  if (!ticket.value?.id) return

  logsLoading.value = true
  logsError.value = ''

  try {
    const result = await listTicketLogs(ticket.value.id)
    const records = result?.data?.logs || result?.logs || []
    logs.value = Array.isArray(records) ? records : []
  } catch (err) {
    logs.value = []
    logsError.value = err?.response?.data?.message || err?.message || 'Không thể tải trao đổi.'
  } finally {
    logsLoading.value = false
  }
}

async function fetchTicketAssignees() {
  if (!ticket.value?.id) return

  assigneesLoading.value = true
  assigneesError.value = ''

  try {
    const result = await listTicketAssignees(ticket.value.id)
    const records = result?.data?.assignees || result?.assignees || []
    assignees.value = Array.isArray(records) ? records : []
  } catch (err) {
    assignees.value = []
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách xử lý.'
  } finally {
    assigneesLoading.value = false
  }
}

function syncLegacyHandlerFromAssignees() {
  if (!ticket.value) return
  const first = assignees.value[0] || null
  ticket.value.handler = first
  ticket.value.handler_id = first?.id || null
}

async function handleClaimTicket() {
  if (!canClaimTicket.value || assigning.value || !ticket.value?.id) return

  assigning.value = true
  assigneesError.value = ''

  try {
    const result = await claimTicket(ticket.value.id)
    const updatedTicket = result?.data?.ticket || result?.ticket || null
    if (updatedTicket?.id) {
      ticket.value = updatedTicket
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketAssignees()
    }
    syncLegacyHandlerFromAssignees()
  } catch (err) {
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể nhận xử lý ticket.'
  } finally {
    assigning.value = false
  }
}

async function handleLeaveTicket() {
  if (!canLeaveTicket.value || assigning.value || !ticket.value?.id || !currentUserId.value) return

  assigning.value = true
  assigneesError.value = ''

  try {
    const result = await unassignTicketUser(ticket.value.id, currentUserId.value)
    const updatedTicket = result?.data?.ticket || result?.ticket || null
    if (updatedTicket?.id) {
      ticket.value = updatedTicket
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketAssignees()
    }
    syncLegacyHandlerFromAssignees()
  } catch (err) {
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể rời khỏi ticket.'
  } finally {
    assigning.value = false
  }
}

async function handleResolveTicket() {
  if (!canResolveTicket.value || resolving.value || !ticket.value?.id) return

  resolving.value = true
  assigneesError.value = ''

  try {
    const result = await resolveTicket(ticket.value.id)
    const updatedTicket = result?.data?.ticket || result?.ticket || null
    if (updatedTicket?.id) {
      ticket.value = updatedTicket
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
      syncLegacyHandlerFromAssignees()
    } else {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }
  } catch (err) {
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể chuyển trạng thái đã xử lý.'
  } finally {
    resolving.value = false
  }
}

async function handleReopenTicket() {
  if (!canReopenTicket.value || reopening.value || !ticket.value?.id) return

  reopening.value = true
  replyError.value = ''

  try {
    const result = await reopenTicket(ticket.value.id)
    const updatedTicket = result?.data?.ticket || result?.ticket || null
    if (updatedTicket?.id) {
      ticket.value = updatedTicket
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
      syncLegacyHandlerFromAssignees()
    } else {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }
  } catch (err) {
    replyError.value = err?.response?.data?.message || err?.message || 'Không thể mở lại yêu cầu.'
  } finally {
    reopening.value = false
  }
}

async function uploadReplyFiles() {
  if (!replyFiles.value.length) return []

  const formData = new FormData()
  replyFiles.value.forEach((file) => {
    formData.append('files', file)
  })

  const result = await uploadTicketAttachments(formData)
  const uploaded = result?.data?.files || result?.files || []

  return (Array.isArray(uploaded) ? uploaded : []).map((file) => ({
    id: file?.id,
    name: file?.name,
    url: file?.url,
    mime: file?.mime,
    size: file?.size,
    ext: file?.ext,
    formats: file?.formats || null,
  }))
}

async function submitReply() {
  if (submittingReply.value || !canReply.value || !ticket.value?.id) return

  const message = replyMessage.value.trim()
  if (!message) {
    replyError.value = 'Vui lòng nhập nội dung phản hồi.'
    return
  }

  submittingReply.value = true
  replyError.value = ''

  try {
    const uploadedAttachments = await uploadReplyFiles()

    const result = await createTicketLog({
      ticket_id: ticket.value.id,
      message,
      sender_type: userRole.value === 'handler' || userRole.value === 'admin' ? 'handler' : 'store',
      attachments: uploadedAttachments,
    })

    const createdLog = result?.data?.log || result?.log || null
    if (createdLog?.id) {
      logs.value.push(createdLog)
    } else {
      await fetchTicketLogs()
    }

    replyMessage.value = ''
    replyFiles.value = []
    replyError.value = ''
  } catch (err) {
    replyError.value = err?.response?.data?.message || err?.message || 'Không thể gửi phản hồi.'
  } finally {
    submittingReply.value = false
  }
}

async function fetchAllData() {
  await fetchTicketDetail()
  if (ticket.value?.id) {
    assignees.value = Array.isArray(ticket.value.assignees) ? ticket.value.assignees : []
    await Promise.all([fetchTicketLogs(), fetchTicketAssignees()])
    syncLegacyHandlerFromAssignees()
  }
}

onMounted(async () => {
  await fetchAllData()
})
</script>

<template>
  <div>
    <div class="header max-w-full p-2.5 text-[16px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500 flex items-center justify-between gap-3">
      <div class="flex items-center min-w-0">
        <button
          type="button"
          class="cursor-pointer p-1 mr-2 inline-flex items-center rounded-lg bg-white/40 text-white shadow-2xs hover:bg-white/30 focus:outline-hidden focus:ring-2 focus:ring-white/80"
          aria-label="Quay lại danh sách ticket"
          @click="goBack"
        >
          <svg class="shrink-0 size-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <p class="truncate">Chi tiết yêu cầu: {{ ticketCode }}</p>
      </div>

      <button
        v-if="isTicketEditable"
        type="button"
        class="cursor-pointer py-1 px-2.5 text-xs rounded-lg bg-white text-blue-600 hover:bg-blue-50 font-semibold"
        @click="goToEdit"
      >
        Chỉnh sửa
      </button>
    </div>

    <div class="max-w-full px-4 py-4 mx-auto">
      <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden" v-loading="loading">
        <div v-if="errorMessage" class="p-5 sm:p-6">
          <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ errorMessage }}
          </div>
          <div class="mt-4">
            <button
              type="button"
              class="cursor-pointer py-2 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
              @click="fetchAllData"
            >
              Thử lại
            </button>
          </div>
        </div>

        <div v-else-if="!hasTicket" class="p-5 sm:p-6 text-sm text-gray-600">
          Không tìm thấy dữ liệu yêu cầu.
        </div>

        <div v-else class="p-4 sm:p-5 space-y-4 bg-slate-50">
          <section class="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4">
            <h2 class="text-base font-semibold text-gray-800">Thông tin cơ bản</h2>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              <div v-for="item in summaryItems" :key="item.key" class="rounded-lg border border-gray-200 px-2.5 py-2">
                <p class="text-xs uppercase text-slate-500">{{ item.label }}</p>
                <p v-if="item.key !== 'status'" class="mt-1 text-xs sm:text-sm font-semibold text-slate-700 break-words">{{ item.value }}</p>
                <span v-else class="mt-1.5 inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="item.className">{{ item.value }}</span>
              </div>
            </div>

            <div class="mt-3 rounded-lg border border-gray-200 bg-slate-50 px-2.5 py-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs sm:text-sm font-semibold text-slate-700">Danh sách người xử lý</p>
                <button
                  type="button"
                  class="cursor-pointer px-2.5 py-1 text-xs rounded-md border border-gray-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  :disabled="assigneesLoading || assigning"
                  @click="fetchTicketAssignees"
                >
                  {{ assigneesLoading ? 'Đang tải...' : 'Làm mới' }}
                </button>
              </div>

              <p v-if="assigneesError" class="mt-2 text-xs sm:text-sm text-red-600">{{ assigneesError }}</p>

              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="member in assignees"
                  :key="member.id"
                  class="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {{ member.name || `#${member.id}` }}
                </span>
                <span v-if="!assignees.length" class="text-xs sm:text-sm text-slate-500">Chưa có người xử lý.</span>
              </div>

              <div v-if="canManageAssignment" class="mt-3 flex flex-wrap gap-2">
                <button
                  v-if="canClaimTicket"
                  type="button"
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-md border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  :disabled="assigning || resolving"
                  @click="handleClaimTicket"
                >
                  {{ assigning ? 'Đang xử lý...' : 'Nhận xử lý ticket' }}
                </button>
                <button
                  v-if="canLeaveTicket"
                  type="button"
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  :disabled="assigning || resolving"
                  @click="handleLeaveTicket"
                >
                  {{ assigning ? 'Đang xử lý...' : 'Rời khỏi ticket' }}
                </button>
                <button
                  v-if="canResolveTicket"
                  type="button"
                  class="cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-md border border-transparent bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  :disabled="assigning || resolving"
                  @click="handleResolveTicket"
                >
                  {{ resolving ? 'Đang xử lý...' : 'Đánh dấu đã xử lý' }}
                </button>
              </div>
            </div>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-semibold text-gray-800">{{ ticket.title || 'Trao đổi' }}</h2>
              <button
                type="button"
                class="cursor-pointer py-1.5 px-3 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                :disabled="logsLoading"
                @click="fetchTicketLogs"
              >
                {{ logsLoading ? 'Đang tải...' : 'Làm mới' }}
              </button>
            </div>

            <p v-if="logsError" class="mt-3 text-xs sm:text-sm text-red-600">{{ logsError }}</p>
            <p v-else-if="logsLoading" class="mt-3 text-xs sm:text-sm text-slate-500">Đang tải trao đổi...</p>

            <div class="mt-4 space-y-3">
              <article
                v-for="item in conversationItems"
                :key="item.id"
                class="rounded-xl border border-gray-200 bg-white p-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold" :class="avatarClass(item.sender_type)">
                      {{ avatarInitial(item.sender_name) }}
                    </span>
                    <div class="min-w-0">
                      <p class="text-base font-semibold text-slate-700 truncate">{{ item.sender_name }}</p>
                      <p class="text-xs sm:text-sm text-slate-600">{{ item.sender_role }}</p>
                    </div>
                  </div>
                  <p class="text-xs sm:text-sm font-semibold text-slate-600 whitespace-nowrap">{{ formatDateTime(item.createdAt) }}</p>
                </div>

                <p class="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line break-words">{{ item.message }}</p>

                <div v-if="item.attachments.length" class="mt-4 space-y-2">
                  <div
                    v-for="attachment in item.attachments"
                    :key="attachment.id"
                    class="block rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs sm:text-sm text-blue-700"
                  >
                    <a
                      :href="toAbsoluteUrl(attachment.url)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-semibold break-all hover:underline"
                    >
                      {{ attachment.name }}
                    </a>
                    <p v-if="formatFileSize(attachment.size)" class="text-xs text-blue-600">{{ formatFileSize(attachment.size) }}</p>
                    <button
                      v-if="isImageFile(attachment.mime)"
                      type="button"
                      class="mt-2 inline-block cursor-pointer"
                      @click="openImagePreview(attachment.url, attachment.name)"
                    >
                      <img
                        :src="toAbsoluteUrl(attachment.url)"
                        :alt="attachment.name"
                        class="size-9 rounded border border-blue-100 object-cover hover:opacity-90"
                      />
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section v-if="!isResolvedTicket" class="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4">
            <h3 class="text-lg font-semibold text-slate-700">Nội dung phản hồi</h3>
            <p v-if="!canReply && replyBlockedReason" class="mt-2 text-xs sm:text-sm text-amber-700">
              {{ replyBlockedReason }}
            </p>

            <div class="mt-3 rounded-xl border border-gray-200 overflow-hidden">
              <textarea
                v-model="replyMessage"
                class="block w-full min-h-[180px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-hidden"
                placeholder="Nhập nội dung"
                :disabled="!canReply || submittingReply"
              ></textarea>
            </div>

            <div class="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-600 text-sm font-medium">
              Vui lòng gửi kèm hình ảnh liên quan để người phụ trách nắm thông tin và xử lý nhanh hơn.
            </div>

            <div v-if="replyFiles.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="(file, index) in replyFiles"
                :key="`${file.name}-${file.size}-${file.lastModified}`"
                class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs sm:text-sm text-blue-700"
              >
                <span class="max-w-[220px] truncate">{{ file.name }}</span>
                <button type="button" class="cursor-pointer text-blue-600 hover:text-blue-800" aria-label="Xóa tệp" @click="removeReplyFile(index)">x</button>
              </span>
            </div>

            <p v-if="replyError" class="mt-3 text-xs sm:text-sm text-red-600">{{ replyError }}</p>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <input
                  ref="replyFileInputRef"
                  type="file"
                  class="hidden"
                  accept="image/*"
                  multiple
                  @change="addReplyFiles"
                />
                <button
                  type="button"
                  class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-xs sm:text-sm font-semibold rounded-xl border border-blue-500 text-blue-500 hover:bg-blue-50 disabled:opacity-50"
                  :disabled="!canReply || submittingReply"
                  @click="openReplyFilePicker"
                >
                  <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Đính kèm tệp
                </button>
              </div>

              <div class="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  class="cursor-pointer py-2 px-5 text-sm font-semibold rounded-xl border border-transparent bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                  :disabled="!canReply || submittingReply"
                  @click="submitReply"
                >
                  {{ submittingReply ? 'Đang gửi...' : 'Gửi yêu cầu' }}
                </button>
              </div>
            </div>
          </section>

          <section v-else class="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4">
            <h3 class="text-lg font-semibold text-slate-700">Nội dung phản hồi</h3>
            <div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              Ticket đã được đánh dấu xử lý xong. Nếu cửa hàng chưa hài lòng với kết quả, bạn có thể gửi lại yêu cầu để bộ phận phụ trách tiếp tục xử lý.
            </div>
            <p v-if="replyError" class="mt-3 text-xs sm:text-sm text-red-600">{{ replyError }}</p>
            <div v-if="canReopenTicket" class="mt-4">
              <button
                type="button"
                class="cursor-pointer py-2 px-4 text-sm font-semibold rounded-xl border border-transparent bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                :disabled="reopening"
                @click="handleReopenTicket"
              >
                {{ reopening ? 'Đang mở lại...' : 'Mở lại ticket' }}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div
      v-if="imagePreview.open"
      class="fixed inset-0 z-[120] bg-slate-900/85 p-3 sm:p-6 flex items-center justify-center"
      @click.self="closeImagePreview"
    >
      <div class="relative w-full max-w-5xl">
        <button
          type="button"
          class="cursor-pointer absolute -top-11 right-0 inline-flex size-9 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white hover:bg-black/50"
          aria-label="Đóng xem trước ảnh"
          @click="closeImagePreview"
        >
          <svg class="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <img
          :src="imagePreview.src"
          :alt="imagePreview.name"
          class="w-full max-h-[82vh] object-contain rounded-xl border border-white/20 bg-black/20"
        />
      </div>
    </div>
  </div>
</template>
