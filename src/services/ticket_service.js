import getClient from './http'

const http = getClient()

export const getDashboardOverview = async (params = {}) => {
  const response = await http.post(`/api/dashboard/overview`, params)
  return response.data || response
}

export const getActiveDepartments = () => {
  return http.get('/api/departments/active')
}

export const createTicket = (payload) => {
  return http.post('/api/tickets/create', payload)
}

export const getTicketById = (id) => {
  return http.get(`/api/tickets/${id}`)
}

export const updateTicket = (id, payload) => {
  return http.put(`/api/tickets/${id}`, payload)
}

export const listTicketAssignees = (id) => {
  return http.get(`/api/tickets/${id}/assignees`)
}

export const listAssignableTicketHandlers = (id) => {
  return http.get(`/api/tickets/${id}/assignable-handlers`)
}

export const assignTicketHandler = (id, handlerId) => {
  return http.post(`/api/tickets/${id}/assignees`, {
    assignee_id: Number(handlerId),
  })
}

export const claimTicket = (id) => {
  return http.post(`/api/tickets/${id}/assignees/me`)
}

export const resolveTicket = (id) => {
  return http.post(`/api/tickets/${id}/resolve`)
}

export const reopenTicket = (id) => {
  return http.post(`/api/tickets/${id}/reopen`)
}

export const listTicketLogs = (ticketId) => {
  return http.get(`/api/tickets/${ticketId}/logs`)
}

export const createTicketLog = (payload) => {
  return http.post('/api/ticket-logs/create', payload)
}

export const uploadTicketAttachments = (formData) => {
  return http.post('/api/tickets/upload-attachments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export const listTickets = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return http.get(queryString ? `/api/tickets/?${queryString}` : '/api/tickets/')
}

export const deleteTicket = (id) => {
  return http.delete(`/api/tickets/${id}`)
}
