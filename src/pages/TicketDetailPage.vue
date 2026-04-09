<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CommonModal from '@/components/CommonModal.vue'
import { useApp } from '@/plugins/app'
import { createRealtimeConnection } from '@/services/realtime_service'
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
  embedded: {
    type: Boolean,
    default: false,
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
const actionMenuOpen = ref(false)
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
const actionMenuRef = ref(null)
const MAX_REPLY_FILES = 5
const MAX_REPLY_FILE_SIZE_BYTES = 5 * 1024 * 1024
const imagePreview = ref({
  open: false,
  src: '',
  name: '',
})
const conversationViewportRef = ref(null)
let ticketRealtimeConnection = null

const normalizeTicketPayload = (item) => {
  if (!item || typeof item !== 'object') return null

  return {
    ...item,
    createdAt: item?.createdAt || item?.created_at || null,
    updatedAt: item?.updatedAt || item?.updated_at || null,
    start_date: item?.start_date || item?.startDate || null,
    processing_started_at: item?.processing_started_at || item?.processingStartedAt || null,
    resolved_at: item?.resolved_at || item?.resolvedAt || null,
  }
}

const normalizeTicketLogPayload = (item) => {
  if (!item || typeof item !== 'object') return null

  return {
    ...item,
    createdAt: item?.createdAt || item?.created_at || null,
    updatedAt: item?.updatedAt || item?.updated_at || null,
  }
}

const upsertTicketLog = (incoming) => {
  const logItem = normalizeTicketLogPayload(incoming)
  if (!logItem) return

  const incomingId = Number(logItem?.id || 0)
  if (incomingId <= 0) {
    logs.value = [...logs.value, logItem]
    return
  }

  const existingIndex = logs.value.findIndex((item) => Number(item?.id || 0) === incomingId)
  if (existingIndex >= 0) {
    const nextItems = [...logs.value]
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...logItem,
    }
    logs.value = nextItems
    return
  }

  logs.value = [...logs.value, logItem]
}

const getRealtimeToken = () => localStorage.getItem('token') || state?.token || null

const filesSidebarOpen = ref(false)

const ticketId = computed(() => Number(props.id || 0))
const isEmbedded = computed(() => props.embedded === true)
const hasTicket = computed(() => Boolean(ticket.value?.id))
const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const currentUserId = computed(() => Number(state.userInfo?.id || 0))
const currentUserName = computed(() => String(state.userInfo?.name || '').trim().toLowerCase())
const canManageAssignment = computed(() => userRole.value === 'handler' || userRole.value === 'admin')
const isCurrentUserAssignee = computed(() => assignees.value.some((item) => Number(item?.id) === currentUserId.value))
const isRequester = computed(() => Number(ticket.value?.requester?.id || ticket.value?.requester_id || 0) === currentUserId.value)
const isOpenTicketStatus = computed(() => ['new', 'assigned', 'in_progress'].includes(String(ticket.value?.status || '')))
const isResolvedTicket = computed(() => String(ticket.value?.status || '') === 'resolved')
const canAdminAssignHandler = computed(() => {
  return userRole.value === 'admin' && hasTicket.value && isOpenTicketStatus.value
})
const canReply = computed(() => {
  return hasTicket.value && isOpenTicketStatus.value
})
const replyBlockedReason = computed(() => {
  if (!hasTicket.value) return 'Không tìm thấy thông tin ticket.'
  if (!isOpenTicketStatus.value) return 'Chỉ có thể phản hồi khi ticket đang mở.'
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
const showHeaderActionMenu = computed(() => canClaimTicket.value || canAdminAssignHandler.value || canResolveTicket.value)
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
    { key: 'store', label: 'Cửa hàng', value: storeDisplay.value, className: '', kind: 'text' },
    { key: 'department', label: 'Bộ phận phụ trách', value: departmentDisplay.value, className: '', kind: 'text' },
    { key: 'createdAt', label: 'Ngày tạo', value: formatDateTime(ticket.value.createdAt), className: '', kind: 'text' },
  ]
})

