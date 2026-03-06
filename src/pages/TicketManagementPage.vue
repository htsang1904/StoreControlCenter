<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteTicket as deleteTicketApi, getDashboardOverview, listTickets, reopenTicket } from '@/services/ticket_service'
import { useApp } from '@/plugins/app'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ReportPeriodDropdown from '@/components/ReportPeriodDropdown.vue'
import { resetTicketHeaderBridge, useTicketHeaderBridge } from '@/composables/ticket_header_bridge'

const router = useRouter()
const route = useRoute()
const { state } = useApp()
const ticketHeader = useTicketHeaderBridge()

const loading = ref(false)
const deletingId = ref(null)
const reopeningId = ref(null)
const errorMessage = ref('')
const tickets = ref([])
const searchInput = ref('')
const reportLoading = ref(false)
const reportError = ref('')
const timeFilterOpen = ref(false)
const reportDateFrom = ref(shiftDays(-6))
const reportDateTo = ref(shiftDays(0))
const reportData = ref({
  summary: {
    total_ticket: 0,
    in_progress: 0,
    resolved: 0,
    overdue: 0,
  },
  status: [],
  top_stores: [],
  activity_feed: [],
})

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

const hasTickets = computed(() => tickets.value.length > 0)
const canDeleteTicket = computed(() => {
  const role = String(state.userInfo?.role || '').toLowerCase()
  return role === 'store' || role === 'admin'
})
const canEditTicket = computed(() => {
  const role = String(state.userInfo?.role || '').toLowerCase()
  return role === 'store' || role === 'admin'
})

const statusOptions = [
  { value: 'new', label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Hoàn thành' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'rejected', label: 'Cần phản hồi' },
]

const selectedStatusCount = computed(() => filters.statuses.length)
const numberFormatter = new Intl.NumberFormat('vi-VN')
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

const reportSummaryCards = computed(() => [
  {
    key: 'total_ticket',
    label: 'Tổng vé hôm nay',
    value: numberFormatter.format(Number(reportData.value?.summary?.total_ticket || 0)),
    hint: 'Theo bộ lọc thời gian',
    hintClass: 'text-emerald-600',
  },
  {
    key: 'in_progress',
    label: 'Đang chờ hỗ trợ',
    value: numberFormatter.format(Number(reportData.value?.summary?.in_progress || 0)),
    hint: 'Cần ưu tiên xử lý',
    hintClass: 'text-amber-600',
  },
  {
    key: 'resolved',
    label: 'Đã hoàn thành',
    value: numberFormatter.format(Number(reportData.value?.summary?.resolved || 0)),
    hint: 'Đã đóng đúng quy trình',
    hintClass: 'text-emerald-600',
  },
  {
    key: 'overdue',
    label: 'Cần phản hồi',
    value: numberFormatter.format(Number(reportData.value?.summary?.overdue || 0)),
    hint: 'Ticket quá hạn hoặc sát hạn',
    hintClass: 'text-rose-600',
  },
])

function toIsoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function shiftDays(days) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return toIsoDate(base)
}

function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

function getDefaultRange() {
  return {
    from: shiftDays(-6),
    to: shiftDays(0),
  }
}

function normalizeRangeFromQuery(query) {
  const fallback = getDefaultRange()
  const from = isValidYmd(query?.date_from) ? String(query.date_from) : fallback.from
  const to = isValidYmd(query?.date_to) ? String(query.date_to) : fallback.to
  if (from > to) return fallback
  return { from, to }
}

function syncReportRangeFromRoute() {
  const range = normalizeRangeFromQuery(route.query || {})
  reportDateFrom.value = range.from
  reportDateTo.value = range.to
}

async function updateRouteRange(from, to) {
  if (!isValidYmd(from) || !isValidYmd(to) || from > to) return
  if (String(route.query?.date_from || '') === from && String(route.query?.date_to || '') === to) return

  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      date_from: from,
      date_to: to,
    },
  })
}

function getPresetRange(key) {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (key === 'today') {
    const day = toIsoDate(current)
    return { from: day, to: day }
  }

  if (key === 'yesterday') {
    const yesterday = new Date(current)
    yesterday.setDate(yesterday.getDate() - 1)
    const day = toIsoDate(yesterday)
    return { from: day, to: day }
  }

  if (key === 'this_month') {
    return {
      from: toIsoDate(new Date(current.getFullYear(), current.getMonth(), 1)),
      to: toIsoDate(current),
    }
  }

  if (key === 'last_month') {
    return {
      from: toIsoDate(new Date(current.getFullYear(), current.getMonth() - 1, 1)),
      to: toIsoDate(new Date(current.getFullYear(), current.getMonth(), 0)),
    }
  }

  return { from: reportDateFrom.value, to: reportDateTo.value }
}

