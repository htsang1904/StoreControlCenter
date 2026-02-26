import getClient from './http'

const http = getClient()

export const getActiveDepartments = () => {
  return http.get('/api/departments/active')
}

export const createTicket = (payload) => {
  return http.post('/api/tickets/create', payload)
}

export const listTickets = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.append(key, String(value))
    }
  })

  return http.get(`/api/tickets?${searchParams.toString()}`)
}