const conversationItems = computed(() => {
  if (!hasTicket.value) return []

  const rootAttachments = normalizeAttachmentList(ticket.value.attachments_media)
  const rootCard = {
    id: `ticket-${ticket.value.id}`,
    sender_id: Number(ticket.value?.requester?.id || ticket.value?.requester_id || 0) || null,
    sender_name: requesterDisplay.value,
    sender_role: normalizeUserRoleLabel(ticket.value?.requester?.role || 'store'),
    sender_type: 'store',
    createdAt: ticket.value.createdAt || null,
    message: ticket.value.description || '--',
    attachments: rootAttachments,
  }

  const logCards = logs.value.map((log, index) => ({
    id: log?.id || `log-${index}`,
    sender_id: Number(log?.sender?.id || log?.sender_id || 0) || null,
    sender_name: log?.sender?.name || '--',
    sender_role: normalizeUserRoleLabel(log?.sender?.role || log?.sender_type || 'handler'),
    sender_type: log?.sender_type || 'handler',
    createdAt: log?.createdAt || null,
    message: log?.message || '--',
    attachments: normalizeAttachmentList(log?.attachments),
  }))

  return [rootCard, ...logCards]
})

const exchangedFiles = computed(() => {
  const files = []
  if (!hasTicket.value) return files

  for (const item of conversationItems.value) {
    if (item.attachments && item.attachments.length) {
      for (const att of item.attachments) {
        files.push({
          ...att,
          senderName: item.sender_name,
          createdAt: item.createdAt,
          messageId: item.id
        })
      }
    }
  }
  return files.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  })
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
    new: 'app-badge--info',
    in_progress: 'app-badge--warning',
    resolved: 'app-badge--success',
    closed: 'app-badge--neutral',
    rejected: 'app-badge--danger',
  }
  return map[normalized] || 'app-badge--neutral'
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
  if (type === 'system') return 'bg-slate-300 text-slate-700'
  return 'app-avatar-neutral'
}

function isSystemConversationItem(item) {
  return String(item?.sender_type || '').toLowerCase() === 'system'
}

function isOwnConversationItem(item) {
  const senderId = Number(item?.sender_id || 0)
  if (senderId > 0 && senderId === currentUserId.value) return true

  const senderName = String(item?.sender_name || '').trim().toLowerCase()
  if (currentUserName.value && senderName && senderName === currentUserName.value) return true

  const senderType = String(item?.sender_type || '').toLowerCase()
  if (userRole.value === 'store') {
    return senderType === 'store' && isRequester.value
  }

  if (userRole.value === 'handler' || userRole.value === 'admin') {
    return senderType === 'handler'
  }

  return false
}

function conversationRowClass(item) {
  if (isSystemConversationItem(item)) return 'justify-center'
  return isOwnConversationItem(item) ? 'justify-end' : 'justify-start'
}

function conversationThreadClass(item) {
  if (isSystemConversationItem(item)) return 'max-w-2xl justify-center'
  return isOwnConversationItem(item)
    ? 'flex-row-reverse justify-end'
    : 'flex-row justify-start'
}

function conversationMetaClass(item) {
  if (isSystemConversationItem(item)) return 'items-center text-center'
  return isOwnConversationItem(item) ? 'items-end text-right' : 'items-start text-left'
}

function conversationContentClass(item) {
  if (isSystemConversationItem(item)) return 'mx-auto items-center'
  return isOwnConversationItem(item) ? 'items-end' : 'items-start'
}

function conversationBubbleClass(item) {
  if (isSystemConversationItem(item)) return 'rounded-2xl border border-slate-200 bg-slate-100/90'
  return isOwnConversationItem(item)
    ? 'rounded-2xl rounded-tr-md bg-slate-900 text-white'
    : 'rounded-2xl rounded-tl-md border border-slate-200 bg-white'
}

function conversationMessageClass(item) {
  return isOwnConversationItem(item) && !isSystemConversationItem(item)
    ? 'whitespace-pre-line break-words text-sm leading-relaxed text-white'
    : 'whitespace-pre-line break-words text-sm leading-relaxed text-slate-700'
}

function conversationAttachmentLinkClass(item) {
  return isOwnConversationItem(item)
    ? 'inline-flex max-w-full cursor-pointer break-all text-sm font-semibold text-white underline-offset-2 hover:underline'
    : 'inline-flex max-w-full cursor-pointer break-all text-sm font-semibold text-slate-700 underline-offset-2 hover:underline'
}

