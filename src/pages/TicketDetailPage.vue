<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CommonModal from '@/components/CommonModal.vue'
import { useApp } from '@/plugins/app'
import {
  assignTicketHandler,
  claimTicket,
  createTicketLog,
  getTicketById,
  listAssignableTicketHandlers,
  listTicketAssignees,
  listTicketLogs,
  reopenTicket,
  resolveTicket,
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
const assignableHandlers = ref([])
const assignableHandlersLoading = ref(false)
const assignableHandlersError = ref('')
const assignPanelOpen = ref(false)
const selectedAssignableHandlerIds = ref([])
const assigningHandler = ref(false)
const assigning = ref(false)
const resolving = ref(false)
const reopening = ref(false)

const replyMessage = ref('')
const replyError = ref('')
const submittingReply = ref(false)
const replyFiles = ref([])
const replyFileInputRef = ref(null)
const MAX_REPLY_FILES = 5
const MAX_REPLY_FILE_SIZE_BYTES = 5 * 1024 * 1024
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
const canAdminAssignHandler = computed(() => {
  return userRole.value === 'admin' && hasTicket.value && isOpenTicketStatus.value
})
const canReply = computed(() => {
  if (!hasTicket.value || !isOpenTicketStatus.value) return false
  if (userRole.value === 'admin') return true
  if (userRole.value === 'handler') {
    return isOpenTicketStatus.value && isCurrentUserAssignee.value
  }
  if (userRole.value === 'store') {
    return isOpenTicketStatus.value && isRequester.value
  }
  return false
})
const replyBlockedReason = computed(() => {
  if (!hasTicket.value) return 'Không tìm thấy thông tin ticket.'
  if (!isOpenTicketStatus.value) return 'Chỉ có thể phản hồi khi ticket đang mở.'
  if (userRole.value === 'handler' && !isCurrentUserAssignee.value) {
    return 'Bạn cần tiếp nhận ticket (Nhận xử lý ticket) trước khi gửi phản hồi.'
  }
  if (userRole.value === 'store' && !isRequester.value) {
    return 'Chỉ người tạo ticket mới có quyền phản hồi.'
  }
  return ''
})
const canClaimTicket = computed(() => canManageAssignment.value && hasTicket.value && isOpenTicketStatus.value && !isCurrentUserAssignee.value)
const canResolveTicket = computed(() => {
  if (!hasTicket.value) return false
  if (String(ticket.value?.status || '') !== 'in_progress') return false
  if (userRole.value === 'admin') return true
  return canManageAssignment.value && isCurrentUserAssignee.value
})
const canReopenTicket = computed(() => hasTicket.value && isResolvedTicket.value && (userRole.value === 'store' || userRole.value === 'admin'))
const availableAssignableHandlers = computed(() => {
  const assignedIds = new Set(assignees.value.map((item) => Number(item?.id || 0)).filter((id) => id > 0))
  return assignableHandlers.value.filter((item) => !assignedIds.has(Number(item?.id || 0)))
})
const hasSelectedAssignableHandlers = computed(() => selectedAssignableHandlerIds.value.length > 0)

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
const processingDurationMeta = computed(() => {
  if (!hasTicket.value) {
    return {
      value: '--',
      className: 'text-slate-900',
      note: '',
    }
  }

  const reason = String(ticket.value?.processing_alert_reason || '')
  return {
    value: ticket.value?.processing_duration_label || (ticket.value?.start_date || ticket.value?.createdAt ? '0 phút' : '--'),
    className: ticket.value?.processing_alert_level === 'danger' ? 'text-rose-600' : 'text-slate-900',
    note:
      reason === 'unconfirmed_over_2h'
        ? 'Quá 2 giờ chưa xác nhận'
        : reason === 'confirmed_over_24h'
          ? 'Quá 24 giờ chưa hoàn tất'
          : '',
  }
})

const overviewItems = computed(() => {
  if (!hasTicket.value) return []
  return [
    { key: 'status', label: 'Trạng thái', value: normalizeStatus(ticket.value.status), className: statusClass(ticket.value.status), kind: 'status' },
    { key: 'processingDuration', label: 'Thời gian xử lý', value: processingDurationMeta.value.value, className: processingDurationMeta.value.className, note: processingDurationMeta.value.note, kind: 'text' },
    { key: 'requester', label: 'Người tạo', value: requesterDisplay.value, className: '', kind: 'text' },
    { key: 'store', label: 'Cửa hàng', value: storeDisplay.value, className: '', kind: 'text' },
    { key: 'department', label: 'Bộ phận phụ trách', value: departmentDisplay.value, className: '', kind: 'text' },
    { key: 'createdAt', label: 'Ngày tạo', value: formatDateTime(ticket.value.createdAt), className: '', kind: 'text' },
    { key: 'updatedAt', label: 'Cập nhật gần nhất', value: formatDateTime(ticket.value.updatedAt || ticket.value.createdAt), className: '', kind: 'text' },
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
    new: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
    in_progress: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
    resolved: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    closed: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
    rejected: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
  }
  return map[normalized] || 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
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

function openReplyFilePicker() {
  if (!canReply.value) return
  replyFileInputRef.value?.click()
}

function addReplyFiles(event) {
  const files = Array.from(event?.target?.files || [])
  if (!files.length) return

  replyError.value = ''
  const existing = [...replyFiles.value]
  const existsMap = new Set(existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
  let hasOverLimit = false
  let hasInvalidType = false
  let hasOversized = false

  files.forEach((file) => {
    if (!(file.type || '').startsWith('image/')) {
      hasInvalidType = true
      return
    }

    const fileSize = Number(file.size || 0)
    if (Number.isFinite(fileSize) && fileSize > MAX_REPLY_FILE_SIZE_BYTES) {
      hasOversized = true
      return
    }

    if (existing.length >= MAX_REPLY_FILES) {
      hasOverLimit = true
      return
    }

    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (!existsMap.has(key)) {
      existing.push(file)
      existsMap.add(key)
    }
  })

  replyFiles.value = existing
  if (hasInvalidType) {
    replyError.value = 'Chỉ cho phép đính kèm file ảnh.'
  } else if (hasOversized) {
    replyError.value = 'Mỗi ảnh đính kèm không được vượt quá 5MB.'
  } else if (hasOverLimit) {
    replyError.value = `Chỉ được đính kèm tối đa ${MAX_REPLY_FILES} ảnh.`
  }
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

async function fetchAssignableHandlers() {
  if (!ticket.value?.id || !canAdminAssignHandler.value) {
    assignableHandlers.value = []
    selectedAssignableHandlerIds.value = []
    assignPanelOpen.value = false
    assignableHandlersError.value = ''
    return
  }

  assignableHandlersLoading.value = true
  assignableHandlersError.value = ''

  try {
    const result = await listAssignableTicketHandlers(ticket.value.id)
    const records = result?.data?.handlers || result?.handlers || []
    assignableHandlers.value = Array.isArray(records) ? records : []
    const availableIds = new Set(assignableHandlers.value.map((item) => String(item?.id || '')))
    selectedAssignableHandlerIds.value = selectedAssignableHandlerIds.value.filter((id) => availableIds.has(String(id)))
  } catch (err) {
    assignableHandlers.value = []
    selectedAssignableHandlerIds.value = []
    assignableHandlersError.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách handler khả dụng.'
  } finally {
    assignableHandlersLoading.value = false
  }
}

function syncLegacyHandlerFromAssignees() {
  if (!ticket.value) return
  const first = assignees.value[0] || null
  ticket.value.handler = first
  ticket.value.handler_id = first?.id || null
}

async function handleAssignHandler() {
  if (
    !canAdminAssignHandler.value ||
    assigningHandler.value ||
    !ticket.value?.id ||
    !selectedAssignableHandlerIds.value.length
  ) {
    return
  }

  assigningHandler.value = true
  assignableHandlersError.value = ''

  try {
    const handlerIds = [...new Set(
      selectedAssignableHandlerIds.value
        .map((value) => Number(value || 0))
        .filter((value) => Number.isInteger(value) && value > 0)
    )]

    for (const handlerId of handlerIds) {
      const result = await assignTicketHandler(ticket.value.id, handlerId)
      const updatedTicket = result?.data?.ticket || result?.ticket || null
      if (updatedTicket?.id) {
        ticket.value = updatedTicket
        assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
        syncLegacyHandlerFromAssignees()
      }
    }

    if (!ticket.value?.id) {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }

    selectedAssignableHandlerIds.value = []
    assignPanelOpen.value = false
    await fetchAssignableHandlers()
  } catch (err) {
    assignableHandlersError.value = err?.response?.data?.message || err?.message || 'Không thể phân công handler.'
  } finally {
    assigningHandler.value = false
  }
}

async function toggleAssignPanel() {
  if (!canAdminAssignHandler.value || assigningHandler.value) return
  const willOpen = !assignPanelOpen.value
  assignPanelOpen.value = willOpen
  assignableHandlersError.value = ''
  if (!willOpen) {
    selectedAssignableHandlerIds.value = []
    return
  }

  await fetchAssignableHandlers()
}

function closeAssignModal() {
  if (assigningHandler.value) return
  assignPanelOpen.value = false
  selectedAssignableHandlerIds.value = []
  assignableHandlersError.value = ''
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
    await fetchAssignableHandlers()
  } catch (err) {
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể nhận xử lý ticket.'
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
    await fetchAssignableHandlers()
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
    await fetchAssignableHandlers()
  } catch (err) {
    replyError.value = err?.response?.data?.message || err?.message || 'Không thể mở lại yêu cầu.'
  } finally {
    reopening.value = false
  }
}

async function uploadReplyFiles() {
  if (!replyFiles.value.length) return []

  if (replyFiles.value.length > MAX_REPLY_FILES) {
    throw new Error(`Chỉ được đính kèm tối đa ${MAX_REPLY_FILES} ảnh.`)
  }

  const formData = new FormData()
  replyFiles.value.forEach((file) => {
    const fileSize = Number(file.size || 0)
    if (Number.isFinite(fileSize) && fileSize > MAX_REPLY_FILE_SIZE_BYTES) {
      throw new Error('Mỗi ảnh đính kèm không được vượt quá 5MB.')
    }
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
    await fetchAssignableHandlers()
  }
}

onMounted(async () => {
  await fetchAllData()
})
</script>

<template>
  <div class="page-stack mx-2 overflow-visible space-y-4 sm:mx-3 md:mx-0">
    <div class="flex items-start justify-between gap-3">
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
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Chi tiết ticket</p>
          <h1 class="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl">{{ ticketCode }}</h1>
          <p class="mt-1 text-sm leading-6 text-slate-500">Theo dõi tiến độ xử lý và trao đổi của ticket này.</p>
        </div>
      </div>

      <button
        v-if="canResolveTicket"
        type="button"
        class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
        :disabled="assigning || resolving"
        @click="handleResolveTicket"
      >
        <span class="material-symbols-outlined text-[18px] text-emerald-600" :class="resolving ? 'animate-spin' : ''">
          {{ resolving ? 'autorenew' : 'task_alt' }}
        </span>
        {{ resolving ? 'Đang xử lý...' : 'Đánh dấu đã xử lý' }}
      </button>
    </div>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" v-loading="loading">
      <div v-if="errorMessage" class="p-5 sm:p-6">
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ errorMessage }}
        </div>
        <div class="mt-4">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            @click="fetchAllData"
          >
            Thử lại
          </button>
        </div>
      </div>

      <div v-else-if="!hasTicket" class="p-5 sm:p-6 text-sm text-slate-600">
        Không tìm thấy dữ liệu yêu cầu.
      </div>

      <div v-else class="p-4 sm:p-5">
        <div class="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside class="space-y-4 xl:sticky xl:top-4 self-start">
            <div class="rounded-2xl bg-slate-50 px-4 py-4 sm:px-5">
              <div class="space-y-4">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Thông tin ticket</p>
                </div>

                <div class="space-y-4">
                  <div
                    v-for="item in overviewItems"
                    :key="item.key"
                    class="min-w-0 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0"
                  >
                    <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{{ item.label }}</p>
                    <span
                      v-if="item.kind === 'status'"
                      class="mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                      :class="item.className"
                    >
                      {{ item.value }}
                    </span>
                    <template v-else>
                      <p class="mt-2 break-words text-sm font-semibold leading-6" :class="item.className || 'text-slate-900'">{{ item.value }}</p>
                      <p v-if="item.note" class="mt-1 text-xs font-medium text-rose-600">{{ item.note }}</p>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-slate-900">Người xử lý</h3>
                  <p class="mt-1 text-xs text-slate-500">Danh sách đang phụ trách ticket hiện tại.</p>
                </div>

                <button
                  v-if="canAdminAssignHandler"
                  type="button"
                  class="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Phân công handler"
                  :disabled="assigningHandler || assignableHandlersLoading"
                  @click="toggleAssignPanel"
                >
                  <span class="material-symbols-outlined text-[16px]">person_add</span>
                  <span class="hidden sm:inline">Phân công</span>
                </button>
              </div>

              <p v-if="assigneesError" class="mt-3 text-xs sm:text-sm text-red-600">{{ assigneesError }}</p>
              <p v-else-if="assigneesLoading" class="mt-3 text-xs sm:text-sm text-slate-500">Đang tải người xử lý...</p>

              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="member in assignees"
                  :key="member.id"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span class="inline-flex size-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold uppercase text-blue-700">
                    {{ avatarInitial(member.name || `#${member.id}`) }}
                  </span>
                  {{ member.name || `#${member.id}` }}
                </span>
                <span v-if="!assignees.length" class="text-xs sm:text-sm text-slate-500">Chưa có người xử lý.</span>
              </div>

              <div v-if="canClaimTicket" class="mt-4">
                <button
                  type="button"
                  class="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  :disabled="assigning || resolving"
                  @click="handleClaimTicket"
                >
                  {{ assigning ? 'Đang xử lý...' : 'Nhận xử lý ticket' }}
                </button>
              </div>
            </div>
          </aside>

          <div class="space-y-6">
            <div class="rounded-2xl bg-slate-50 px-4 py-4 sm:px-5">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-base font-semibold text-slate-900">{{ ticket.title || 'Trao đổi' }}</h2>
                <button
                  type="button"
                  class="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
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
                  class="rounded-2xl bg-white px-4 py-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold" :class="avatarClass(item.sender_type)">
                        {{ avatarInitial(item.sender_name) }}
                      </span>
                      <div class="min-w-0">
                        <p class="truncate text-base font-semibold text-slate-700">{{ item.sender_name }}</p>
                        <p class="text-xs sm:text-sm text-slate-600">{{ item.sender_role }}</p>
                      </div>
                    </div>
                    <p class="whitespace-nowrap text-xs font-semibold text-slate-600 sm:text-sm">{{ formatDateTime(item.createdAt) }}</p>
                  </div>

                  <p class="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{{ item.message }}</p>

                  <div v-if="item.attachments.length" class="mt-4 space-y-2">
                    <div
                      v-for="attachment in item.attachments"
                      :key="attachment.id"
                      class="block rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 sm:text-sm"
                    >
                      <a
                        :href="toAbsoluteUrl(attachment.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="break-all font-semibold hover:underline"
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
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
              <h3 class="text-base font-semibold text-slate-900">Nội dung phản hồi</h3>

              <template v-if="!isResolvedTicket">
                <p v-if="!canReply && replyBlockedReason" class="mt-2 text-xs sm:text-sm text-amber-700">
                  {{ replyBlockedReason }}
                </p>

                <div class="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <textarea
                    v-model="replyMessage"
                    class="block w-full min-h-[180px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-hidden"
                    placeholder="Nhập nội dung"
                    :disabled="!canReply || submittingReply"
                  ></textarea>
                </div>

                <div class="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-600">
                  Vui lòng gửi kèm hình ảnh liên quan (tối đa 5 ảnh, mỗi ảnh tối đa 5MB) để người phụ trách nắm thông tin và xử lý nhanh hơn.
                </div>

                <div v-if="replyFiles.length" class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="(file, index) in replyFiles"
                    :key="`${file.name}-${file.size}-${file.lastModified}`"
                    class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 sm:text-sm"
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
                      class="cursor-pointer inline-flex items-center gap-x-2 rounded-xl border border-blue-500 px-3 py-2 text-xs font-semibold text-blue-500 hover:bg-blue-50 disabled:opacity-50 sm:text-sm"
                      :disabled="!canReply || submittingReply"
                      @click="openReplyFilePicker"
                    >
                      <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      Đính kèm tệp
                    </button>
                  </div>

                  <div class="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      class="cursor-pointer rounded-xl border border-transparent bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                      :disabled="!canReply || submittingReply"
                      @click="submitReply"
                    >
                      {{ submittingReply ? 'Đang gửi...' : 'Gửi yêu cầu' }}
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                  Ticket đã được đánh dấu xử lý xong. Nếu cửa hàng chưa hài lòng với kết quả, bạn có thể gửi lại yêu cầu để bộ phận phụ trách tiếp tục xử lý.
                </div>
                <p v-if="replyError" class="mt-3 text-xs sm:text-sm text-red-600">{{ replyError }}</p>
                <div v-if="canReopenTicket" class="mt-4">
                  <button
                    type="button"
                    class="cursor-pointer rounded-xl border border-transparent bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    :disabled="reopening"
                    @click="handleReopenTicket"
                  >
                    {{ reopening ? 'Đang mở lại...' : 'Mở lại ticket' }}
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>

    <CommonModal
      v-model="assignPanelOpen"
      title="Phân công handler"
      description="Chọn một hoặc nhiều nhân viên handler trong đúng bộ phận phụ trách để thêm vào ticket."
      max-width-class="max-w-lg"
      :close-disabled="assigningHandler"
      @close="closeAssignModal"
    >
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Bộ phận phụ trách</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">{{ departmentDisplay }}</p>
        </div>

        <p v-if="assignableHandlersError" class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {{ assignableHandlersError }}
        </p>

        <p v-else-if="assignableHandlersLoading" class="text-sm text-slate-500">Đang tải danh sách handler...</p>

        <div v-else-if="availableAssignableHandlers.length" class="space-y-2">
          <label
            v-for="member in availableAssignableHandlers"
            :key="member.id"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-colors hover:border-slate-300"
          >
            <input
              v-model="selectedAssignableHandlerIds"
              type="checkbox"
              :value="String(member.id)"
              class="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-800">{{ member.name || `#${member.id}` }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ member.department_name || departmentDisplay }}</p>
            </div>
          </label>
        </div>

        <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Không còn handler khả dụng trong bộ phận này.
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="assigningHandler"
            @click="closeAssignModal"
          >
            Hủy
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="assigningHandler || !hasSelectedAssignableHandlers"
            @click="handleAssignHandler"
          >
            <span class="material-symbols-outlined text-[18px]" :class="assigningHandler ? 'animate-spin' : ''">
              {{ assigningHandler ? 'autorenew' : 'done_all' }}
            </span>
            {{ assigningHandler ? 'Đang thêm...' : 'Thêm' }}
          </button>
        </div>
      </template>
    </CommonModal>

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
