<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommonModal from '@/components/CommonModal.vue'
import FileUploadItem from '@/components/FileUploadItem.vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import { normalizeTicketStatus, ticketConfirmationMeta, ticketDurationClass, ticketResolutionMeta, ticketStatusClass, userAvatarUrl } from '@/composables/useTicketPresentation'
import { createRealtimeConnection } from '@/services/realtime_service'
import {
  assignTicketHandler,
  claimTicket,
  createTicketLog,
  getActiveDepartments,
  getTicketById,
  listAssignableTicketHandlers,
  listTicketAssignees,
  listTicketLogs,
  reopenTicket,
  resolveTicket,
  updateTicket,
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
  ticketInfoPanelOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-ticket-list', 'ticket-info-panel-change', 'update:ticket-info-panel-open'])

const router = useRouter()
const route = useRoute()
const { state } = useApp()
const toast = useToast()

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
const editModalOpen = ref(false)
const editSubmitting = ref(false)
const editDepartments = ref([])
const editError = ref('')
const editTicketStoreOption = ref(null)
const editAutoOpenedFor = ref(null)
const editSelectOpen = ref('')
const editForm = reactive({
  store_id: '',
  title: '',
  description: '',
  responsible_department_id: '',
  type: '',
  attachments_media: [],
})
const editErrors = reactive({
  store_id: '',
  title: '',
  description: '',
  responsible_department_id: '',
})

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
const ticketInfoSectionsOpen = ref({
  overview: true,
  actions: true,
  assignees: true,
  files: true,
})

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
const hasReplyContent = computed(() => replyMessage.value.trim().length > 0 || replyFiles.value.length > 0)
const canSubmitReply = computed(() => canReply.value && !submittingReply.value && hasReplyContent.value)
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
const canEditTicket = computed(() => {
  if (!hasTicket.value) return false

  const ticketStatus = String(ticket.value?.status || '').toLowerCase()
  if (!['new', 'assigned', 'in_progress'].includes(ticketStatus)) return false
  if (userRole.value === 'admin') return true
  if (userRole.value !== 'store') return false

  const assignedMembers = Array.isArray(ticket.value?.assignees) && ticket.value.assignees.length
    ? ticket.value.assignees
    : assignees.value
  const isAccepted = ticketStatus !== 'new' || Boolean(ticket.value?.processing_started_at || ticket.value?.processingStartedAt) || (Array.isArray(assignedMembers) && assignedMembers.length > 0)
  if (isAccepted) return false

  return Number(ticket.value?.requester_id || ticket.value?.requester?.id || 0) === currentUserId.value
})
const issueTypes = [
  { label: 'Sự cố hệ thống', value: 'system_issue' },
  { label: 'Sự cố vận hành', value: 'operation_issue' },
  { label: 'Yêu cầu hỗ trợ', value: 'support_request' },
  { label: 'Khác', value: 'other' },
]
const editStoreOptions = computed(() => {
  const userStores = Array.isArray(state.userInfo?.stores)
    ? state.userInfo.stores
    : (Array.isArray(state.userInfo?.store_list)
      ? state.userInfo.store_list
      : (Array.isArray(state.userInfo?.list_store) ? state.userInfo.list_store : []))

  const options = userStores.map(normalizeStoreOption).filter(Boolean)
  if (editTicketStoreOption.value?.value && !options.some((store) => store.value === editTicketStoreOption.value.value)) {
    options.unshift(editTicketStoreOption.value)
  }

  const fallbackId = String(state.userInfo?.store_id || import.meta.env.VITE_DEFAULT_STORE_ID || '').trim()
  if (!options.length && fallbackId) {
    options.push({
      value: fallbackId,
      label: state.userInfo?.store_name || import.meta.env.VITE_DEFAULT_STORE_NAME || `Cửa hàng ${fallbackId}`,
    })
  }

  return options
})
const selectedEditStoreLabel = computed(() => (
  editStoreOptions.value.find((store) => String(store.value) === String(editForm.store_id))?.label || 'Chọn cửa hàng'
))
const selectedEditDepartmentLabel = computed(() => (
  editDepartments.value.find((department) => String(department?.id) === String(editForm.responsible_department_id))?.name || 'Chọn bộ phận xử lý'
))
const selectedEditTypeLabel = computed(() => (
  issueTypes.find((type) => type.value === editForm.type)?.label || 'Chọn loại yêu cầu'
))
const availableAssignableHandlers = computed(() => {
  const assignedIds = new Set(assignees.value.map((item) => Number(item?.id || 0)).filter((id) => id > 0))
  return assignableHandlers.value.filter((item) => !assignedIds.has(Number(item?.id || 0)))
})
const hasSelectedAssignableHandlers = computed(() => selectedAssignableHandlerIds.value.length > 0)

const ticketCode = computed(() => ticket.value?.ticket_code || `#${ticket.value?.id || props.id}`)
const ticketStatusLabel = computed(() => normalizeTicketStatus(ticket.value?.status))
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
const confirmationDurationMeta = computed(() => {
  if (!hasTicket.value) {
    return {
      value: '--',
      className: 'text-[var(--text-primary)]',
      note: '',
    }
  }

  const meta = ticketConfirmationMeta(ticket.value)
  return {
    value: meta.label,
    className: ticketDurationClass(meta),
    note: meta.hint,
  }
})

const resolutionDurationMeta = computed(() => {
  if (!hasTicket.value) {
    return {
      value: '--',
      className: 'text-[var(--text-primary)]',
      note: '',
    }
  }

  const meta = ticketResolutionMeta(ticket.value)
  return {
    value: meta.label,
    className: ticketDurationClass(meta),
    note: meta.hint,
  }
})

const overviewItems = computed(() => {
  if (!hasTicket.value) return []
  return [
    { key: 'status', label: 'Trạng thái', value: normalizeStatus(ticket.value.status), className: statusClass(ticket.value.status), kind: 'status' },
    { key: 'confirmationDuration', label: 'Thời gian tiếp nhận', value: confirmationDurationMeta.value.value, className: confirmationDurationMeta.value.className, note: confirmationDurationMeta.value.note, kind: 'text' },
    { key: 'resolutionDuration', label: 'Thời gian xử lý', value: resolutionDurationMeta.value.value, className: resolutionDurationMeta.value.className, note: resolutionDurationMeta.value.note, kind: 'text' },
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
    sequence: 0,
    sender_id: Number(ticket.value?.requester?.id || ticket.value?.requester_id || 0) || null,
    sender_name: requesterDisplay.value,
    sender_avatar_url: userAvatarUrl(ticket.value?.requester),
    sender_role: normalizeUserRoleLabel(ticket.value?.requester?.role || 'store'),
    sender_type: 'store',
    createdAt: ticket.value.createdAt || null,
    message: ticket.value.description || '--',
    attachments: rootAttachments,
  }

  const logCards = logs.value.map((log, index) => ({
    id: `log-${log?.id || index}`,
    sequence: index + 1,
    sender_id: Number(log?.sender?.id || log?.sender_id || 0) || null,
    sender_name: log?.sender?.name || '--',
    sender_avatar_url: userAvatarUrl(log?.sender),
    sender_role: normalizeUserRoleLabel(log?.sender?.role || log?.sender_type || 'handler'),
    sender_type: log?.sender_type || 'handler',
    createdAt: log?.createdAt || log?.created_at || null,
    message: log?.message || '--',
    attachments: normalizeAttachmentList(log?.attachments),
  }))

  return [rootCard, ...logCards].sort((a, b) => {
    const timeA = getConversationTime(a.createdAt)
    const timeB = getConversationTime(b.createdAt)
    if (timeA !== timeB) return timeA - timeB
    return a.sequence - b.sequence
  })
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
  if (type === 'system') return 'bg-[var(--stroke-strong)] text-[var(--text-secondary)]'
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
  if (isSystemConversationItem(item)) return 'rounded-2xl border border-[var(--stroke)] bg-[var(--primary-softer)]/90'
  return isOwnConversationItem(item)
    ? 'rounded-2xl rounded-tr-md bg-[var(--primary)] text-white'
    : 'rounded-2xl rounded-tl-md border border-[var(--stroke)] bg-white'
}

function conversationMessageClass(item) {
  return isOwnConversationItem(item) && !isSystemConversationItem(item)
    ? 'whitespace-pre-line break-words text-sm leading-relaxed text-white'
    : 'whitespace-pre-line break-words text-sm leading-relaxed text-[var(--text-secondary)]'
}

function conversationAttachmentLinkClass(item) {
  return isOwnConversationItem(item)
    ? 'inline-flex max-w-full cursor-pointer break-all text-sm font-semibold text-white underline-offset-2 hover:underline'
    : 'inline-flex max-w-full cursor-pointer break-all text-sm font-semibold text-[var(--text-secondary)] underline-offset-2 hover:underline'
}

function conversationTimestampClass(item) {
  if (isSystemConversationItem(item)) return 'mt-2 self-center text-[11px] text-[var(--text-muted)]'
  return isOwnConversationItem(item)
    ? 'mt-2 self-end text-[11px] text-white/70'
    : 'mt-2 self-end text-[11px] text-[var(--text-muted)]'
}

function getConversationTime(value) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
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

function ticketStoreOption(sourceTicket) {
  const storeId = String(sourceTicket?.store?.storeId || sourceTicket?.store_id || '').trim()
  if (!storeId) return null

  const label = String(
    sourceTicket?.store?.shortAddress ||
    sourceTicket?.store?.short_address ||
    sourceTicket?.store?.name ||
    sourceTicket?.store?.address ||
    sourceTicket?.store?.code ||
    sourceTicket?.store_name ||
    ''
  ).trim()

  return {
    value: storeId,
    label: label || `Cửa hàng ${storeId}`,
  }
}

function resetEditErrors() {
  editErrors.store_id = ''
  editErrors.title = ''
  editErrors.description = ''
  editErrors.responsible_department_id = ''
  editError.value = ''
}

function closeEditSelect() {
  editSelectOpen.value = ''
}

function toggleEditSelect(selectKey) {
  if (editSubmitting.value) return
  editSelectOpen.value = editSelectOpen.value === selectKey ? '' : selectKey
}

function selectEditOption(field, value) {
  editForm[field] = value
  if (field === 'store_id') editErrors.store_id = ''
  if (field === 'responsible_department_id') editErrors.responsible_department_id = ''
  closeEditSelect()
}

function hydrateEditForm(sourceTicket) {
  editForm.title = sourceTicket?.title || ''
  editForm.description = sourceTicket?.description || ''
  editForm.store_id = String(sourceTicket?.store?.storeId || sourceTicket?.store_id || '').trim()
  editForm.responsible_department_id = sourceTicket?.responsible_department?.id ? String(sourceTicket.responsible_department.id) : ''
  editForm.type = sourceTicket?.type || ''
  editForm.attachments_media = Array.isArray(sourceTicket?.attachments_media) ? [...sourceTicket.attachments_media] : []
  editTicketStoreOption.value = ticketStoreOption(sourceTicket)
}

function validateEditForm() {
  resetEditErrors()

  if (!editForm.store_id) {
    editErrors.store_id = 'Vui lòng chọn cửa hàng'
  }

  if (!editForm.title.trim()) {
    editErrors.title = 'Vui lòng nhập tiêu đề'
  }

  if (!editForm.description.trim()) {
    editErrors.description = 'Vui lòng nhập nội dung'
  }

  if (!editForm.responsible_department_id) {
    editErrors.responsible_department_id = 'Vui lòng chọn bộ phận xử lý'
  }

  return !editErrors.store_id && !editErrors.title && !editErrors.description && !editErrors.responsible_department_id
}

async function fetchEditDepartments() {
  if (editDepartments.value.length) return

  const result = await getActiveDepartments()
  const records = result?.data?.departments || result?.data || []
  editDepartments.value = Array.isArray(records) ? records : []
}

function closeEditModal() {
  if (editSubmitting.value) return
  closeEditSelect()
  editModalOpen.value = false
  resetEditErrors()
  clearEditQuery()
}

async function openEditModal() {
  if (!canEditTicket.value || !ticket.value?.id) return

  hydrateEditForm(ticket.value)
  resetEditErrors()
  closeEditSelect()
  editModalOpen.value = true

  try {
    await fetchEditDepartments()
  } catch (err) {
    editError.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách bộ phận.'
  }
}

function clearEditQuery() {
  if (route.query.edit !== '1') return

  const query = { ...route.query }
  delete query.edit
  router.replace({ query })
}

const handleEditTicketUpload = async (formData) => {
  const result = await uploadTicketAttachments(formData)
  return result?.data?.files?.[0] || result?.files?.[0]
}

async function submitEditTicket() {
  if (editSubmitting.value || !validateEditForm() || !ticket.value?.id) return

  editSubmitting.value = true
  editError.value = ''
  closeEditSelect()

  try {
    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      store_id: String(editForm.store_id || '').trim(),
      responsible_department_id: Number(editForm.responsible_department_id),
      type: editForm.type || null,
      attachments_media: Array.isArray(editForm.attachments_media)
        ? editForm.attachments_media.map((file) => ({
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

    const result = await updateTicket(ticket.value.id, payload)
    const updatedTicket = result?.data || null
    if (updatedTicket?.id) {
      ticket.value = normalizeTicketPayload(updatedTicket)
      assignees.value = Array.isArray(updatedTicket.assignees) ? updatedTicket.assignees : assignees.value
    } else {
      await fetchTicketDetail()
    }
    await fetchTicketLogs()
    await fetchAssignableHandlers()
    toast.success(result?.message || 'Cập nhật yêu cầu thành công')
    editModalOpen.value = false
    clearEditQuery()
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Không thể cập nhật yêu cầu. Vui lòng thử lại.'
    editError.value = message
    toast.error(message)
  } finally {
    editSubmitting.value = false
  }
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

function toggleFilesSidebar() {
  filesSidebarOpen.value = !filesSidebarOpen.value
}

function closeFilesSidebar() {
  filesSidebarOpen.value = false
}

function isTicketInfoSectionOpen(section) {
  return ticketInfoSectionsOpen.value[section] !== false
}

function toggleTicketInfoSection(section) {
  ticketInfoSectionsOpen.value = {
    ...ticketInfoSectionsOpen.value,
    [section]: !isTicketInfoSectionOpen(section),
  }
}

async function copyTicketCode() {
  const code = String(ticketCode.value || '').trim()
  if (!code) return

  try {
    await navigator.clipboard?.writeText(code)
    replyError.value = ''
  } catch {
    replyError.value = 'Không thể sao chép mã ticket.'
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
    const message = 'Ticket đã bị xóa hoặc không còn khả dụng.'
    errorMessage.value = message
    toast.error(message)
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
    toast.error(errorMessage.value)
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
    toast.error(logsError.value)
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
    toast.error(assigneesError.value)
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
    toast.error(assignableHandlersError.value)
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
  if (!canSubmitReply.value || !ticket.value?.id) return

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

function handleReplyInput(event) {
  replyMessage.value = event?.target?.value || ''
}

async function fetchAllData() {
  await fetchTicketDetail()
  if (ticket.value?.id) {
    assignees.value = Array.isArray(ticket.value.assignees) ? ticket.value.assignees : []
    await Promise.all([fetchTicketLogs(), fetchTicketAssignees()])
    await fetchAssignableHandlers()
  }
}

onBeforeUnmount(() => {
  emit('ticket-info-panel-change', false)
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
  () => filesSidebarOpen.value,
  (isOpen) => {
    emit('update:ticket-info-panel-open', isOpen)
    emit('ticket-info-panel-change', isOpen)
  }
)

watch(
  () => props.ticketInfoPanelOpen,
  (isOpen) => {
    const nextOpen = Boolean(isOpen)
    if (filesSidebarOpen.value === nextOpen) return
    filesSidebarOpen.value = nextOpen
  },
  { immediate: true }
)

watch(
  () => [route.query.edit, ticket.value?.id, canEditTicket.value],
  async ([editFlag, currentTicketId, editable]) => {
    if (editFlag !== '1' || !currentTicketId || !editable) return
    if (editAutoOpenedFor.value === currentTicketId) return

    editAutoOpenedFor.value = currentTicketId
    await openEditModal()
  },
  { immediate: true }
)

</script>

<template>
  <div :class="isEmbedded ? 'flex-1 flex flex-col min-h-0 overflow-hidden' : 'h-full min-h-0 overflow-hidden flex flex-col'">
    <section
      class="flex flex-col flex-1 min-h-0 overflow-hidden"
      :class="isEmbedded ? 'bg-transparent' : 'border border-[var(--stroke)] bg-white pc:border-x pc:border-y-0'"
      v-loading="loading"
    >
      <div v-if="errorMessage" class="p-5 tablet:p-6">
        <div class="mt-4">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus:outline-hidden"
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

      <div v-else class="min-h-0 flex-1 flex flex-col" :class="!isEmbedded ? 'app-split-shell' : ''">
        <aside v-if="!isEmbedded" class="hidden border-b border-[var(--stroke)] pc:order-2 pc:flex pc:flex-col pc:h-full pc:border-b-0 pc:border-[var(--stroke)] bg-white">
          <section class="flex-1 overflow-y-auto px-4 py-4 tablet:px-5 tablet:py-5 ticket-detail-scrollbar">
            <div class="space-y-4">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Thông tin ticket</p>
              </div>

              <div class="space-y-4">
                <div
                  v-for="item in overviewItems"
                  :key="item.key"
                  class="min-w-0 border-b border-[var(--stroke)] pb-4 last:border-b-0 last:pb-0"
                >
                  <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{{ item.label }}</p>
                  <span
                    v-if="item.kind === 'status'"
                    class="app-badge mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                    :class="item.className"
                  >
                    {{ item.value }}
                  </span>
                  <template v-else>
                    <p class="mt-2 break-words text-sm font-semibold leading-6" :class="item.className || 'text-[var(--text-primary)]'">{{ item.value }}</p>
                    <p v-if="item.note" class="mt-1 text-xs font-medium text-[var(--danger-text)]">{{ item.note }}</p>
                  </template>
                </div>
              </div>
            </div>
          </section>

        </aside>

        <div class="min-h-0 flex-1 flex relative overflow-hidden" :class="!isEmbedded ? 'pc:order-1 pc:border-r pc:border-[var(--stroke)]' : ''">
          <section class="flex min-w-0 flex-1 min-h-0 flex-col">
            <div class="shrink-0 border-b border-[var(--stroke)] bg-white px-3 py-2.5 tablet:px-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    class="app-button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
                    :class="isEmbedded ? 'pc:hidden' : ''"
                    :aria-label="isEmbedded ? 'Mở danh sách ticket' : 'Quay lại danh sách ticket'"
                    :title="isEmbedded ? 'Mở danh sách ticket' : 'Quay lại danh sách ticket'"
                    @click="isEmbedded ? emit('open-ticket-list') : goBack()"
                  >
                    <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>

                  <div class="min-w-0">
                    <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                      {{ String(ticketCode).startsWith('#') ? ticketCode : `#${ticketCode}` }}
                    </p>
                    <h2 class="mt-1 truncate text-base font-semibold text-[var(--text-primary)]">{{ ticket.title || 'Trao đổi' }}</h2>
                  </div>
                </div>

                <div class="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    class="app-button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                    :aria-label="filesSidebarOpen ? 'Đóng bảng thông tin ticket' : 'Mở bảng thông tin ticket'"
                    :title="filesSidebarOpen ? 'Đóng bảng thông tin ticket' : 'Mở bảng thông tin ticket'"
                    :class="filesSidebarOpen ? 'bg-[var(--primary-softer)] text-[var(--text-primary)]' : ''"
                    @click="toggleFilesSidebar"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ filesSidebarOpen ? 'close' : 'info' }}</span>
                  </button>
                </div>
            </div>
            </div>

            <div class="min-h-0 flex-1 bg-[var(--surface-muted)]/60">
              <div
                ref="conversationViewportRef"
                class="ticket-detail-scrollbar h-full overflow-y-auto p-3 tablet:p-4"
              >
                <p v-if="logsLoading" class="app-state-inline text-xs tablet:text-sm">
                  Đang tải trao đổi...
                </p>

                <div v-else-if="conversationItems.length" class="space-y-3">
                  <article
                    v-for="item in conversationItems"
                    :key="item.id"
                    class="flex"
                    :class="conversationRowClass(item)"
                  >
                    <div
                      v-if="isSystemConversationItem(item)"
                      class="mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[var(--stroke)] bg-white/85 px-3 py-1.5 text-center shadow-xs"
                    >
                      <span class="material-symbols-outlined text-[15px] leading-none text-[var(--text-muted)]">info</span>
                      <span class="text-xs font-medium leading-5 text-[var(--text-secondary)]">{{ item.message }}</span>
                      <span class="text-[11px] leading-5 text-[var(--text-muted)]">{{ formatDateTime(item.createdAt) }}</span>
                    </div>

                    <div
                      v-else
                      class="flex max-w-full items-start gap-3 pc:max-w-3xl"
                      :class="conversationThreadClass(item)"
                    >
                      <span
                        class="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold"
                        :class="avatarClass(item.sender_type)"
                      >
                        <span>{{ avatarInitial(item.sender_name) }}</span>
                        <img v-if="item.sender_avatar_url" :src="item.sender_avatar_url" alt="Avatar người gửi" class="absolute inset-0 size-full rounded-full object-cover" @error="$event.currentTarget.classList.add('hidden')" />
                      </span>

                      <div
                        class="min-w-0 flex w-fit max-w-[85%] flex-col tablet:max-w-[42rem]"
                        :class="conversationContentClass(item)"
                      >
                        <div
                          class="mb-1.5 flex flex-col gap-0.5 text-xs text-[var(--text-secondary)]"
                          :class="conversationMetaClass(item)"
                        >
                          <span class="font-semibold text-[var(--text-secondary)]">{{ item.sender_name }}</span>
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
                                <div v-if="isImageFile(attachment.mime, attachment.url)" class="relative size-16 tablet:size-24 overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--primary-softer)] cursor-pointer shadow-xs transition-opacity hover:opacity-90" @click="openImagePreview(attachment.url, attachment.name)">
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
                  <div class="app-state-panel app-state-panel--compact w-full max-w-sm border-dashed border-[var(--stroke-strong)] bg-white/80">
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

            <section class="shrink-0 border-t border-[var(--stroke)] bg-white p-3 tablet:p-4">
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
                          class="inline-flex size-4 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--text-secondary)]"
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
                          class="shrink-0 flex items-center justify-center size-[46px] rounded-full text-[var(--text-secondary)] hover:bg-[var(--primary-softer)] transition-colors"
                          title="Đính kèm ảnh"
                          @click="openReplyFilePicker"
                          :disabled="!canReply || submittingReply"
                       >
                         <svg class="size-[22px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                       </button>

                       <div class="relative flex-1 rounded-[20px] border border-[var(--stroke)] bg-white transition-colors focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_3px_rgba(29,125,226,0.10)]">
                         <textarea
                            v-model="replyMessage"
                            class="inbox-reply-textarea block w-full resize-none rounded-[20px] border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                            placeholder="Nhập nội dung phản hồi..."
                            rows="1"
                            style="min-height: 46px; max-height: 120px;"
                            :disabled="!canReply || submittingReply"
                            @input="handleReplyInput"
                          ></textarea>
                       </div>

                       <button
                          type="button"
                          class="app-button-primary shrink-0 flex items-center justify-center h-[46px] w-[46px] tablet:w-auto tablet:px-5 rounded-full disabled:opacity-50 transition-all font-semibold ml-0.5"
                          @click="submitReply"
                          :disabled="!canSubmitReply"
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
                  <div class="rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--text-secondary)]">
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

          <!-- Ticket Options Sidebar -->
          <Transition name="slide-right">
            <aside
              v-if="filesSidebarOpen"
              class="ticket-info-panel absolute inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-[var(--stroke)] bg-white shadow-2xl pc:static pc:z-auto pc:w-80 pc:max-w-[20rem] pc:shrink-0 pc:shadow-none"
            >
              <button
                type="button"
                class="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-[var(--primary-softer)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--text-primary)] pc:hidden"
                aria-label="Đóng bảng thông tin ticket"
                title="Đóng bảng thông tin ticket"
                @click="closeFilesSidebar"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
              <div class="ticket-detail-scrollbar flex-1 overflow-y-auto p-3 pt-12 pc:pt-3">
                <div class="space-y-1.5">
                  <section class="rounded-xl bg-white">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                      :aria-expanded="isTicketInfoSectionOpen('overview')"
                      @click="toggleTicketInfoSection('overview')"
                    >
                      <span>Thông tin về ticket</span>
                      <span class="material-symbols-outlined text-[18px]">{{ isTicketInfoSectionOpen('overview') ? 'expand_less' : 'expand_more' }}</span>
                    </button>
                    <Transition name="ticket-info-collapse">
                    <div v-if="isTicketInfoSectionOpen('overview')" class="space-y-1.5 pb-2 text-xs text-[var(--text-secondary)]">
                      <div class="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">
                        <span>Mã ticket</span>
                        <span class="truncate font-semibold text-[var(--text-primary)]">{{ ticketCode }}</span>
                      </div>
                      <div class="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">
                        <span>Trạng thái</span>
                        <span class="app-badge rounded-full px-2 py-1 text-[11px] font-semibold" :class="ticketStatusClass(ticket.status)">{{ ticketStatusLabel }}</span>
                      </div>
                    </div>
                    </Transition>
                  </section>

                  <section class="rounded-xl bg-white">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                      :aria-expanded="isTicketInfoSectionOpen('actions')"
                      @click="toggleTicketInfoSection('actions')"
                    >
                      <span>Tùy chỉnh ticket</span>
                      <span class="material-symbols-outlined text-[18px]">{{ isTicketInfoSectionOpen('actions') ? 'expand_less' : 'expand_more' }}</span>
                    </button>
                    <Transition name="ticket-info-collapse">
                    <div v-if="isTicketInfoSectionOpen('actions')" class="space-y-1 pb-2">
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                        @click="copyTicketCode"
                      >
                        <span class="material-symbols-outlined text-[18px]">content_copy</span>
                        <span>Sao chép mã ticket</span>
                      </button>
                      <button
                        v-if="canEditTicket"
                        type="button"
                        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                        @click="openEditModal"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                        <span>Chỉnh sửa ticket</span>
                      </button>
                    </div>
                    </Transition>
                  </section>

                  <section class="rounded-xl bg-white">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                      :aria-expanded="isTicketInfoSectionOpen('assignees')"
                      @click="toggleTicketInfoSection('assignees')"
                    >
                      <span>Người xử lý và thao tác</span>
                      <span class="material-symbols-outlined text-[18px]">{{ isTicketInfoSectionOpen('assignees') ? 'expand_less' : 'expand_more' }}</span>
                    </button>

                    <Transition name="ticket-info-collapse">
                    <div v-if="isTicketInfoSectionOpen('assignees')" class="space-y-2 pb-2">
                      <p v-if="assigneesError" class="app-field-error text-xs">{{ assigneesError }}</p>
                      <p v-else-if="assigneesLoading" class="text-xs text-[var(--text-secondary)]">Đang tải người xử lý...</p>

                      <div v-else class="space-y-1.5">
                        <div
                          v-for="member in assignees"
                          :key="member.id"
                          class="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5"
                        >
                          <span class="app-avatar-neutral relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold uppercase">
                            <span>{{ avatarInitial(member.name || `#${member.id}`) }}</span>
                            <img v-if="userAvatarUrl(member)" :src="userAvatarUrl(member)" alt="Avatar người xử lý" class="absolute inset-0 size-full object-cover" @error="$event.currentTarget.classList.add('hidden')" />
                          </span>
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-xs font-semibold text-[var(--text-primary)]">{{ member.name || `#${member.id}` }}</p>
                            <p class="text-[11px] text-[var(--text-secondary)]">Đang tiếp nhận xử lý</p>
                          </div>
                        </div>

                        <div v-if="!assignees.length" class="rounded-lg bg-[var(--surface-muted)] px-2.5 py-3 text-xs text-[var(--text-secondary)]">
                          Chưa có người xử lý.
                        </div>
                      </div>

                      <div v-if="canClaimTicket || canAdminAssignHandler || canResolveTicket" class="space-y-1 border-t border-[var(--stroke)] pt-2">
                        <button
                          v-if="canClaimTicket"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                          :disabled="assigning || resolving"
                          @click="handleClaimTicket"
                        >
                          <span class="material-symbols-outlined text-[18px]">{{ assigning ? 'hourglass_empty' : 'how_to_reg' }}</span>
                          <span>{{ assigning ? 'Đang nhận xử lý...' : 'Nhận xử lý ticket' }}</span>
                        </button>

                        <button
                          v-if="canAdminAssignHandler"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                          :disabled="assigningHandler || assignableHandlersLoading"
                          @click="toggleAssignPanel"
                        >
                          <span class="material-symbols-outlined text-[18px]">person_add</span>
                          <span>Phân công người xử lý</span>
                        </button>

                        <button
                          v-if="canResolveTicket"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                          :disabled="assigning || resolving"
                          @click="handleResolveTicket"
                        >
                          <span class="material-symbols-outlined text-[18px]" :class="resolving ? 'animate-spin' : ''">{{ resolving ? 'autorenew' : 'task_alt' }}</span>
                          <span>{{ resolving ? 'Đang xử lý...' : 'Đánh dấu đã xử lý xong' }}</span>
                        </button>
                      </div>
                    </div>
                    </Transition>
                  </section>

                  <section class="rounded-xl bg-white">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                      :aria-expanded="isTicketInfoSectionOpen('files')"
                      @click="toggleTicketInfoSection('files')"
                    >
                      <span>File phương tiện và file</span>
                      <span class="material-symbols-outlined text-[18px]">{{ isTicketInfoSectionOpen('files') ? 'expand_less' : 'expand_more' }}</span>
                    </button>

                    <Transition name="ticket-info-collapse">
                    <div v-if="isTicketInfoSectionOpen('files')" class="space-y-2 pb-2">
                      <div v-if="!exchangedFiles.length" class="rounded-lg bg-[var(--surface-muted)] px-2.5 py-6 text-center text-xs text-[var(--text-secondary)]">
                        Chưa có tệp đính kèm nào được chia sẻ.
                      </div>

                      <div v-else class="space-y-2">
                        <div
                          v-for="file in exchangedFiles"
                          :key="`${file.id}-${file.messageId}`"
                          class="flex items-start gap-2 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-muted)]"
                        >
                          <div
                            v-if="isImageFile(file.mime, file.url)"
                            class="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--primary-softer)]"
                            @click="openImagePreview(file.url, file.name)"
                          >
                            <img :src="toAbsoluteUrl(file.url)" :alt="file.name" class="absolute inset-0 size-full object-cover" />
                          </div>
                          <div
                            v-else
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-softer)] text-[var(--text-muted)]"
                          >
                            <span class="material-symbols-outlined text-[18px]">description</span>
                          </div>

                          <div class="min-w-0 flex-1">
                            <a
                              :href="toAbsoluteUrl(file.url)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="block truncate text-xs font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--primary)] hover:underline"
                              :title="file.name"
                            >
                              {{ file.name }}
                            </a>
                            <div class="mt-1 flex flex-col gap-0.5 text-[11px] text-[var(--text-secondary)]">
                              <span class="truncate font-medium">{{ file.senderName }}</span>
                              <span>{{ formatDateTime(file.createdAt) }} • {{ formatFileSize(file.size) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </Transition>
                  </section>
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
              <div v-if="assignableHandlersLoading" class="text-sm text-[var(--text-secondary)]">Đang tải danh sách handler...</div>
              <div v-else-if="assignableHandlersError" class="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
                {{ assignableHandlersError }}
              </div>

              <div v-else-if="availableAssignableHandlers.length" class="space-y-3">
                <label
                  v-for="member in availableAssignableHandlers"
                  :key="member.id"
                  class="group relative flex cursor-pointer overflow-hidden rounded-xl border border-[var(--stroke)] bg-white p-4 shadow-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
                  :class="selectedAssignableHandlerIds.includes(String(member.id)) ? 'border-[var(--primary)] bg-blue-50/50 ring-1 ring-blue-600' : ''"
                >
                  <div class="flex h-6 items-center">
                    <input
                      v-model="selectedAssignableHandlerIds"
                      :value="String(member.id)"
                      type="checkbox"
                      class="size-5 rounded border-[var(--stroke-strong)] text-[var(--primary)] focus:ring-blue-600"
                    />
                  </div>
                  <div class="ml-3 flex flex-col">
                    <span class="block text-sm font-semibold text-[var(--text-primary)]">{{ member.name || `#${member.id}` }}</span>
                    <p class="mt-0.5 text-xs text-[var(--text-secondary)]">{{ member.department_name || departmentDisplay }}</p>
                  </div>
                </label>
              </div>

              <div v-else class="rounded-2xl border border-dashed border-[var(--stroke-strong)] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
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

          <CommonModal
            v-model="editModalOpen"
            title="Chỉnh sửa ticket"
            max-width-class="max-w-2xl"
            body-class="px-4 py-3 tablet:px-5 tablet:py-3"
            :close-disabled="editSubmitting"
            container-class="fixed inset-0 z-[120]"
            @close="closeEditModal"
          >
            <form class="space-y-3" @click="closeEditSelect" @submit.prevent="submitEditTicket">
              <div v-if="editError" class="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
                {{ editError }}
              </div>

              <div class="grid grid-cols-1 gap-3 tablet:grid-cols-2">
                <div class="space-y-1.5">
                  <label for="ticket-edit-store" class="text-xs font-medium text-[var(--text-primary)]">
                    Cửa hàng <span class="text-[var(--danger-text)]">*</span>
                  </label>
                  <div class="relative" @click.stop>
                    <button
                      id="ticket-edit-store"
                      type="button"
                      class="app-input flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                      :class="editErrors.store_id ? 'app-input-invalid' : ''"
                      :disabled="editSubmitting"
                      :aria-expanded="editSelectOpen === 'store'"
                      aria-haspopup="listbox"
                      @click="toggleEditSelect('store')"
                    >
                      <span class="truncate" :class="editForm.store_id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'">
                        {{ selectedEditStoreLabel }}
                      </span>
                      <span class="material-symbols-outlined flex size-4 shrink-0 items-center justify-center text-[18px] leading-none text-[var(--text-muted)]">
                        {{ editSelectOpen === 'store' ? 'expand_less' : 'expand_more' }}
                      </span>
                    </button>

                    <div
                      v-if="editSelectOpen === 'store'"
                      class="absolute left-0 top-[calc(100%+0.25rem)] z-[130] max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--stroke)] bg-white p-1 shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                      role="listbox"
                      aria-labelledby="ticket-edit-store"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('store_id', '')"
                      >
                        <span class="truncate">Chọn cửa hàng</span>
                        <span v-if="!editForm.store_id" class="material-symbols-outlined text-[18px] text-[var(--primary)]">check</span>
                      </button>
                      <button
                        v-for="store in editStoreOptions"
                        :key="store.value"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('store_id', store.value)"
                      >
                        <span class="truncate">{{ store.label }}</span>
                        <span v-if="String(editForm.store_id) === String(store.value)" class="material-symbols-outlined shrink-0 text-[18px] text-[var(--primary)]">check</span>
                      </button>
                    </div>
                  </div>
                  <p v-if="editErrors.store_id" class="app-field-error">{{ editErrors.store_id }}</p>
                </div>

                <div class="space-y-1.5">
                  <label for="ticket-edit-department" class="text-xs font-medium text-[var(--text-primary)]">
                    Bộ phận <span class="text-[var(--danger-text)]">*</span>
                  </label>
                  <div class="relative" @click.stop>
                    <button
                      id="ticket-edit-department"
                      type="button"
                      class="app-input flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                      :class="editErrors.responsible_department_id ? 'app-input-invalid' : ''"
                      :disabled="editSubmitting"
                      :aria-expanded="editSelectOpen === 'department'"
                      aria-haspopup="listbox"
                      @click="toggleEditSelect('department')"
                    >
                      <span class="truncate" :class="editForm.responsible_department_id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'">
                        {{ selectedEditDepartmentLabel }}
                      </span>
                      <span class="material-symbols-outlined flex size-4 shrink-0 items-center justify-center text-[18px] leading-none text-[var(--text-muted)]">
                        {{ editSelectOpen === 'department' ? 'expand_less' : 'expand_more' }}
                      </span>
                    </button>

                    <div
                      v-if="editSelectOpen === 'department'"
                      class="absolute left-0 top-[calc(100%+0.25rem)] z-[130] max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--stroke)] bg-white p-1 shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                      role="listbox"
                      aria-labelledby="ticket-edit-department"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('responsible_department_id', '')"
                      >
                        <span class="truncate">Chọn bộ phận xử lý</span>
                        <span v-if="!editForm.responsible_department_id" class="material-symbols-outlined text-[18px] text-[var(--primary)]">check</span>
                      </button>
                      <button
                        v-for="department in editDepartments"
                        :key="department.id"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('responsible_department_id', String(department.id))"
                      >
                        <span class="truncate">{{ department.name }}</span>
                        <span v-if="String(editForm.responsible_department_id) === String(department.id)" class="material-symbols-outlined shrink-0 text-[18px] text-[var(--primary)]">check</span>
                      </button>
                    </div>
                  </div>
                  <p v-if="editErrors.responsible_department_id" class="app-field-error">{{ editErrors.responsible_department_id }}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 tablet:grid-cols-[minmax(0,1fr)_14rem]">
                <div class="space-y-1.5">
                  <label for="ticket-edit-title" class="text-xs font-medium text-[var(--text-primary)]">
                    Tiêu đề <span class="text-[var(--danger-text)]">*</span>
                  </label>
                  <input
                    id="ticket-edit-title"
                    v-model="editForm.title"
                    type="text"
                    class="app-input block w-full rounded-lg px-3 py-2 text-sm"
                    :class="editErrors.title ? 'app-input-invalid' : ''"
                    :disabled="editSubmitting"
                    placeholder="Nhập tiêu đề"
                  />
                  <p v-if="editErrors.title" class="app-field-error">{{ editErrors.title }}</p>
                </div>

                <div class="space-y-1.5">
                  <label for="ticket-edit-type" class="text-xs font-medium text-[var(--text-primary)]">Phân loại</label>
                  <div class="relative" @click.stop>
                    <button
                      id="ticket-edit-type"
                      type="button"
                      class="app-input flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="editSubmitting"
                      :aria-expanded="editSelectOpen === 'type'"
                      aria-haspopup="listbox"
                      @click="toggleEditSelect('type')"
                    >
                      <span class="truncate" :class="editForm.type ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'">
                        {{ selectedEditTypeLabel }}
                      </span>
                      <span class="material-symbols-outlined flex size-4 shrink-0 items-center justify-center text-[18px] leading-none text-[var(--text-muted)]">
                        {{ editSelectOpen === 'type' ? 'expand_less' : 'expand_more' }}
                      </span>
                    </button>

                    <div
                      v-if="editSelectOpen === 'type'"
                      class="absolute left-0 top-[calc(100%+0.25rem)] z-[130] max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--stroke)] bg-white p-1 shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                      role="listbox"
                      aria-labelledby="ticket-edit-type"
                    >
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('type', '')"
                      >
                        <span class="truncate">Chọn loại yêu cầu</span>
                        <span v-if="!editForm.type" class="material-symbols-outlined text-[18px] text-[var(--primary)]">check</span>
                      </button>
                      <button
                        v-for="type in issueTypes"
                        :key="type.value"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        @click="selectEditOption('type', type.value)"
                      >
                        <span class="truncate">{{ type.label }}</span>
                        <span v-if="editForm.type === type.value" class="material-symbols-outlined shrink-0 text-[18px] text-[var(--primary)]">check</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-1.5">
                <label for="ticket-edit-description" class="text-xs font-medium text-[var(--text-primary)]">
                  Nội dung <span class="text-[var(--danger-text)]">*</span>
                </label>
                <textarea
                  id="ticket-edit-description"
                  v-model="editForm.description"
                  class="app-input block w-full rounded-lg px-3 py-2 text-sm"
                  :class="editErrors.description ? 'app-input-invalid' : ''"
                  :disabled="editSubmitting"
                  rows="3"
                  placeholder="Nhập nội dung"
                ></textarea>
                <p v-if="editErrors.description" class="app-field-error">{{ editErrors.description }}</p>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-medium text-[var(--text-primary)]">Hình ảnh đính kèm</label>
                <FileUploadItem v-model="editForm.attachments_media" compact :upload-handler="handleEditTicketUpload" />
              </div>
            </form>

            <template #footer>
              <div class="flex flex-col-reverse gap-2 tablet:flex-row tablet:items-center tablet:justify-end">
                <button
                  type="button"
                  class="app-button-secondary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
                  :disabled="editSubmitting"
                  @click="closeEditModal"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  class="app-button-primary inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
                  :disabled="editSubmitting"
                  @click="submitEditTicket"
                >
                  <span v-if="editSubmitting" class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  {{ editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi' }}
                </button>
              </div>
            </template>
          </CommonModal>
        </div>
      </div>
    </section>

    <CommonModal
      v-model="imagePreview.open"
      :title="imagePreview.name || 'Ảnh đính kèm'"
      max-width-class="max-w-5xl"
      panel-class="rounded-2xl"
      body-class="p-2 tablet:p-3"
      container-class="fixed inset-0 z-[120]"
      @close="closeImagePreview"
    >
      <div class="flex min-h-[18rem] items-center justify-center rounded-xl bg-[var(--surface-muted)] p-2 tablet:min-h-[28rem]">
        <img
          :src="imagePreview.src"
          :alt="imagePreview.name"
          class="max-h-[calc(100vh-12rem)] w-full rounded-lg object-contain"
        />
      </div>
    </CommonModal>
  </div>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (min-width: 1024px) {
  .slide-right-enter-active,
  .slide-right-leave-active {
    overflow: hidden;
    transition: width 220ms ease, max-width 220ms ease, opacity 160ms ease, border-color 160ms ease;
  }

  .ticket-info-panel.slide-right-enter-from,
  .ticket-info-panel.slide-right-leave-to {
    width: 0;
    max-width: 0;
    border-left-color: transparent;
    opacity: 0;
    transform: none;
  }

.ticket-info-panel.slide-right-enter-to,
  .ticket-info-panel.slide-right-leave-from {
    width: 20rem;
    max-width: 20rem;
    opacity: 1;
    transform: none;
  }
}

.ticket-info-collapse-enter-active,
.ticket-info-collapse-leave-active {
  overflow: hidden;
  transition: opacity 160ms ease, transform 160ms ease, max-height 180ms ease;
}

.ticket-info-collapse-enter-from,
.ticket-info-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-0.25rem);
}

.ticket-info-collapse-enter-to,
.ticket-info-collapse-leave-from {
  max-height: 28rem;
  opacity: 1;
  transform: translateY(0);
}

.inbox-reply-textarea:focus-visible {
  outline: none;
  box-shadow: none;
}

.inbox-reply-textarea:focus {
  outline: none;
  box-shadow: none;
}

.ticket-detail-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #b8d7f4 transparent;
}

.ticket-detail-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.ticket-detail-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.ticket-detail-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: #b8d7f4;
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
