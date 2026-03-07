<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTicketList } from '@/composables/useTicketList'
import {
  avatarInitials,
  formatDateTime,
  formatShortDate,
  handlerDisplay,
  normalizeTicketStatus,
  requesterDisplay,
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
const {
  fetchTicketReports,
  reportSummaryCards,
  syncReportRangeFromRoute,
} = useTicketReportSummary()

function goToTicketDetail(id) {
  router.push(`/ticket/${id}`)
}

function goToAddTicket() {
  router.push('/ticket/add-ticket')
}

function goToEditTicket(id) {
  router.push(`/ticket/${id}/edit`)
}

onMounted(async () => {
  await fetchTickets()
})

watch(
  () => [route.query.date_from, route.query.date_to],
  async () => {
    syncReportRangeFromRoute(route.query || {})
    await fetchTicketReports()
  },
  { immediate: true }
)

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
                  v-for="status in ticketStatusOptions"
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

            <div class="ml-auto flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <div class="relative min-w-[220px] flex-1 lg:w-[320px] lg:flex-none">
                <input
                  v-model="searchInput"
                  type="text"
                  class="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-blue-100"
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
                    <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="ticketStatusClass(ticket.status)">
                      {{ normalizeTicketStatus(ticket.status) }}
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
                <span class="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold" :class="ticketStatusClass(ticket.status)">
                  {{ normalizeTicketStatus(ticket.status) }}
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
