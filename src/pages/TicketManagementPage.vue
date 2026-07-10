<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import { useTicketList } from '@/composables/useTicketList'
import {
  avatarInitials,
  formatDateTime,
  formatShortDate,
  formatTime,
  handlerDisplay,
  normalizeTicketStatus,
  ticketConfirmationMeta,
  ticketDurationClass,
  ticketResolutionMeta,
  ticketStatusClass,
  ticketStatusOptions,
  storeDisplay,
  ticketSubline,
} from '@/composables/useTicketPresentation'
import { useTicketReportSummary } from '@/composables/useTicketReportSummary'
import { useApp } from '@/plugins/app'

const router = useRouter()
const route = useRoute()
const { state } = useApp()
const userInfo = computed(() => state.userInfo || null)
const {
  canDeleteTicket,
  canEditTicket,
  canReopenTicket,
  deletingId,
  fetchTickets,
  filters,
  handleDeleteTicket,
  handleReopenTicket,
  isEditableTicket,
  loading,
  pagination,
  paginationEnd,
  paginationStart,
  reopeningId,
  searchInput,
  selectedStatusCount,
  tickets,
  visiblePageItems,
} = useTicketList(userInfo)

const hasTickets = computed(() => tickets.value.length > 0)
const openActionMenuId = ref(null)
const actionMenuPosition = reactive({ top: 0, left: 0 })
const activeActionTicket = computed(() => (
  tickets.value.find((ticket) => ticket.id === openActionMenuId.value) || null
))

const {
  fetchTicketReports,
  reportSummaryCards,
  syncReportRangeFromRoute,
} = useTicketReportSummary()

let previousFilterQueryKey = ''
let searchDebounceTimer = null

function goToTicketDetail(id) {
  router.push({ path: '/ticket/inbox', query: { ticket: id } })
}

function goToAddTicket() {
  router.push('/ticket/add-ticket')
}

function goToEditTicket(id) {
  openActionMenuId.value = null
  router.push(`/ticket/${id}/edit`)
}

function hasTicketActions(ticket) {
  return (canEditTicket && isEditableTicket(ticket)) || canReopenTicket(ticket) || canDeleteTicket(ticket)
}

function hasAssignedHandler(ticket) {
  const firstAssignee = Array.isArray(ticket?.assignees) ? ticket.assignees[0] : null
  return Boolean(firstAssignee?.name)
}

function ticketCreatedAt(ticket) {
  return ticket?.createdAt || ticket?.created_at || null
}

function toggleActionMenu(event, ticketId) {
  if (openActionMenuId.value === ticketId) {
    closeActionMenu()
    return
  }

  const rect = event.currentTarget?.getBoundingClientRect()
  if (rect) {
    actionMenuPosition.top = rect.bottom + 8
    actionMenuPosition.left = rect.right
  }

  openActionMenuId.value = ticketId
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function reopenTicketFromMenu(ticket) {
  closeActionMenu()
  handleReopenTicket(ticket)
}

function deleteTicketFromMenu(ticket) {
  closeActionMenu()
  handleDeleteTicket(ticket)
}

function updateTicketQuery(nextQuery) {
  router.replace({
    query: {
      ...route.query,
      ...nextQuery,
    },
  })
}

function applySearchQuery() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }

  updateTicketQuery({
    q: searchInput.value.trim() || undefined,
    page: undefined,
  })
}

function scheduleSearchQuery() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    applySearchQuery()
  }, 400)
}

function applyStatusQuery() {
  updateTicketQuery({
    status: filters.statuses.join(',') || undefined,
    page: undefined,
  })
}

function goToQueryPage(page) {
  const targetPage = Number(page)
  if (!Number.isInteger(targetPage) || targetPage < 1 || targetPage === pagination.page) return
  updateTicketQuery({ page: targetPage > 1 ? String(targetPage) : undefined })
}

function prevQueryPage() {
  if (pagination.page <= 1) return
  goToQueryPage(pagination.page - 1)
}

function nextQueryPage() {
  if (pagination.page >= pagination.pageCount) return
  goToQueryPage(pagination.page + 1)
}

watch(
  () => [route.query.date_from, route.query.date_to, route.query.store_ids, route.query.q, route.query.status, route.query.page],
  async () => {
    const filterQueryKey = [
      route.query.date_from || '',
      route.query.date_to || '',
      route.query.store_ids || '',
      route.query.q || '',
      route.query.status || '',
    ].join('|')

    if (previousFilterQueryKey && previousFilterQueryKey !== filterQueryKey && route.query.page) {
      previousFilterQueryKey = filterQueryKey
      updateTicketQuery({ page: undefined })
      return
    }

    previousFilterQueryKey = filterQueryKey
    closeActionMenu()
    syncReportRangeFromRoute(route.query || {})
    const nextSearch = String(route.query.q || '')
    const nextStatuses = String(route.query.status || '')
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean)
    const nextPage = Number(route.query.page || 1)

    searchInput.value = nextSearch
    filters.q = nextSearch
    filters.statuses = nextStatuses
    pagination.page = Number.isInteger(nextPage) && nextPage > 0 ? nextPage : 1

    await Promise.allSettled([
      fetchTicketReports(),
      fetchTickets()
    ])
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  closeActionMenu()
})