function isPresetActive(key) {
  const preset = getPresetRange(key)
  return preset.from === reportDateFrom.value && preset.to === reportDateTo.value
}

const activePresetKey = computed(() => {
  const keys = ['today', 'yesterday', 'this_month', 'last_month']
  return keys.find((key) => isPresetActive(key)) || ''
})

async function applyPreset(key) {
  const preset = getPresetRange(key)
  await updateRouteRange(preset.from, preset.to)
  timeFilterOpen.value = false
}

async function handleReportRangeChange(payload = null) {
  const from = String(payload?.from || reportDateFrom.value || '')
  const to = String(payload?.to || reportDateTo.value || '')
  await updateRouteRange(from, to)
  timeFilterOpen.value = false
}

function goToTicketDetail(id) {
  router.push(`/ticket/${id}`)
}

function goToAddTicket() {
  router.push('/ticket/add-ticket')
}

function goToEditTicket(id) {
  router.push(`/ticket/${id}/edit`)
}

function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase() === 'assigned' ? 'in_progress' : String(status || '').toLowerCase()
  const map = {
    new: 'Mới',
    in_progress: 'Đang xử lý',
    resolved: 'Hoàn thành',
    closed: 'Đã đóng',
    rejected: 'Cần phản hồi',
  }
  return map[normalized] || status || 'Chưa xác định'
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase() === 'assigned' ? 'in_progress' : String(status || '').toLowerCase()
  const map = {
    new: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
    in_progress: 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200',
    resolved: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200',
    closed: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
    rejected: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
  }
  return map[normalized] || 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
}

function isEditableTicket(ticket) {
  if (!ticket) return false
  return ticket.status === 'new' && Number(ticket.handler?.id || ticket.handler_id || 0) <= 0
}

function canReopenTicket(ticket) {
  if (!ticket) return false
  const role = String(state.userInfo?.role || '').toLowerCase()
  return (role === 'store' || role === 'admin') && String(ticket.status || '').toLowerCase() === 'resolved'
}

function requesterDisplay(ticket) {
  if (!ticket) return '--'
  return ticket.requester?.name || `#${ticket.requester_id || '--'}`
}

function storeDisplay(ticket) {
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

function ticketSubline(ticket) {
  const store = storeDisplay(ticket)
  const department = ticket?.responsible_department?.name || ''
  if (store !== '--' && department) return `${store} - ${department}`
  return store !== '--' ? store : (department || '--')
}

function handlerDisplay(ticket) {
  if (!ticket) return 'Chưa phân công'
  const firstAssignee = Array.isArray(ticket.assignees) ? ticket.assignees[0] : null
  return (
    firstAssignee?.name ||
    ticket.handler?.name ||
    ticket.assigned_to?.name ||
    'Chưa phân công'
  )
}

function avatarInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'NA'
  const words = value.split(/\s+/).filter(Boolean)
  if (!words.length) return 'NA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase()
}

function formatDateTime(value) {
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

function formatShortDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

async function fetchTickets() {
  loading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      q: filters.q,
      status: filters.statuses.join(','),
    }

    const result = await listTickets(params)
    const payload = result?.data || result || {}
    const records = payload?.tickets || payload?.items || []
    const backendPagination = payload?.pagination || payload?.meta || {}

    tickets.value = Array.isArray(records) ? records : []

    const currentPage = Number(backendPagination.page || backendPagination.currentPage || pagination.page || 1)
    const pageSize = Number(backendPagination.pageSize || backendPagination.limit || pagination.pageSize || 10)
    const total = Number(backendPagination.total || backendPagination.totalItems || tickets.value.length || 0)
    const pageCount = Number(
      backendPagination.pageCount ||
      backendPagination.totalPages ||
      (pageSize > 0 ? Math.ceil(total / pageSize) : 1)
    )

    pagination.total = Number.isFinite(total) ? total : 0
    pagination.page = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1
    pagination.pageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
    pagination.pageCount = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1
  } catch (err) {
    tickets.value = []
    errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể tải danh sách yêu cầu.'
  } finally {
    loading.value = false
  }
}

async function fetchTicketReports() {
  reportLoading.value = true
  reportError.value = ''

  try {
    const result = await getDashboardOverview({
      date_from: reportDateFrom.value,
      date_to: reportDateTo.value,
      top_stores_limit: 20,
      activity_limit: 12,
    })
    const payload = result?.data || result || {}
    reportData.value = {
      summary: payload?.summary || {},
      status: Array.isArray(payload?.status) ? payload.status : [],
      top_stores: Array.isArray(payload?.top_stores) ? payload.top_stores : [],
      activity_feed: Array.isArray(payload?.activity_feed) ? payload.activity_feed : [],
    }
  } catch (err) {
    reportError.value = err?.response?.data?.message || err?.message || 'Không thể tải report yêu cầu xử lý.'
    reportData.value = {
      summary: {
        total_ticket: 0,
        in_progress: 0,
        resolved: 0,
        overdue: 0,
      },
      status: [],
      top_stores: [],
      activity_feed: [],
    }
  } finally {
    reportLoading.value = false
  }
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
  pagination.page += 1
  await fetchTickets()
}

