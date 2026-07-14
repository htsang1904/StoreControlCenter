import getClient from './http'

const http = getClient()

export const listNotifications = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return http.get(queryString ? `/api/notifications/?${queryString}` : '/api/notifications/')
}

export const markNotificationRead = (id) => {
  return http.patch(`/api/notifications/${id}/read`)
}

export const markAllNotificationsRead = () => {
  return http.patch('/api/notifications/read-all')
}

export const registerNotificationSubscription = (payload) => {
  return http.post('/api/notifications/subscriptions', payload)
}

export const getNotificationSubscriptionStatus = () => {
  return http.get('/api/notifications/subscriptions/status')
}

export const getNotificationSubscriptionDebug = () => {
  return http.get('/api/notifications/subscriptions/debug')
}

export const sendNotificationTestPush = () => {
  return http.post('/api/notifications/subscriptions/test-push')
}

export const unregisterCurrentNotificationSubscriptions = () => {
  return http.delete('/api/notifications/subscriptions')
}

export const unregisterNotificationSubscription = (subscriptionId) => {
  return http.delete(`/api/notifications/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

export const normalizeNotificationItem = (item = {}) => {
  const meta = item?.meta || item?.meta_info || {}
  const normalized = {
    ...item,
    createdAt: item?.createdAt || item?.created_at || item?.created || null,
    updatedAt: item?.updatedAt || item?.updated_at || null,
    read_at: item?.read_at || item?.readAt || null,
    ticket_id: Number(item?.ticket_id || item?.ticket?.id || meta?.ticket_id || 0) || null,
    meta,
  }

  if (!normalized.ticket && normalized.ticket_id) {
    normalized.ticket = { id: normalized.ticket_id }
  }

  return normalized
}

export const normalizeNotificationList = (items = []) => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => normalizeNotificationItem(item))
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime() || 0
      const timeB = new Date(b.createdAt || 0).getTime() || 0
      if (timeA !== timeB) return timeB - timeA
      return Number(b?.id || 0) - Number(a?.id || 0)
    })
}

export const formatNotificationTime = (value) => {
  if (!value) return '--'
  const normalizedValue = typeof value === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
    ? `${value}Z`
    : value
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const getNotificationDisplayTitle = (notification = {}) => {
  const rawTitle = String(notification?.title || 'Thông báo').trim()
  return rawTitle
    .replace(/^Phản hồi mới\s*-\s*/i, '')
    .replace(/^Ticket mới\s*-\s*/i, '')
    .trim() || 'Thông báo'
}
