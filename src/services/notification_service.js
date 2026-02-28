import getClient from './http'

const http = getClient()

export const listNotifications = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.append(key, String(value))
    }
  })

  return http.get(`/api/notifications?${searchParams.toString()}`)
}

export const markNotificationRead = (id) => {
  return http.patch(`/api/notifications/${id}/read`)
}

export const markAllNotificationsRead = () => {
  return http.patch('/api/notifications/read-all')
}

