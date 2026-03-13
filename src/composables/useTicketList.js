import { computed, reactive, ref } from 'vue'
import { deleteTicket as deleteTicketApi, listTickets, reopenTicket } from '@/services/ticket_service'

function normalizePagination(payload = {}, fallbackPage = 1, fallbackPageSize = 10, fallbackTotal = 0) {
  const currentPage = Number(payload.page || payload.currentPage || fallbackPage || 1)
  const pageSize = Number(payload.pageSize || payload.limit || fallbackPageSize || 10)
  const total = Number(payload.total || payload.totalItems || fallbackTotal || 0)
  const pageCount = Number(
    payload.pageCount ||
    payload.totalPages ||
    (pageSize > 0 ? Math.ceil(total / pageSize) : 1)
  )

  return {
    total: Number.isFinite(total) ? total : 0,
    page: Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    pageCount: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1,
  }
}

export function useTicketList(userInfo) {
  const loading = ref(false)
  const loadingMore = ref(false)
  const deletingId = ref(null)
  const reopeningId = ref(null)
  const errorMessage = ref('')
  const tickets = ref([])
  const searchInput = ref('')

  const filters = reactive({
    q: '',
    statuses: [],
  })

  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 0,
  })

  const userRole = computed(() => String(userInfo?.value?.role || '').toLowerCase())
  const hasTickets = computed(() => tickets.value.length > 0)
  const canDeleteTicket = computed(() => userRole.value === 'store' || userRole.value === 'admin')
  const canEditTicket = computed(() => userRole.value === 'store' || userRole.value === 'admin')
  const selectedStatusCount = computed(() => filters.statuses.length)
  const paginationStart = computed(() => {
    if (!pagination.total) return 0
    return (pagination.page - 1) * pagination.pageSize + 1
  })
  const paginationEnd = computed(() => {
    if (!pagination.total) return 0
    return Math.min(pagination.page * pagination.pageSize, pagination.total)
  })
  const visiblePageItems = computed(() => {
    const pageCount = Number(pagination.pageCount || 0)
    const currentPage = Number(pagination.page || 1)

    if (pageCount <= 0) return [1]
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, index) => index + 1)
    }

    const items = [1]
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(pageCount - 1, currentPage + 1)

    if (start > 2) items.push('dots-left')
    for (let page = start; page <= end; page += 1) {
      items.push(page)
    }
    if (end < pageCount - 1) items.push('dots-right')
    items.push(pageCount)

    return items
  })

  function isEditableTicket(ticket) {
    if (!ticket) return false
    return ticket.status === 'new' && (!Array.isArray(ticket.assignees) || ticket.assignees.length === 0)
  }

  function canReopenTicket(ticket) {
    if (!ticket) return false
    return (userRole.value === 'store' || userRole.value === 'admin') && String(ticket.status || '').toLowerCase() === 'resolved'
  }

  async function requestTickets(targetPage = pagination.page, options = {}) {
    const { append = false } = options
    const requestedPage = Number(targetPage || 1)

    if (append) {
      if (loading.value || loadingMore.value) return
      loadingMore.value = true
    } else {
      loading.value = true
      errorMessage.value = ''
    }

    try {
      const params = {
        page: requestedPage,
        pageSize: pagination.pageSize,
        q: filters.q,
        status: filters.statuses.join(','),
      }

      const result = await listTickets(params)
      const payload = result?.data || result || {}
      const records = payload?.tickets || payload?.items || []
      const backendPagination = payload?.pagination || payload?.meta || {}
      const nextRecords = Array.isArray(records) ? records : []

      if (append) {
        const existingIds = new Set(tickets.value.map((item) => Number(item?.id || 0)).filter((id) => id > 0))
        const appendedRecords = nextRecords.filter((item) => {
          const id = Number(item?.id || 0)
          if (id > 0) {
            if (existingIds.has(id)) return false
            existingIds.add(id)
          }
          return true
        })
        tickets.value = [...tickets.value, ...appendedRecords]
      } else {
        tickets.value = nextRecords
      }

      const nextPagination = normalizePagination(
        backendPagination,
        requestedPage,
        pagination.pageSize,
        append ? Math.max(pagination.total, tickets.value.length) : tickets.value.length
      )

      pagination.total = nextPagination.total
      pagination.page = nextPagination.page
      pagination.pageSize = nextPagination.pageSize
      pagination.pageCount = nextPagination.pageCount
    } catch (err) {
      if (!append) {
        tickets.value = []
        errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách yêu cầu.'
      }
    } finally {
      if (append) {
        loadingMore.value = false
      } else {
        loading.value = false
      }
    }
  }

  async function fetchTickets() {
    await requestTickets(pagination.page, { append: false })
  }

  async function applySearch() {
    filters.q = searchInput.value.trim()
    pagination.page = 1
    await fetchTickets()
  }

  async function applyStatus() {
    pagination.page = 1
    await fetchTickets()
  }

  async function prevPage() {
    if (pagination.page <= 1) return
    pagination.page -= 1
    await fetchTickets()
  }

  async function nextPage() {
    if (pagination.page >= pagination.pageCount) return
    await requestTickets(pagination.page + 1, { append: false })
  }

  async function goToPage(targetPage) {
    const page = Number(targetPage)
    if (!Number.isInteger(page) || page < 1 || page > pagination.pageCount || page === pagination.page) return
    await requestTickets(page, { append: false })
  }

  async function fetchNextPage() {
    if (loading.value || loadingMore.value) return
    if (pagination.pageCount > 0 && pagination.page >= pagination.pageCount) return
    await requestTickets(pagination.page + 1, { append: true })
  }

  async function handleDeleteTicket(ticket) {
    if (!ticket?.id || deletingId.value) return

    const canDelete = window.confirm(`Bạn có chắc muốn xoá yêu cầu ${ticket.ticket_code || `#${ticket.id}`}?`)
    if (!canDelete) return

    deletingId.value = ticket.id
    errorMessage.value = ''

    try {
      await deleteTicketApi(ticket.id)

      const isLastItemOnPage = tickets.value.length <= 1 && pagination.page > 1
      if (isLastItemOnPage) {
        pagination.page -= 1
      }

      await fetchTickets()
    } catch (err) {
      errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể xoá yêu cầu.'
    } finally {
      deletingId.value = null
    }
  }

  async function handleReopenTicket(ticket) {
    if (!ticket?.id || reopeningId.value || !canReopenTicket(ticket)) return

    const confirmed = window.confirm(`Bạn muốn mở lại yêu cầu ${ticket.ticket_code || `#${ticket.id}`}?`)
    if (!confirmed) return

    reopeningId.value = ticket.id
    errorMessage.value = ''

    try {
      await reopenTicket(ticket.id)
      await fetchTickets()
    } catch (err) {
      errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể mở lại yêu cầu.'
    } finally {
      reopeningId.value = null
    }
  }

  return {
    applySearch,
    applyStatus,
    canDeleteTicket,
    canEditTicket,
    canReopenTicket,
    deletingId,
    errorMessage,
    fetchTickets,
    fetchNextPage,
    filters,
    goToPage,
    handleDeleteTicket,
    handleReopenTicket,
    hasTickets,
    isEditableTicket,
    loading,
    loadingMore,
    nextPage,
    pagination,
    paginationEnd,
    paginationStart,
    prevPage,
    reopeningId,
    searchInput,
    selectedStatusCount,
    tickets,
    visiblePageItems,
  }
}