function conversationTimestampClass(item) {
  if (isSystemConversationItem(item)) return 'mt-2 self-center text-[11px] text-slate-400'
  return isOwnConversationItem(item)
    ? 'mt-2 self-end text-[11px] text-slate-300'
    : 'mt-2 self-end text-[11px] text-slate-400'
}

function scrollConversationToBottom() {
  if (!conversationViewportRef.value) return
  conversationViewportRef.value.scrollTop = conversationViewportRef.value.scrollHeight
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

function isImageFile(mime, url = '') {
  if (String(mime || '').startsWith('image/')) return true
  if (url && /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(String(url))) return true
  return false
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

function toggleActionMenu() {
  if (!showHeaderActionMenu.value) return
  actionMenuOpen.value = !actionMenuOpen.value
}

function closeActionMenu() {
  actionMenuOpen.value = false
}

function toggleFilesSidebar() {
  filesSidebarOpen.value = !filesSidebarOpen.value
}

function closeFilesSidebar() {
  filesSidebarOpen.value = false
}

function handleDocumentPointerDown(event) {
  if (!actionMenuOpen.value) return
  const target = event?.target
  if (!(target instanceof Node)) return
  if (actionMenuRef.value?.contains(target)) return
  closeActionMenu()
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

function applyIncomingTicket(nextTicket) {
  const normalizedTicket = normalizeTicketPayload(nextTicket)
  if (!normalizedTicket?.id) return

  ticket.value = normalizedTicket
  assignees.value = Array.isArray(normalizedTicket.assignees) ? normalizedTicket.assignees : assignees.value
  if (canAdminAssignHandler.value) {
    void fetchAssignableHandlers()
  }
}

function handleTicketRealtimeEvent(payload = {}) {
  const event = String(payload?.event || '')
  const data = payload?.data || {}
  const incomingTicketId = Number(data?.ticket_id || data?.ticket?.id || 0)

  if (event === 'ticket.log.created') {
    if (!incomingTicketId || incomingTicketId !== ticketId.value) return
    if (data?.log) {
      upsertTicketLog(data.log)
    }
    return
  }

  if (event === 'ticket.updated' || event === 'ticket.created') {
    if (!incomingTicketId || incomingTicketId !== ticketId.value) return
    if (data?.ticket) {
      applyIncomingTicket(data.ticket)
    }
    return
  }

  if (event === 'ticket.deleted') {
    if (!incomingTicketId || incomingTicketId !== ticketId.value) return
    errorMessage.value = 'Ticket đã bị xóa hoặc không còn khả dụng.'
    ticket.value = null
    logs.value = []
    assignees.value = []
  }
}

function startTicketRealtime() {
  const resolvedTicketId = Number(ticketId.value || 0)
  if (!state?.token || !Number.isInteger(resolvedTicketId) || resolvedTicketId <= 0) return
  if (ticketRealtimeConnection) return

  ticketRealtimeConnection = createRealtimeConnection({
    path: `/api/realtime/ws/tickets/${resolvedTicketId}`,
    getToken: getRealtimeToken,
    onEvent: handleTicketRealtimeEvent,
    shouldReconnect: (closeEvent) => {
      if (!state?.token) return false
      return Number(closeEvent?.code || 0) !== 1008
    },
  })

  ticketRealtimeConnection.connect()
}

function stopTicketRealtime() {
  if (!ticketRealtimeConnection) return
  ticketRealtimeConnection.close()
  ticketRealtimeConnection = null
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
    const detail = result?.data || null

    if (!detail?.id) {
      throw new Error('Không tìm thấy dữ liệu yêu cầu.')
    }

    ticket.value = normalizeTicketPayload(detail)
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
    const records = result?.data || []
    logs.value = Array.isArray(records)
      ? records.map((record) => normalizeTicketLogPayload(record)).filter(Boolean)
      : []
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
    const records = result?.data || []
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
    const records = result?.data || []
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
      const updatedTicket = result?.data || null
      if (updatedTicket?.id) {
        ticket.value = normalizeTicketPayload(updatedTicket)
        assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
      }
    }

    if (!ticket.value?.id) {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }

    await fetchTicketLogs()

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

async function openAssignPanelFromMenu() {
  closeActionMenu()
  await toggleAssignPanel()
}

async function handleClaimTicket() {
  if (!canClaimTicket.value || assigning.value || !ticket.value?.id) return

  assigning.value = true
  assigneesError.value = ''

  try {
    const result = await claimTicket(ticket.value.id)
    const updatedTicket = result?.data || null
    if (updatedTicket?.id) {
      ticket.value = normalizeTicketPayload(updatedTicket)
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketAssignees()
    }
    await fetchTicketLogs()
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
    const updatedTicket = result?.data || null
    if (updatedTicket?.id) {
      ticket.value = normalizeTicketPayload(updatedTicket)
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }
    await fetchTicketLogs()
    await fetchAssignableHandlers()
  } catch (err) {
    assigneesError.value = err?.response?.data?.message || err?.message || 'Không thể chuyển trạng thái đã xử lý.'
  } finally {
    resolving.value = false
  }
}

async function handleResolveFromMenu() {
  closeActionMenu()
  await handleResolveTicket()
}

async function handleReopenTicket() {
  if (!canReopenTicket.value || reopening.value || !ticket.value?.id) return

  reopening.value = true
  replyError.value = ''

  try {
    const result = await reopenTicket(ticket.value.id)
    const updatedTicket = result?.data || null
    if (updatedTicket?.id) {
      ticket.value = normalizeTicketPayload(updatedTicket)
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketDetail()
      await fetchTicketAssignees()
    }
    await fetchTicketLogs()
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
  const uploaded = result?.data?.files || result?.files || result?.data || []

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

    const createdLog = result?.data || null
    if (createdLog?.id) {
      upsertTicketLog(createdLog)
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
    await fetchAssignableHandlers()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  stopTicketRealtime()
})

watch(
  () => conversationItems.value.length,
  async (nextLength) => {
    if (!nextLength) return
    await nextTick()
    scrollConversationToBottom()
  }
)

watch(
  () => ticketId.value,
  async (nextId, previousId) => {
    stopTicketRealtime()
    if (!nextId || nextId === previousId) return
    closeActionMenu()
    closeFilesSidebar()
    await fetchAllData()
    startTicketRealtime()
  },
  { immediate: true }
)

watch(
  () => state?.token,
  (token) => {
    if (!token) {
      stopTicketRealtime()
      return
    }
    startTicketRealtime()
  }
)

watch(
  () => assignPanelOpen.value,
  (isOpen) => {
    if (isOpen) closeActionMenu()
  }
)

watch(
  () => showHeaderActionMenu.value,
  (visible) => {
    if (!visible) closeActionMenu()
  }
)
</script>

<template>
  <div :class="isEmbedded ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'page-stack h-full min-h-0 overflow-hidden flex flex-col'">
    <section
      class="flex flex-col flex-1 min-h-0 overflow-hidden"
      :class="isEmbedded ? 'bg-transparent' : 'border border-slate-200 bg-white pc:border-x pc:border-y-0'"
      v-loading="loading"
    >
      <div v-if="errorMessage" class="p-5 tablet:p-6">
        <div class="app-state-banner">
          {{ errorMessage }}
        </div>
        <div class="mt-4">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-hidden"
            @click="fetchAllData"
          >
            Thử lại
          </button>
        </div>
      </div>

      <div v-else-if="!hasTicket" class="p-5 tablet:p-6">
        <div class="app-state-panel app-state-panel--center">
          <div class="app-state-stack">
            <div class="app-state-icon mx-auto">
              <span class="material-symbols-outlined text-[24px]">info</span>
            </div>
            <p class="app-state-title">Không tìm thấy dữ liệu yêu cầu.</p>
            <p class="app-state-body">Ticket có thể đã bị xóa hoặc đường dẫn hiện tại không còn hợp lệ.</p>
          </div>
        </div>
      </div>

      <div v-else class="min-h-0 flex-1 flex flex-col" :class="!isEmbedded ? 'pc:grid pc:grid-cols-[minmax(0,1fr)_320px]' : ''">
        <aside v-if="!isEmbedded" class="hidden border-b border-slate-200 pc:order-2 pc:flex pc:flex-col pc:h-full pc:border-b-0 pc:border-slate-200 bg-white">
          <section class="flex-1 overflow-y-auto px-4 py-4 tablet:px-5 tablet:py-5 ticket-detail-scrollbar">
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
                    class="app-badge mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
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
          </section>

          <section class="shrink-0 border-t border-slate-200 bg-white px-4 py-4 tablet:px-5 tablet:py-5">
            <div>
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
                  <span class="hidden tablet:inline">Phân công</span>
                </button>
              </div>

              <p v-if="assigneesError" class="app-field-error mt-3 tablet:text-sm">{{ assigneesError }}</p>
              <p v-else-if="assigneesLoading" class="mt-3 text-xs tablet:text-sm text-slate-500">Đang tải người xử lý...</p>

              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="member in assignees"
                  :key="member.id"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span class="app-avatar-neutral inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold uppercase">
                    {{ avatarInitial(member.name || `#${member.id}`) }}
                  </span>
                  {{ member.name || `#${member.id}` }}
                </span>
                <span v-if="!assignees.length" class="text-xs tablet:text-sm text-slate-500">Chưa có người xử lý.</span>
              </div>

              <div v-if="canClaimTicket" class="mt-4">
                <button
                  type="button"
                  class="app-button-primary cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold"
                  :disabled="assigning || resolving"
                  @click="handleClaimTicket"
                >
                  {{ assigning ? 'Đang xử lý...' : 'Nhận xử lý ticket' }}
                </button>
              </div>
            </div>
          </section>
        </aside>

        <div class="min-h-0 flex-1 flex flex-col relative overflow-hidden" :class="!isEmbedded ? 'pc:order-1 pc:border-r pc:border-slate-200' : ''">
          <section class="flex flex-1 min-h-0 flex-col">
            <div class="shrink-0 border-b border-slate-200 bg-white px-3 py-2 tablet:px-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <button
                    v-if="!isEmbedded"
                    type="button"
                    class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                    aria-label="Quay lại danh sách ticket"
                    @click="goBack"
                  >
                    <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>

                  <div class="min-w-0">
                    <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {{ String(ticketCode).startsWith('#') ? ticketCode : `#${ticketCode}` }}
                    </p>
                    <h2 class="mt-1 truncate text-base font-semibold text-slate-900">{{ ticket.title || 'Trao đổi' }}</h2>
                  </div>
                </div>

                <div class="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <div ref="actionMenuRef">
                    <button
                      v-if="showHeaderActionMenu"
                      type="button"
                      class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      aria-label="Tùy chọn thao tác"
                      @click="toggleActionMenu"
                    >
                      Tiếp nhận xử lý
                      <span class="material-symbols-outlined text-[18px]">expand_{{ actionMenuOpen ? 'less' : 'more' }}</span>
                    </button>
                    
                    <Transition name="action-modal">
                      <div
                        v-if="actionMenuOpen"
                        class="fixed inset-0 z-[100] flex flex-col justify-end overflow-hidden bg-slate-900/40 tablet:absolute tablet:z-[60] tablet:items-center tablet:justify-center tablet:p-6"
                      >
                        <div class="absolute inset-0" @click.stop="closeActionMenu"></div>
                        
                        <div class="modal-panel relative flex h-[50dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl focus:outline-none tablet:h-auto tablet:max-h-[80%] tablet:max-w-sm tablet:rounded-2xl">
                          <div class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                            <h3 class="text-base font-semibold text-slate-800">Tùy chọn thao tác</h3>
                            <button
                              type="button"
                              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200/50 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                              @click.stop="closeActionMenu"
                            >
                              <span class="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                        
                        <div class="flex-1 overflow-y-auto p-3 space-y-2">
                          <button
                            v-if="canClaimTicket"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-all hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                            :disabled="assigning || resolving"
                            @click="actionMenuOpen = false; handleClaimTicket()"
                          >
                            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              <span class="material-symbols-outlined text-[20px]">{{ assigning ? 'hourglass_empty' : 'how_to_reg' }}</span>
                            </span>
                            <span class="flex-1">{{ assigning ? 'Đang nhận xử lý...' : 'Nhận xử lý việc này' }}</span>
                          </button>

                          <button
                            v-if="canAdminAssignHandler"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                            :disabled="assigningHandler || assignableHandlersLoading"
                            @click="openAssignPanelFromMenu"
                          >
                            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                              <span class="material-symbols-outlined text-[20px]">person_add</span>
                            </span>
                            <span class="flex-1">Giao việc cho nhân viên khác</span>
                          </button>

                          <button
                            v-if="canResolveTicket"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                            :disabled="assigning || resolving"
                            @click="handleResolveFromMenu"
                          >
                            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <span class="material-symbols-outlined text-[20px]" :class="resolving ? 'animate-spin' : ''">{{ resolving ? 'autorenew' : 'task_alt' }}</span>
                            </span>
                            <span class="flex-1">{{ resolving ? 'Đang xử lý...' : 'Đánh dấu đã xử lý xong' }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>

                  <button
                    type="button"
                    class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    aria-label="Danh sách tệp đính kèm"
                    title="Danh sách tệp đính kèm"
                    @click="toggleFilesSidebar"
                  >
                    <span class="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                  </button>
                </div>
            </div>
            </div>

            <div class="min-h-0 flex-1 bg-slate-50/60">
              <div
                ref="conversationViewportRef"
                class="ticket-detail-scrollbar h-full overflow-y-auto px-3 py-4 tablet:px-4 tablet:py-5"
              >
                <p v-if="logsError" class="app-state-banner text-xs tablet:text-sm">
                  {{ logsError }}
                </p>
                <p v-else-if="logsLoading" class="app-state-inline text-xs tablet:text-sm">
                  Đang tải trao đổi...
                </p>

                <div v-else-if="conversationItems.length" class="space-y-5">
                  <article
                    v-for="item in conversationItems"
                    :key="item.id"
                    class="flex"
                    :class="conversationRowClass(item)"
                  >
                    <div
                      class="flex max-w-full items-start gap-3 pc:max-w-3xl"
                      :class="conversationThreadClass(item)"
                    >
                      <span
                        v-if="!isSystemConversationItem(item)"
                        class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        :class="avatarClass(item.sender_type)"
                      >
                        {{ avatarInitial(item.sender_name) }}
                      </span>

                      <div
                        class="min-w-0 flex w-fit max-w-[85%] flex-col tablet:max-w-[42rem]"
                        :class="conversationContentClass(item)"
                      >
                        <div
                          class="mb-1.5 flex flex-col gap-0.5 text-xs text-slate-500"
                          :class="conversationMetaClass(item)"
                        >
                          <span class="font-semibold text-slate-700">{{ item.sender_name }}</span>
                          <span>{{ item.sender_role }}</span>
                        </div>

                        <div
                          class="inline-flex max-w-full flex-col px-4 py-3"
                          :class="conversationBubbleClass(item)"
                        >
                          <p :class="conversationMessageClass(item)">{{ item.message }}</p>

                          <div v-if="item.attachments.length" class="mt-3">
                            <div class="flex flex-wrap gap-2">
                              <template v-for="attachment in item.attachments" :key="attachment.id">
                                <div v-if="isImageFile(attachment.mime, attachment.url)" class="relative size-16 tablet:size-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 cursor-pointer shadow-xs transition-opacity hover:opacity-90" @click="openImagePreview(attachment.url, attachment.name)">
                                  <img :src="toAbsoluteUrl(attachment.url)" :alt="attachment.name" class="absolute inset-0 size-full object-cover" />
                                </div>
                                <a
                                  v-else
                                  :href="toAbsoluteUrl(attachment.url)"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  :class="conversationAttachmentLinkClass(item)"
                                >
                                  {{ attachment.name }}
                                </a>
                              </template>
                            </div>
                          </div>

                          <span :class="conversationTimestampClass(item)">
                            {{ formatDateTime(item.createdAt) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <div
                  v-else
                  class="flex h-full min-h-[240px] items-center justify-center px-6"
                >
                  <div class="app-state-panel app-state-panel--compact w-full max-w-sm border-dashed border-slate-300 bg-white/80">
                    <div class="app-state-stack mx-auto">
                      <div class="app-state-icon mx-auto">
                        <span class="material-symbols-outlined text-[28px]">chat</span>
                      </div>
                      <p class="app-state-title">Chưa có trao đổi nào.</p>
                      <p class="app-state-body">Hội thoại sẽ xuất hiện ở đây sau khi ticket có phản hồi đầu tiên.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section class="shrink-0 border-t border-slate-200 bg-white px-3 py-3 tablet:px-4">
              <div class="space-y-2">

                <template v-if="!isResolvedTicket">
                  <p v-if="!canReply && replyBlockedReason" class="text-xs tablet:text-sm text-amber-700">
                    {{ replyBlockedReason }}
                  </p>

                  <div class="flex flex-col">
                    <div v-if="replyFiles.length" class="flex flex-wrap gap-2 px-1 pb-3">
                      <span
                        v-for="(file, index) in replyFiles"
                        :key="`${file.name}-${file.size}-${file.lastModified}`"
                        class="app-chip inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1 text-xs"
                      >
                        <span class="max-w-[180px] truncate">{{ file.name }}</span>
                        <button
                          type="button"
                          class="inline-flex size-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Xóa tệp"
                          @click="removeReplyFile(index)"
                        >
                          <span class="material-symbols-outlined text-[14px] leading-none">close</span>
                        </button>
                      </span>
                    </div>

                    <div class="flex items-end gap-1.5 tablet:gap-2">
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
                          class="shrink-0 flex items-center justify-center size-[46px] rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                          title="Đính kèm ảnh"
                          @click="openReplyFilePicker"
                          :disabled="!canReply || submittingReply"
                       >
                         <svg class="size-[22px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                       </button>

                       <div class="flex-1 relative rounded-[20px] border border-slate-200 bg-white focus-within:border-slate-400 transition-colors">
                         <textarea
                            v-model="replyMessage"
                            class="block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            placeholder="Nhập nội dung phản hồi..."
                            rows="1"
                            style="min-height: 46px; max-height: 120px;"
                            :disabled="!canReply || submittingReply"
                          ></textarea>
                       </div>

                       <button
                          type="button"
                          class="app-button-primary shrink-0 flex items-center justify-center h-[46px] w-[46px] tablet:w-auto tablet:px-5 rounded-full shadow-sm disabled:opacity-50 transition-all font-semibold ml-0.5"
                          @click="submitReply"
                          :disabled="!canReply || submittingReply || (!replyMessage.trim() && !replyFiles.length)"
                       >
                         <span v-if="submittingReply" class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                         <span v-else class="material-symbols-outlined text-[20px] tablet:mr-1.5">send</span>
                         <span class="hidden tablet:inline text-sm">{{ submittingReply ? 'Đang gửi' : 'Gửi' }}</span>
                       </button>
                    </div>
                  </div>

                  <p v-if="replyError" class="app-field-error mt-2 tablet:text-sm">{{ replyError }}</p>
                </template>

                <template v-else>
                  <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    Ticket đã được đánh dấu xử lý xong. Nếu cửa hàng chưa hài lòng với kết quả, bạn có thể gửi lại yêu cầu để bộ phận phụ trách tiếp tục xử lý.
                  </div>
                  <p v-if="replyError" class="app-field-error mt-3 tablet:text-sm">{{ replyError }}</p>
                  <div v-if="canReopenTicket" class="mt-4">
                    <button
                      type="button"
                      class="app-button-warning cursor-pointer inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 tablet:w-auto"
                      :disabled="reopening"
                      @click="handleReopenTicket"
                    >
                      {{ reopening ? 'Đang mở lại...' : 'Mở lại ticket' }}
                    </button>
                  </div>
                </template>
              </div>
            </section>
          </section>

          <!-- Files Sidebar -->
          <Transition name="slide-right">
            <aside
              v-if="filesSidebarOpen"
              class="absolute inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
            >
              <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <h3 class="text-sm font-semibold text-slate-800">Tệp đính kèm</h3>
                <button
                  type="button"
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  @click="closeFilesSidebar"
                >
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div class="ticket-detail-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
                <div v-if="!exchangedFiles.length" class="py-10 text-center text-sm text-slate-500">
                  Chưa có tệp đính kèm nào được chia sẻ.
                </div>
                
                <div v-else class="space-y-3">
                  <div
                    v-for="file in exchangedFiles"
                    :key="`${file.id}-${file.messageId}`"
                    class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition-colors hover:border-slate-300"
                  >
                    <div
                      v-if="isImageFile(file.mime, file.url)"
                      class="relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                      @click="openImagePreview(file.url, file.name)"
                    >
                      <img :src="toAbsoluteUrl(file.url)" :alt="file.name" class="absolute inset-0 size-full object-cover" />
                      <div class="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-center text-[9px] font-bold text-white backdrop-blur-xs">Ảnh</div>
                    </div>
                    <div
                      v-else
                      class="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-100 text-slate-400"
                    >
                      <span class="material-symbols-outlined text-[20px]">description</span>
                    </div>

                    <div class="min-w-0 flex-1">
                      <a
                        :href="toAbsoluteUrl(file.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block truncate text-sm font-semibold text-slate-800 transition-colors hover:text-blue-600 hover:underline"
                        :title="file.name"
                      >
                        {{ file.name }}
                      </a>
                      <div class="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-500">
                        <span class="truncate font-medium">{{ file.senderName }}</span>
                        <span>{{ formatDateTime(file.createdAt) }} • {{ formatFileSize(file.size) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </Transition>

          <CommonModal
            v-model="assignPanelOpen"
            title="Phân công handler"
            description="Chọn một hoặc nhiều nhân viên handler trong đúng bộ phận phụ trách để thêm vào ticket."
            max-width-class="max-w-lg"
            :close-disabled="assigningHandler"
            :disable-teleport="true"
            container-class="absolute inset-x-0 bottom-0 top-[60px] tablet:inset-0 z-[70] rounded-xl"
            @close="closeAssignModal"
          >
            <div class="space-y-4">
              <div v-if="assignableHandlersLoading" class="text-sm text-slate-500">Đang tải danh sách handler...</div>
              <div v-else-if="assignableHandlersError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {{ assignableHandlersError }}
              </div>

              <div v-else-if="availableAssignableHandlers.length" class="space-y-3">
                <label
                  v-for="member in availableAssignableHandlers"
                  :key="member.id"
                  class="group relative flex cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-blue-500 hover:bg-slate-50"
                  :class="selectedAssignableHandlerIds.includes(String(member.id)) ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : ''"
                >
                  <div class="flex h-6 items-center">
                    <input
                      v-model="selectedAssignableHandlerIds"
                      :value="String(member.id)"
                      type="checkbox"
                      class="size-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                  </div>
                  <div class="ml-3 flex flex-col">
                    <span class="block text-sm font-semibold text-slate-900">{{ member.name || `#${member.id}` }}</span>
                    <p class="mt-0.5 text-xs text-slate-500">{{ member.department_name || departmentDisplay }}</p>
                  </div>
                </label>
              </div>

              <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Không còn handler khả dụng trong bộ phận này.
              </div>
            </div>

            <template #footer>
              <div class="flex flex-col-reverse gap-2 tablet:flex-row tablet:items-center tablet:justify-end">
                <button
                  type="button"
                  class="app-button-secondary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
                  :disabled="assigningHandler"
                  @click="closeAssignModal"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  class="app-button-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
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
        </div>
      </div>
    </section>

    <div
      v-if="imagePreview.open"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/85 p-3 tablet:p-6"
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

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.inbox-reply-textarea:focus-visible {
  outline: none;
  box-shadow: none;
}

.ticket-detail-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.ticket-detail-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.ticket-detail-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ticket-detail-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: #cbd5e1;
}

.action-modal-enter-active,
.action-modal-leave-active {
  transition: opacity 0.3s ease;
}
.action-modal-enter-from,
.action-modal-leave-to {
  opacity: 0;
}
.action-modal-enter-active .modal-panel,
.action-modal-leave-active .modal-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.action-modal-enter-from .modal-panel,
.action-modal-leave-to .modal-panel {
  transform: translateY(100%);
}
@media (min-width: 768px) {
  .action-modal-enter-from .modal-panel,
  .action-modal-leave-to .modal-panel {
    transform: translateY(10px) scale(0.95);
  }
}
</style>
