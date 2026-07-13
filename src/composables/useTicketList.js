import { computed, reactive, ref, watch } from 'vue'
import { deleteTicket as deleteTicketApi, listTickets, reopenTicket } from '@/services/ticket_service'
import { confirmDialog } from '@/composables/useConfirmDialog'
import { useRoute } from 'vue-router'
import { useToast } from '@/plugins/toast'

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
  const toast = useToast()
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
    departmentId: '',
    assigneeId: '',
    dateFrom: '',
    dateTo: '',
    storeIds: '',
  })

  const route = useRoute()

  watch(
    () => [route.query.date_from, route.query.date_to, route.query.store_ids],
    ([newFrom, newTo, newStoreIds]) => {
      filters.dateFrom = newFrom || ''
      filters.dateTo = newTo || ''
      filters.storeIds = newStoreIds || ''
      // Only auto-fetch if we're not initially setting up, but you can also leave it passive
      // or handle the trigger in components, which we do anyway on route changes.
    },
    { immediate: true }
  )

  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 0,
  })

  const userRole = computed(() => String(userInfo?.value?.role || '').toLowerCase())
  const userId = computed(() => Number(userInfo?.value?.id || userInfo?.value?.user_id || 0))
  const hasTickets = computed(() => tickets.value.length > 0)
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
    const status = String(ticket.status || '').toLowerCase()
    if (!['new', 'assigned', 'in_progress'].includes(status)) return false
    if (userRole.value === 'admin') return true
    if (userRole.value !== 'store') return false

    const assignees = Array.isArray(ticket.assignees) ? ticket.assignees : []
    const isAccepted = status !== 'new' || Boolean(ticket.processing_started_at || ticket.processingStartedAt) || assignees.length > 0
    if (isAccepted) return false

    return Number(ticket.requester_id || ticket.requester?.id || 0) === userId.value
  }

  function canReopenTicket(ticket) {
    if (!ticket) return false
    return (userRole.value === 'store' || userRole.value === 'admin') && String(ticket.status || '').toLowerCase() === 'resolved'
  }

  function canDeleteTicket(ticket) {
    if (!ticket) return false
    if (userRole.value === 'admin') return true
    return userRole.value === 'store' && Number(ticket.requester_id || ticket.requester?.id || 0) === userId.value
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
        responsible_department_id: filters.departmentId || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        store_ids: filters.storeIds || undefined,
      }

      const result = await listTickets(params)
      const records = result?.data || []
      const backendPagination = result?.pagination || {}
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
        errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách ticket.'
        toast.error(errorMessage.value)
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
    if (!ticket?.id || deletingId.value || !canDeleteTicket(ticket)) return

    const canDelete = await confirmDialog({
      title: 'Xoá ticket?',
      message: `Bạn có chắc muốn xoá ticket ${ticket.ticket_code || `#${ticket.id}`}? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xoá ticket',
      cancelText: 'Huỷ',
      tone: 'danger',
    })
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
      errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể xoá ticket.'
      toast.error(errorMessage.value)
    } finally {
      deletingId.value = null
    }
  }

  async function handleReopenTicket(ticket) {
    if (!ticket?.id || reopeningId.value || !canReopenTicket(ticket)) return

    const confirmed = await confirmDialog({
      title: 'Mở lại ticket?',
      message: `Bạn muốn mở lại ticket ${ticket.ticket_code || `#${ticket.id}`}? Ticket sẽ quay về trạng thái đang xử lý.`,
      confirmText: 'Mở lại',
      cancelText: 'Huỷ',
      tone: 'warning',
    })
    if (!confirmed) return

    reopeningId.value = ticket.id
    errorMessage.value = ''

    try {
      await reopenTicket(ticket.id)
      await fetchTickets()
    } catch (err) {
      errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể mở lại ticket.'
      toast.error(errorMessage.value)
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