async function goToPage(targetPage) {
  const page = Number(targetPage)
  if (!Number.isInteger(page) || page < 1 || page > pagination.pageCount || page === pagination.page) return
  pagination.page = page
  await fetchTickets()
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

onMounted(async () => {
  await fetchTickets()
})

watch(
  () => [route.query.date_from, route.query.date_to],
  async () => {
    syncReportRangeFromRoute()
    await fetchTicketReports()
  },
  { immediate: true }
)

watchEffect(() => {
  ticketHeader.enabled = true
  ticketHeader.title = 'Danh sách vé hỗ trợ'
  ticketHeader.subtitle = 'Quản lý và giải quyết các yêu cầu kỹ thuật từ hệ thống cửa hàng'
})

onBeforeUnmount(() => {
  resetTicketHeaderBridge()
})
</script>

<template>
  <div>
    <div class="page-stack mx-2 overflow-visible space-y-4 sm:mx-3 md:mx-0">

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="hs-dropdown [--auto-close:inside] relative inline-block">
              <button
                id="ticket-status-filter"
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded="false"
              >
                Trạng thái
                <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                </svg>
                <span
                  v-if="selectedStatusCount > 0"
                  class="inline-flex min-w-5 justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                >
                  {{ selectedStatusCount }}
                </span>
              </button>

              <div
                class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-44 z-20 bg-white shadow-md rounded-lg mt-2 border border-slate-200"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="ticket-status-filter"
              >
                <label
                  v-for="status in statusOptions"
                  :key="status.value"
                  class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    v-model="filters.statuses"
                    :value="status.value"
                    type="checkbox"
                    class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                    @change="applyStatus"
                  >
                  <span>{{ status.label }}</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              @click="timeFilterOpen = !timeFilterOpen"
            >
              Thời gian
              <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18" />
              </svg>
            </button>

            <div class="ml-auto flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <div class="relative min-w-[220px] flex-1 lg:w-[260px] lg:flex-none">
                <input
                  v-model="searchInput"
                  type="text"
                  class="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm mã vé hoặc tiêu đề"
                  @keyup.enter="applySearch"
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>
              <button
                type="button"
                class="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                @click="applySearch"
              >
                Tìm
              </button>
              <span class="ml-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sắp xếp:</span>
              <button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                Mới nhất
                <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m16 3 4 4-4 4" />
                  <path d="M20 7H4" />
                  <path d="m8 21-4-4 4-4" />
                  <path d="M4 17h16" />
                </svg>
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                @click="goToAddTicket"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Tạo vé mới
              </button>
            </div>
          </div>

          <div v-if="timeFilterOpen" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <DateRangePicker v-model:from="reportDateFrom" v-model:to="reportDateTo" :disabled="reportLoading" @change="handleReportRangeChange" />
              <ReportPeriodDropdown :active-key="activePresetKey" :disabled="reportLoading" @select="applyPreset" />
            </div>
            <p v-if="reportError" class="mt-2 text-xs text-rose-600">{{ reportError }}</p>
          </div>
        </div>

        <div v-if="errorMessage" class="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ errorMessage }}
        </div>

        <div v-loading="loading">
          <div class="hidden overflow-x-auto lg:block">
            <table class="min-w-[900px] w-full border-collapse text-left">
              <thead>
                <tr class="bg-slate-50">
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mã vé</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tiêu đề</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Người xử lý</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Ngày tạo</th>
                  <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                </tr>
              </thead>

              <tbody v-if="hasTickets" class="divide-y divide-slate-100">
                <tr
                  v-for="ticket in tickets"
                  :key="ticket.id"
                  class="cursor-pointer transition-colors hover:bg-slate-50/70"
                  @click="goToTicketDetail(ticket.id)"
                >
                  <td class="px-4 py-3 text-sm font-bold text-slate-900">{{ ticket.ticket_code || `#${ticket.id}` }}</td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-slate-900">{{ ticket.title || '--' }}</p>
                    <p class="text-xs text-slate-500">{{ ticketSubline(ticket) }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(ticket.status)">
                      {{ normalizeStatus(ticket.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex size-6 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold uppercase text-blue-700">
                        {{ avatarInitials(handlerDisplay(ticket)) }}
                      </span>
                      <span class="text-sm text-slate-600">{{ handlerDisplay(ticket) }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-500">{{ formatShortDate(ticket.createdAt) }}</td>
                  <td class="px-4 py-3 text-end">
                    <div class="hs-dropdown relative inline-flex [--placement:bottom-right]">
                      <button
                        type="button"
                        class="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        aria-haspopup="menu"
                        aria-expanded="false"
                        @click.stop
                      >
                        <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="12" cy="19" r="1.8" />
                        </svg>
                      </button>
                      <div class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-36 z-20 bg-white shadow-md rounded-lg mt-2 border border-slate-200">
                        <button
                          type="button"
                          class="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          @click.stop="goToTicketDetail(ticket.id)"
                        >
                          Xem chi tiết
                        </button>
                        <button
                          v-if="canEditTicket && isEditableTicket(ticket)"
                          type="button"
                          class="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                          @click.stop="goToEditTicket(ticket.id)"
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          v-if="canReopenTicket(ticket)"
                          type="button"
                          class="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                          :disabled="reopeningId === ticket.id"
                          @click.stop="handleReopenTicket(ticket)"
                        >
                          {{ reopeningId === ticket.id ? 'Đang mở lại...' : 'Gửi lại yêu cầu' }}
                        </button>
                        <button
                          v-if="canDeleteTicket"
                          type="button"
                          class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                          :disabled="deletingId === ticket.id"
                          @click.stop="handleDeleteTicket(ticket)"
                        >
                          {{ deletingId === ticket.id ? 'Đang xoá...' : 'Xoá yêu cầu' }}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr>
                  <td colspan="6" class="py-10">
                    <div class="flex flex-col items-center justify-center text-slate-500">
                      <p class="text-sm">Không có dữ liệu</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="space-y-3 p-3 lg:hidden">
            <div
              v-for="ticket in tickets"
              :key="ticket.id"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:bg-slate-50"
              @click="goToTicketDetail(ticket.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-bold text-slate-900">{{ ticket.ticket_code || `#${ticket.id}` }}</p>
                  <p class="mt-1 text-sm font-medium text-slate-800">{{ ticket.title || '--' }}</p>
                  <p class="text-xs text-slate-500">{{ ticketSubline(ticket) }}</p>
                </div>
                <span class="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold" :class="statusClass(ticket.status)">
                  {{ normalizeStatus(ticket.status) }}
                </span>
              </div>

              <div class="mt-3 space-y-1.5 text-sm text-slate-600">
                <p>Người xử lý: <span class="font-medium text-slate-700">{{ handlerDisplay(ticket) }}</span></p>
                <p>Người gửi: <span class="font-medium text-slate-700">{{ requesterDisplay(ticket) }}</span></p>
                <p>Ngày tạo: <span class="font-medium text-slate-700">{{ formatShortDate(ticket.createdAt) }}</span></p>
                <p>Cập nhật: <span class="font-medium text-slate-700">{{ formatDateTime(ticket.updatedAt || ticket.createdAt) }}</span></p>
              </div>

              <div v-if="canEditTicket || canDeleteTicket || canReopenTicket(ticket)" class="mt-3 flex flex-wrap gap-2">
                <button
                  v-if="canEditTicket && isEditableTicket(ticket)"
                  type="button"
                  class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  @click.stop="goToEditTicket(ticket.id)"
                >
                  Chỉnh sửa
                </button>
                <button
                  v-if="canReopenTicket(ticket)"
                  type="button"
                  class="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 disabled:opacity-50"
                  :disabled="reopeningId === ticket.id"
                  @click.stop="handleReopenTicket(ticket)"
                >
                  {{ reopeningId === ticket.id ? 'Đang mở...' : 'Gửi lại' }}
                </button>
                <button
                  v-if="canDeleteTicket"
                  type="button"
                  class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  :disabled="deletingId === ticket.id"
                  @click.stop="handleDeleteTicket(ticket)"
                >
                  {{ deletingId === ticket.id ? 'Đang xoá...' : 'Xoá' }}
                </button>
              </div>
            </div>

            <div v-if="!hasTickets" class="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              Không có dữ liệu
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
          <p class="text-sm text-slate-500">
            Hiển thị
            <span class="font-semibold text-slate-800">{{ paginationStart }}-{{ paginationEnd }}</span>
            trong
            <span class="font-semibold text-slate-800">{{ pagination.total }}</span>
            kết quả
          </p>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
              :disabled="pagination.page <= 1 || loading"
              @click="prevPage"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <template v-for="item in visiblePageItems" :key="String(item)">
              <button
                v-if="typeof item === 'number'"
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                :class="item === pagination.page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'"
                :disabled="item === pagination.page || loading"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
              <span v-else class="px-1 text-xs text-slate-400">...</span>
            </template>

            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
              :disabled="pagination.page >= pagination.pageCount || loading || pagination.pageCount === 0"
              @click="nextPage"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in reportSummaryCards"
          :key="card.key"
          class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ card.value }}</p>
          <p class="mt-2 text-xs font-medium" :class="card.hintClass">{{ card.hint }}</p>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped></style>
