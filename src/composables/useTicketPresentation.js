const NORMALIZED_STATUS_MAP = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Hoàn thành',
  closed: 'Đã đóng',
  rejected: 'Cần phản hồi',
}

const STATUS_CLASS_MAP = {
  new: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  in_progress: 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200',
  closed: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  rejected: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
}

export const ticketStatusOptions = [
  { value: 'new', label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Hoàn thành' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'rejected', label: 'Cần phản hồi' },
]

function normalizeStatusKey(status) {
  const value = String(status || '').toLowerCase()
  return value === 'assigned' ? 'in_progress' : value
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
  if (!ticket) return '--'
  return ticket.requester?.name || `#${ticket.requester_id || '--'}`
}

export function storeDisplay(ticket) {
  if (!ticket) return '--'
  return (
    ticket.store?.name ||
    ticket.store?.shortAddress ||
    ticket.store?.address ||
    ticket.store?.code ||
    ticket.store_name ||
    ticket.store_id ||
    '--'
  )
}

export function ticketSubline(ticket) {
  const store = storeDisplay(ticket)
  const department = ticket?.responsible_department?.name || ''

  if (store !== '--' && department) return `${store} - ${department}`
  return store !== '--' ? store : (department || '--')
}

export function handlerDisplay(ticket) {
  if (!ticket) return 'Chưa phân công'
  const firstAssignee = Array.isArray(ticket.assignees) ? ticket.assignees[0] : null

  return (
    firstAssignee?.name ||
    ticket.handler?.name ||
    ticket.assigned_to?.name ||
    'Chưa phân công'
  )
}

export function avatarInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'NA'

  const words = value.split(/\s+/).filter(Boolean)
  if (!words.length) return 'NA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

export function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatShortDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
