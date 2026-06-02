<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import { useTicketList } from '@/composables/useTicketList'
import {
  avatarInitials,
  formatDateTime,
  formatShortDate,
  handlerDisplay,
  normalizeTicketStatus,
  requesterDisplay,
  ticketProcessingAlertHint,
  ticketProcessingDurationClass,
  ticketProcessingDurationLabel,
  ticketStatusClass,
  ticketStatusOptions,
  ticketSubline,
} from '@/composables/useTicketPresentation'
import { useTicketReportSummary } from '@/composables/useTicketReportSummary'
import { useApp } from '@/plugins/app'

const router = useRouter()
const route = useRoute()
const { state } = useApp()
const userInfo = computed(() => state.userInfo || null)
const {
  applySearch,
  applyStatus,
  canDeleteTicket,
  canEditTicket,
  canReopenTicket,
  deletingId,
  errorMessage,
  fetchTickets,
  filters,
  goToPage,
  handleDeleteTicket,
  handleReopenTicket,
  hasTickets,
  isEditableTicket,
  loading,
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
} = useTicketList(userInfo)

const tabTickets = computed(() => tickets.value)

const hasTabTickets = computed(() => tabTickets.value.length > 0)

const {
  fetchTicketReports,
  reportSummaryCards,
  syncReportRangeFromRoute,
} = useTicketReportSummary()

const selectedStores = ref([])
watch(
  () => route.query.store_ids,
  (newVal) => {
    if (typeof newVal === 'string' && newVal.trim() !== '') {
      const parsed = newVal.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
      if (parsed.join(',') !== selectedStores.value.join(',')) {
        selectedStores.value = parsed
      }
    } else {
       selectedStores.value = []
    }
  },
  { immediate: true }
)

watch(selectedStores, (newVal) => {
  const currentQ = String(route.query.store_ids || '')
  const newQ = newVal.join(',')
  if (currentQ !== newQ) {
    if (newQ === '') {
      const q = { ...route.query }
      delete q.store_ids
      router.replace({ query: q })
    } else {
      router.replace({ query: { ...route.query, store_ids: newQ } })
    }
  }
})

function goToTicketDetail(id) {
  router.push(`/ticket/${id}`)
}

function goToAddTicket() {
  router.push('/ticket/add-ticket')
}

function goToTicketInbox() {
  router.push('/ticket/inbox')
}

function goToEditTicket(id) {
  router.push(`/ticket/${id}/edit`)
}

watch(
  () => [route.query.date_from, route.query.date_to, route.query.store_ids],
  async () => {
    syncReportRangeFromRoute(route.query || {})
    await Promise.allSettled([
      fetchTicketReports(),
      fetchTickets()
    ])
  },
  { immediate: true }
)

</script>

