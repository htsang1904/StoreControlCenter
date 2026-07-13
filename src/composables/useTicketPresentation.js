const NORMALIZED_STATUS_MAP = {
  new: 'Mới',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  resolved: 'Hoàn thành',
  closed: 'Đã đóng',
  rejected: 'Từ chối',
}

const STATUS_CLASS_MAP = {
  new: 'app-badge--info',
  assigned: 'app-badge--warning',
  in_progress: 'app-badge--warning',
  resolved: 'app-badge--success',
  closed: 'app-badge--neutral',
  rejected: 'app-badge--danger',
}

export const ticketStatusOptions = [
  { value: 'new', label: 'Mới' },
  { value: 'unconfirmed', label: 'Chưa tiếp nhận' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'processing_late', label: 'Xử lý trễ' },
  { value: 'resolved', label: 'Hoàn thành' },
]

function normalizeStatusKey(status) {
  return String(status || '').toLowerCase()
}

export function normalizeTicketStatus(status) {
  const normalized = normalizeStatusKey(status)
  return NORMALIZED_STATUS_MAP[normalized] || status || 'Chưa xác định'
}

export function ticketStatusClass(status) {
  const normalized = normalizeStatusKey(status)
  return STATUS_CLASS_MAP[normalized] || STATUS_CLASS_MAP.closed
}

export function requesterDisplay(ticket) {
  if (!ticket) return ''
  return ticket.requester?.name || (ticket.requester_id ? `#${ticket.requester_id}` : '')
}

export function storeDisplay(ticket) {
  if (!ticket) return ''
  return (
    ticket.store?.name ||
    ticket.store?.shortAddress ||
    ticket.store?.address ||
    ticket.store?.code ||
    ticket.store_name ||
    ticket.store_id ||
    ''
  )
}

export function ticketSubline(ticket) {
  const store = storeDisplay(ticket)
  const department = ticket?.responsible_department?.name || ''

  if (store && department) return `${store} - ${department}`
  return store || department || ''
}

export function handlerDisplay(ticket) {
  if (!ticket) return ''
  const firstAssignee = Array.isArray(ticket.assignees) ? ticket.assignees[0] : null

  return (
    firstAssignee?.name ||
    ''
  )
}

export function ticketProcessingDurationLabel(ticket) {
  if (ticket?.processing_duration_label || ticket?.processingDurationLabel) {
    return ticket.processing_duration_label || ticket.processingDurationLabel
  }

  return ticketSlaMeta(ticket).label
}

function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}p`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `${hours}g ${minutes}p` : `${hours}g`

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}n ${remainingHours}g` : `${days}n`
}

export function ticketSlaMeta(ticket) {
  const confirmedAt = ticket?.processing_started_at || ticket?.processingStartedAt || null
  const createdAt = ticket?.createdAt || ticket?.created_at || null
  const resolvedAt = ticket?.resolved_at || ticket?.resolvedAt || null
  const status = normalizeStatusKey(ticket?.status)

  if (!createdAt) {
    return {
      stage: 'unknown',
      status: 'unknown',
      label: '',
      hint: '',
    }
  }

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) {
    return {
      stage: 'unknown',
      status: 'unknown',
      label: '',
      hint: '',
    }
  }

  if (!confirmedAt) {
    const totalMinutes = Math.max(Math.floor((Date.now() - createdDate.getTime()) / 60000), 0)
    const isLate = totalMinutes > 120
    return {
      stage: 'waiting_confirmation',
      status: isLate ? 'confirmation_late' : 'on_time',
      label: `${isLate ? 'Trễ xác nhận' : 'Chờ xác nhận'} ${formatDuration(totalMinutes)}`,
      hint: isLate ? 'Quá 2 giờ chưa xác nhận' : 'Đang chờ người xử lý nhận ticket',
    }
  }

  const confirmedDate = new Date(confirmedAt)
  if (Number.isNaN(confirmedDate.getTime())) {
    return {
      stage: 'unknown',
      status: 'unknown',
      label: '',
      hint: '',
    }
  }

  const endDate = resolvedAt ? new Date(resolvedAt) : new Date()
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() < confirmedDate.getTime()) {
    return {
      stage: 'unknown',
      status: 'unknown',
      label: '',
      hint: '',
    }
  }

  const totalMinutes = Math.max(Math.floor((endDate.getTime() - confirmedDate.getTime()) / 60000), 0)
  const isResolved = status === 'resolved' || status === 'closed'
  const isLate = !isResolved && totalMinutes > 1440

  return {
    stage: isResolved ? 'resolved' : 'processing',
    status: isLate ? 'processing_late' : 'on_time',
    label: `${isLate ? 'Trễ xử lý' : isResolved ? 'Đã xử lý' : 'Đang xử lý'} ${formatDuration(totalMinutes)}`,
    hint: isLate ? 'Quá 24 giờ từ lúc xác nhận nhưng chưa hoàn tất' : '',
  }
}