</script>

<template>
  <div class="app-page min-h-full bg-[var(--surface-muted)]" @click="closeActionMenu">
    <div class="page-stack overflow-visible pb-8 tablet:pb-10">
      <!-- Mảng thẻ Overview Stats -->
      <section class="grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4">
        <StatSummaryCard
          v-for="card in reportSummaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :hint="card.hint"
          :tone="card.tone"
          class="shadow-sm border-[var(--stroke)]/60"
        />
      </section>

      <!-- Bảng Ticket chính -->
      <section class="app-section relative z-0">
          <!-- Toolbar & Filter -->
          <div class="app-section-header">
          <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-end">
            <div class="app-toolbar">
              <div class="relative w-full tablet:w-64">
                <input
                  v-model="searchInput"
                  type="text"
                  class="app-input peer h-9 w-full rounded-lg bg-[var(--surface-muted)] pl-9 pr-3 text-sm transition-colors focus:bg-white"
                  placeholder="Tìm mã ticket, tiêu đề hoặc nội dung..."
                  @input="scheduleSearchQuery"
                  @keyup.enter="applySearchQuery"
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-[var(--text-muted)] peer-focus:text-[var(--primary)] transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <div class="hs-dropdown [--auto-close:inside] relative inline-block w-full tablet:w-auto">
                <button
                  id="ticket-status-filter"
                  type="button"
                  class="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] shadow-xs transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)] tablet:w-auto tablet:justify-center"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  <span class="flex items-center gap-2">
                    <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                    </svg>
                    Trạng thái
                  </span>
                  <span
                    v-if="selectedStatusCount > 0"
                    class="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[10px] font-bold text-[var(--primary-strong)] ring-1 ring-inset ring-blue-700/10"
                  >
                    {{ selectedStatusCount }}
                  </span>
                </button>

                <div
                  class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-52 z-20 mt-2 rounded-xl border border-[var(--stroke)] bg-white p-2 shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="ticket-status-filter"
                >
                  <label
                    v-for="status in ticketStatusOptions"
                    :key="status.value"
                    class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--surface-muted)]"
                  >
                    <input
                      v-model="filters.statuses"
                      :value="status.value"
                      type="checkbox"
                      class="size-4 rounded border-[var(--stroke-strong)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-offset-0"
                      @change="applyStatusQuery"
                    >
                    <span class="text-sm font-medium text-[var(--text-secondary)]">{{ status.label }}</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="app-button-primary group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold shadow-xs transition-all hover:-translate-y-px tablet:w-auto"
                @click="goToAddTicket"
              >
                <svg class="size-4 transition-transform group-hover:rotate-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
                Tạo ticket
              </button>
            </div>
          </div>
        </div>

        <div v-loading="loading" class="min-h-[400px]">
          <!-- Table PC View -->
          <div class="app-table-scroll hidden pc:block">
            <table class="w-full min-w-[1240px] border-collapse text-left">
              <thead>
                <tr class="border-b border-[var(--stroke)] bg-[var(--surface-muted)]">
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[140px] whitespace-nowrap">Mã ticket</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[400px]">Cửa hàng</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[160px] whitespace-nowrap">Trạng thái</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[180px]">Người xử lý</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[140px]">Ngày tạo</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[130px] whitespace-nowrap">Tiếp nhận</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[130px] whitespace-nowrap">Xử lý</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-[150px] text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>

              <tbody v-if="hasTickets" class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="ticket in tickets"
                  :key="ticket.id"
                  class="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]/80"
                  @click="goToTicketDetail(ticket.id)"
                >
                  <td class="px-4 py-3 align-top">
                    <span class="inline-flex items-center whitespace-nowrap rounded-md bg-[var(--primary-softer)] px-2 py-1 text-xs font-bold text-[var(--text-secondary)] ring-1 ring-inset ring-slate-500/10 family-mono">
                      {{ ticket.ticket_code || `#${ticket.id}` }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">{{ storeDisplay(ticket) }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <span class="inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="ticketStatusClass(ticket.status)">
                      {{ normalizeTicketStatus(ticket.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div v-if="hasAssignedHandler(ticket)" class="flex items-center gap-2.5">
                      <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-softer)] text-xs font-medium uppercase text-[var(--text-secondary)] ring-1 ring-slate-200">
                        {{ avatarInitials(handlerDisplay(ticket)) }}
                      </span>
                      <span class="text-sm font-medium text-[var(--text-secondary)] truncate">{{ handlerDisplay(ticket) }}</span>
                    </div>
                    <span v-else class="text-sm font-medium text-[var(--warning-text)]"></span>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p class="whitespace-nowrap text-sm text-[var(--text-secondary)]">{{ formatShortDate(ticketCreatedAt(ticket)) }} {{ formatTime(ticketCreatedAt(ticket)) }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p class="whitespace-nowrap text-sm" :class="ticketDurationClass(ticketConfirmationMeta(ticket))">{{ ticketConfirmationMeta(ticket).label }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p class="whitespace-nowrap text-sm" :class="ticketDurationClass(ticketResolutionMeta(ticket))">{{ ticketResolutionMeta(ticket).label }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div v-if="hasTicketActions(ticket)" class="relative flex justify-end">
                      <button
                        type="button"
                        class="inline-flex size-8 items-center justify-center text-[var(--text-secondary)] transition-colors hover:text-[var(--primary)] focus:outline-none focus:text-[var(--primary)]"
                        aria-label="Mở menu thao tác"
                        :aria-expanded="openActionMenuId === ticket.id"
                        @click.stop="toggleActionMenu($event, ticket.id)"
                      >
                        <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                      </button>
                    </div>
                    <span v-else class="block text-right text-sm text-[var(--text-muted)]">--</span>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr>
                  <td colspan="8" class="px-4 py-12">
                    <div class="flex flex-col items-center justify-center text-center">
                      <div class="flex size-16 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-slate-100 mb-4">
                        <svg class="size-8 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                        </svg>
                      </div>
                      <h3 class="text-sm font-semibold text-[var(--text-primary)]">Không tìm thấy ticket nào</h3>
                      <p class="mt-1 text-sm text-[var(--text-secondary)] max-w-sm">Không có dữ liệu khớp với bộ lọc hiện tại của bạn. Thử thay đổi từ khoá hoặc dùng trợ lý tạo ticket.</p>
                      <button
                        type="button"
                        class="app-button-secondary mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                        @click="goToAddTicket"
                      >
                        <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                        </svg>
                        Trợ lý tạo ticket
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Cards Mobile View -->
          <div class="space-y-3 p-3 pc:hidden">
            <template v-if="hasTickets">
              <div
                v-for="ticket in tickets"
                :key="ticket.id"
                class="group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--stroke)] bg-white shadow-sm transition-all hover:border-[var(--stroke-strong)] hover:shadow-md active:scale-[0.99]"
                @click="goToTicketDetail(ticket.id)"
              >
                <div class="p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <span class="inline-flex items-center rounded bg-[var(--primary-softer)] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] mb-2 font-mono">
                        {{ ticket.ticket_code || `#${ticket.id}` }}
                      </span>
                      <h3 class="text-base font-semibold text-[var(--text-primary)] leading-tight group-hover:text-[var(--primary)] transition-colors">{{ ticket.title || '' }}</h3>
                      <p class="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">{{ ticketSubline(ticket) }}</p>
                    </div>
                    <div class="flex shrink-0 items-start gap-1.5">
                      <span class="inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap" :class="ticketStatusClass(ticket.status)">
                        {{ normalizeTicketStatus(ticket.status) }}
                      </span>
                      <button
                        v-if="hasTicketActions(ticket)"
                        type="button"
                        class="inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--primary)] focus:outline-none focus:text-[var(--primary)]"
                        aria-label="Mở menu thao tác"
                        :aria-expanded="openActionMenuId === ticket.id"
                        @click.stop="toggleActionMenu($event, ticket.id)"
                      >
                        <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                      </button>
                    </div>
                  </div>

                  <div class="mt-3 border-t border-[var(--stroke)] pt-3">
                    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Người xử lý</dt>
                        <dd class="mt-0.5 flex items-center gap-1.5 font-medium">
                          <span v-if="hasAssignedHandler(ticket)" class="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--primary-softer)] text-[8px] font-bold text-[var(--text-secondary)] uppercase">
                            {{ avatarInitials(handlerDisplay(ticket)) }}
                          </span>
                          <span class="truncate" :class="hasAssignedHandler(ticket) ? 'text-[var(--text-secondary)]' : 'text-[var(--warning-text)]'">{{ handlerDisplay(ticket) }}</span>
                        </dd>
                      </div>
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Ngày tạo</dt>
                        <dd class="mt-0.5 font-medium text-[var(--text-secondary)]">{{ formatShortDate(ticketCreatedAt(ticket)) }}</dd>
                      </div>
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Tiếp nhận</dt>
                        <dd class="mt-0.5 font-medium" :class="ticketDurationClass(ticketConfirmationMeta(ticket))">
                          {{ ticketConfirmationMeta(ticket).label }}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Xử lý</dt>
                        <dd class="mt-0.5 font-medium" :class="ticketDurationClass(ticketResolutionMeta(ticket))">
                          {{ ticketResolutionMeta(ticket).label }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

              </div>
            </template>

            <div v-else class="rounded-xl border border-[var(--stroke)] border-dashed p-8 text-center bg-white">
              <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface-muted)] mb-3">
                <svg class="size-6 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                </svg>
              </div>
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">Trống</h3>
              <p class="mt-1 text-sm text-[var(--text-secondary)]">Chưa có ticket nào phù hợp.</p>
              <button
                type="button"
                class="app-button-secondary mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                @click="goToAddTicket"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
                Trợ lý tạo ticket
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div class="app-pagination-bar">
          <div class="flex flex-col tablet:flex-row tablet:items-center tablet:justify-between gap-3">
            <p class="text-xs text-[var(--text-secondary)] text-center tablet:text-left">
              Đang xem <span class="font-medium text-[var(--text-primary)]">{{ paginationStart }}</span> đến <span class="font-medium text-[var(--text-primary)]">{{ paginationEnd }}</span> trên tổng <span class="font-medium text-[var(--text-primary)]">{{ pagination.total }}</span> ticket
            </p>

            <nav class="flex items-center justify-center tablet:justify-end gap-1" aria-label="Pagination">
              <button
                type="button"
                class="relative inline-flex items-center rounded-lg p-2 text-[var(--text-secondary)] ring-1 ring-inset ring-slate-300 hover:bg-[var(--surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed focus:z-20 focus:outline-offset-0 transition-colors"
                :disabled="pagination.page <= 1 || loading"
                @click="prevQueryPage"
              >
                <span class="sr-only">Previous</span>
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                </svg>
              </button>
              
              <div class="hidden tablet:flex items-center gap-1 mx-2">
                <template v-for="item in visiblePageItems" :key="String(item)">
                  <button
                    v-if="typeof item === 'number'"
                    type="button"
                    class="relative inline-flex min-w-[32px] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    :class="item === pagination.page ? 'bg-[var(--primary)] text-white focus-visible:outline-[var(--primary)]' : 'text-[var(--text-primary)] ring-1 ring-inset ring-slate-300 hover:bg-[var(--surface-muted)] focus:outline-offset-0'"
                    :disabled="item === pagination.page || loading"
                    @click="goToQueryPage(item)"
                  >
                    {{ item }}
                  </button>
                  <span v-else class="relative inline-flex items-center px-2 py-1.5 text-sm font-semibold text-[var(--text-muted)]">...</span>
                </template>
              </div>

              <button
                type="button"
                class="relative inline-flex items-center rounded-lg p-2 text-[var(--text-secondary)] ring-1 ring-inset ring-slate-300 hover:bg-[var(--surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed focus:z-20 focus:outline-offset-0 transition-colors"
                :disabled="pagination.page >= pagination.pageCount || loading || pagination.pageCount === 0"
                @click="nextQueryPage"
              >
                <span class="sr-only">Next</span>
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div
        v-if="activeActionTicket"
        class="fixed z-[9999] w-40 -translate-x-full overflow-hidden rounded-xl border border-[var(--stroke)] bg-white py-1 shadow-xl"
        :style="{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }"
        @click.stop
      >
        <button
          v-if="canEditTicket && isEditableTicket(activeActionTicket)"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
          @click="goToEditTicket(activeActionTicket.id)"
        >
          <span class="material-symbols-outlined text-[18px]">edit</span>
          <span>Sửa</span>
        </button>
        <button
          v-if="canReopenTicket(activeActionTicket)"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--warning-text)] transition-colors hover:bg-[var(--warning-bg)] disabled:opacity-50"
          :disabled="reopeningId === activeActionTicket.id"
          @click="reopenTicketFromMenu(activeActionTicket)"
        >
          <span class="material-symbols-outlined text-[18px]">refresh</span>
          <span>{{ reopeningId === activeActionTicket.id ? 'Đang mở...' : 'Mở lại' }}</span>
        </button>
        <button
          v-if="canDeleteTicket(activeActionTicket)"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)] disabled:opacity-50"
          :disabled="deletingId === activeActionTicket.id"
          @click="deleteTicketFromMenu(activeActionTicket)"
        >
          <span class="material-symbols-outlined text-[18px]">delete</span>
          <span>{{ deletingId === activeActionTicket.id ? 'Đang xoá...' : 'Xoá' }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped></style>