<template>
  <div class="h-full bg-slate-50/50 p-4 tablet:p-5 pc:p-6">
    <div class="page-stack overflow-visible space-y-4">
      <!-- Mảng thẻ Overview Stats -->
      <section class="grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4">
        <StatSummaryCard
          v-for="card in reportSummaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :icon="card.icon"
          :tone="card.tone"
          class="shadow-sm border-slate-200/60"
        />
      </section>

      <!-- Bảng Ticket chính -->
      <section>
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm relative z-0">
          <!-- Toolbar & Filter -->
          <div class="border-b border-slate-100 bg-white p-3">
          <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-blue-950 tracking-tight hidden pc:block">Tất cả Tickets</h2>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-blue-950 transition-colors focus:ring-2 focus:ring-slate-200 focus:outline-none"
                @click="goToTicketInbox"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 12.839a3.342 3.342 0 0 0-.1.661Z" />
                </svg>
                Chế độ inbox
              </button>
            </div>

            <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center">
              <div class="relative w-full tablet:w-64">
                <input
                  v-model="searchInput"
                  type="text"
                  class="peer h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-blue-950 placeholder-slate-400 transition-colors hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Tìm mã vé hoặc tiêu đề..."
                  @keyup.enter="applySearch"
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-slate-400 peer-focus:text-blue-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <div class="hs-dropdown [--auto-close:inside] relative inline-block w-full tablet:w-auto">
                <button
                  id="ticket-status-filter"
                  type="button"
                  class="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-100 tablet:w-auto tablet:justify-center"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  <span class="flex items-center gap-2">
                    <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                    </svg>
                    Trạng thái
                  </span>
                  <span
                    v-if="selectedStatusCount > 0"
                    class="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10"
                  >
                    {{ selectedStatusCount }}
                  </span>
                </button>

                <div
                  class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-48 z-20 mt-2 rounded-xl border border-slate-100 bg-white p-2 shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="ticket-status-filter"
                >
                  <label
                    v-for="status in ticketStatusOptions"
                    :key="status.value"
                    class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                  >
                    <input
                      v-model="filters.statuses"
                      :value="status.value"
                      type="checkbox"
                      class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                      @change="applyStatus"
                    >
                    <span class="text-sm font-medium text-slate-700">{{ status.label }}</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 tablet:w-auto"
                @click="goToAddTicket"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
                Tạo vé
              </button>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <div class="flex items-center gap-3">
            <svg class="size-5 text-red-500 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            {{ errorMessage }}
          </div>
        </div>

        <div v-loading="loading" class="min-h-[400px]">
          <!-- Table PC View -->
          <div class="hidden overflow-x-auto pc:block">
            <table class="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50/50">
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[120px]">Mã vé</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Tiêu đề & Nội dung</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[140px]">Trạng thái</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[180px]">Người xử lý</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[140px]">Ngày tạo</th>
                  <th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 w-[160px]">Tiến độ</th>
                </tr>
              </thead>

              <tbody v-if="hasTabTickets" class="divide-y divide-slate-100 bg-white">
                <tr
                  v-for="ticket in tabTickets"
                  :key="ticket.id"
                  class="group cursor-pointer transition-colors hover:bg-slate-50/80"
                  @click="goToTicketDetail(ticket.id)"
                >
                  <td class="px-4 py-3 align-top">
                    <span class="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10 family-mono">
                      {{ ticket.ticket_code || `#${ticket.id}` }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-semibold text-blue-950 group-hover:text-blue-600 transition-colors line-clamp-1">{{ ticket.title || '--' }}</p>
                    <p class="mt-1 text-xs text-slate-500 line-clamp-1 truncate max-w-md">{{ ticketSubline(ticket) }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset" :class="ticketStatusClass(ticket.status)">
                      {{ normalizeTicketStatus(ticket.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <div class="flex items-center gap-2.5">
                      <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium uppercase text-slate-600 ring-1 ring-slate-200">
                        {{ avatarInitials(handlerDisplay(ticket)) }}
                      </span>
                      <span class="text-sm font-medium text-slate-700 truncate">{{ handlerDisplay(ticket) }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p class="text-sm text-slate-600">{{ formatShortDate(ticket.createdAt) }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">{{ formatDateTime(ticket.createdAt).split(' ')[1] }}</p>
                  </td>
                  <td class="px-4 py-3 align-top">
                    <p class="text-sm font-medium" :class="ticketProcessingDurationClass(ticket)">
                      {{ ticketProcessingDurationLabel(ticket) }}
                    </p>
                    <p v-if="ticketProcessingAlertHint(ticket)" class="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                      <svg class="size-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                      </svg>
                      {{ ticketProcessingAlertHint(ticket) }}
                    </p>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr>
                  <td colspan="6" class="px-4 py-12">
                    <div class="flex flex-col items-center justify-center text-center">
                      <div class="flex size-16 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-100 mb-4">
                        <svg class="size-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                        </svg>
                      </div>
                      <h3 class="text-sm font-semibold text-blue-950">Không tìm thấy vé nào</h3>
                      <p class="mt-1 text-sm text-slate-500 max-w-sm">Không có dữ liệu khớp với bộ lọc hiện tại của bạn. Thử thay đổi từ khoá hoặc dùng trợ lý tạo vé.</p>
                      <button
                        type="button"
                        class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                        @click="goToAddTicket"
                      >
                        <svg class="size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                        </svg>
                        Trợ lý tạo vé
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Cards Mobile View -->
          <div class="space-y-3 p-3 pc:hidden">
            <template v-if="hasTabTickets">
              <div
                v-for="ticket in tabTickets"
                :key="ticket.id"
                class="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                @click="goToTicketDetail(ticket.id)"
              >
                <div class="p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-slate-600 mb-2 font-mono">
                        {{ ticket.ticket_code || `#${ticket.id}` }}
                      </span>
                      <h3 class="text-base font-semibold text-blue-950 leading-tight group-hover:text-blue-600 transition-colors">{{ ticket.title || '--' }}</h3>
                      <p class="mt-1 text-sm text-slate-500 line-clamp-2">{{ ticketSubline(ticket) }}</p>
                    </div>
                    <span class="inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap" :class="ticketStatusClass(ticket.status)">
                      {{ normalizeTicketStatus(ticket.status) }}
                    </span>
                  </div>

                  <div class="mt-3 border-t border-slate-100 pt-3">
                    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-slate-400">Người xử lý</dt>
                        <dd class="mt-0.5 font-medium text-slate-700 flex items-center gap-1.5">
                          <span class="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500 uppercase">
                            {{ avatarInitials(handlerDisplay(ticket)) }}
                          </span>
                          <span class="truncate">{{ handlerDisplay(ticket) }}</span>
                        </dd>
                      </div>
                      <div>
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-slate-400">Ngày tạo</dt>
                        <dd class="mt-0.5 font-medium text-slate-700">{{ formatShortDate(ticket.createdAt) }}</dd>
                      </div>
                      <div class="col-span-2">
                        <dt class="text-[11px] font-medium uppercase tracking-wider text-slate-400">Thời gian xử lý</dt>
                        <dd class="mt-0.5 font-medium flex items-center justify-between" :class="ticketProcessingDurationClass(ticket)">
                          <span>{{ ticketProcessingDurationLabel(ticket) }}</span>
                          <span v-if="ticketProcessingAlertHint(ticket)" class="flex items-center gap-1 text-xs text-rose-600">
                             <svg class="size-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                              </svg>
                            {{ ticketProcessingAlertHint(ticket) }}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div v-if="canEditTicket || canDeleteTicket || canReopenTicket(ticket)" class="border-t border-slate-100 bg-slate-50 px-3 py-2.5 flex items-center justify-end gap-2">
                  <button
                    v-if="canEditTicket && isEditableTicket(ticket)"
                    type="button"
                    class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
                    @click.stop="goToEditTicket(ticket.id)"
                  >
                    Sửa
                  </button>
                  <button
                    v-if="canReopenTicket(ticket)"
                    type="button"
                    class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-inset ring-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    :disabled="reopeningId === ticket.id"
                    @click.stop="handleReopenTicket(ticket)"
                  >
                    {{ reopeningId === ticket.id ? 'Đang mở...' : 'Mở lại' }}
                  </button>
                  <button
                    v-if="canDeleteTicket"
                    type="button"
                    class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                    :disabled="deletingId === ticket.id"
                    @click.stop="handleDeleteTicket(ticket)"
                  >
                    {{ deletingId === ticket.id ? 'Đang xoá...' : 'Xoá' }}
                  </button>
                </div>
              </div>
            </template>

            <div v-else class="rounded-xl border border-slate-200 border-dashed p-8 text-center bg-white">
              <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-50 mb-3">
                <svg class="size-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                </svg>
              </div>
              <h3 class="text-sm font-semibold text-blue-950">Trống</h3>
              <p class="mt-1 text-sm text-slate-500">Chưa có ticket nào phù hợp.</p>
            </div>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div class="border-t border-slate-200 bg-white px-3 py-2.5 tablet:px-4 tablet:py-3">
          <div class="flex flex-col tablet:flex-row tablet:items-center tablet:justify-between gap-3">
            <p class="text-xs text-slate-700 text-center tablet:text-left">
              Đang xem <span class="font-medium text-blue-950">{{ paginationStart }}</span> đến <span class="font-medium text-blue-950">{{ paginationEnd }}</span> trên tổng <span class="font-medium text-blue-950">{{ pagination.total }}</span> vé
            </p>

            <nav class="flex items-center justify-center tablet:justify-end gap-1" aria-label="Pagination">
              <button
                type="button"
                class="relative inline-flex items-center rounded-lg p-2 text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-20 focus:outline-offset-0 transition-colors"
                :disabled="pagination.page <= 1 || loading"
                @click="prevPage"
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
                    :class="item === pagination.page ? 'bg-blue-600 text-white focus-visible:outline-blue-600' : 'text-blue-950 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-offset-0'"
                    :disabled="item === pagination.page || loading"
                    @click="goToPage(item)"
                  >
                    {{ item }}
                  </button>
                  <span v-else class="relative inline-flex items-center px-2 py-1.5 text-sm font-semibold text-slate-400">...</span>
                </template>
              </div>

              <button
                type="button"
                class="relative inline-flex items-center rounded-lg p-2 text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:z-20 focus:outline-offset-0 transition-colors"
                :disabled="pagination.page >= pagination.pageCount || loading || pagination.pageCount === 0"
                @click="nextPage"
              >
                <span class="sr-only">Next</span>
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped></style>