export function ticketConfirmationMeta(ticket) {
  const createdAt = ticket?.createdAt || ticket?.created_at || null
  if (!createdAt) return { label: '', isLate: false, hint: '' }

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return { label: '', isLate: false, hint: '' }

  const confirmedAt = ticket?.processing_started_at || ticket?.processingStartedAt || null
  const confirmedDate = confirmedAt ? new Date(confirmedAt) : new Date()
  if (Number.isNaN(confirmedDate.getTime()) || confirmedDate.getTime() < createdDate.getTime()) return { label: '', isLate: false, hint: '' }

  const totalMinutes = Math.max(Math.floor((confirmedDate.getTime() - createdDate.getTime()) / 60000), 0)
  const isLate = totalMinutes > 120
  return {
    label: formatDuration(totalMinutes),
    isLate,
    hint: isLate ? 'Trễ tiếp nhận' : '',
  }
}

export function ticketResolutionMeta(ticket) {
  const confirmedAt = ticket?.processing_started_at || ticket?.processingStartedAt || null
  if (!confirmedAt) return { label: '', isLate: false, hint: '' }

  const confirmedDate = new Date(confirmedAt)
  if (Number.isNaN(confirmedDate.getTime())) return { label: '', isLate: false, hint: '' }

  const resolvedAt = ticket?.resolved_at || ticket?.resolvedAt || null
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date()
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() < confirmedDate.getTime()) return { label: '', isLate: false, hint: '' }

  const status = normalizeStatusKey(ticket?.status)
  const totalMinutes = Math.max(Math.floor((endDate.getTime() - confirmedDate.getTime()) / 60000), 0)
  const isResolved = status === 'resolved' || status === 'closed'
  const isLate = totalMinutes > 1440
  return {
    label: formatDuration(totalMinutes),
    isLate,
    hint: isLate ? 'Trễ xử lý' : '',
  }
}

export function ticketDurationClass(meta) {
  return meta?.isLate ? 'text-[var(--danger-text)]' : 'text-[var(--text-secondary)]'
}

export function ticketProcessingDurationClass(ticket) {
  const meta = ticketSlaMeta(ticket)
  if (meta.status === 'confirmation_late' || meta.status === 'processing_late') return 'text-[var(--danger-text)]'
  if (meta.stage === 'waiting_confirmation') return 'text-[var(--warning-text)]'
  return 'text-[var(--text-secondary)]'
}

export function ticketProcessingAlertHint(ticket) {
  const meta = ticketSlaMeta(ticket)
  if (meta.hint) return meta.hint

  const reason = String(ticket?.processing_alert_reason || '')
  if (reason === 'unconfirmed_over_2h') return 'Quá 2 giờ chưa xác nhận'
  if (reason === 'confirmed_over_24h') return 'Quá 24 giờ chưa hoàn tất'
  return ''
}

export function avatarInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'NA'

  const words = value.split(/\s+/).filter(Boolean)
  if (!words.length) return 'NA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

export function userAvatarUrl(user = {}) {
  const url = user?.avatar_url || user?.avatarUrl || ''
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}${url}`
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatShortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
