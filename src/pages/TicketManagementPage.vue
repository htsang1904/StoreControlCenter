<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteTicket as deleteTicketApi, listTickets } from '@/services/ticket_service'
import { useApp } from '@/plugins/app'

const router = useRouter()
const { state } = useApp()

const loading = ref(false)
const deletingId = ref(null)
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

const hasTickets = computed(() => tickets.value.length > 0)
const canDeleteTicket = computed(() => {
  const role = String(state.userInfo?.role || '').toLowerCase()
  return role === 'store' || role === 'admin'
})

const statusOptions = [
  { value: 'new', label: 'Mới tạo' },
  { value: 'assigned', label: 'Đã phân công' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'rejected', label: 'Từ chối' },
]

const selectedStatusCount = computed(() => filters.statuses.length)

function goToTicketDetail(id) {
  router.push(`/ticket/${id}`)
}

function goToAddTicket() {
  router.push('/ticket/add-ticket')
}

function normalizeStatus(status) {
  const map = {
    new: 'Mới tạo',
    assigned: 'Đã phân công',
    in_progress: 'Đang xử lý',
    resolved: 'Đã xử lý',
    closed: 'Đã đóng',
    rejected: 'Từ chối',
  }
  return map[status] || status || 'Chưa xác định'
}

function statusClass(status) {
  const map = {
    new: 'bg-slate-100 text-slate-700',
    assigned: 'bg-cyan-100 text-cyan-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return map[status] || 'bg-slate-100 text-slate-700'
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

    const storeId = Number(state.userInfo?.store_id)
    if (Number.isInteger(storeId) && storeId > 0) {
      params.store_id = storeId
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

onMounted(async () => {
  await fetchTickets()
})
</script>

<template>
  <div>
    <div class="header max-w-full flex items-center h-[52px] p-2.5 text-[18px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500">
      Danh sách yêu cầu hỗ trợ
    </div>

    <div class="max-w-full mx-4 py-4 overflow-visible">
      <div class="flex flex-col">
        <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden dark:bg-neutral-900 dark:border-neutral-700">
          <div class="px-4 sm:px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200 dark:border-neutral-700">
            <div class="w-full md:w-auto">
              <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                <button
                  id="ticket-status-filter"
                  type="button"
                  class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-blue-600 bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-2xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-300"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  Trạng thái
                  <svg class="shrink-0 size-3.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                  <span
                    v-if="selectedStatusCount > 0"
                    class="absolute top-0 end-0 inline-flex items-center py-0.5 px-1.5 rounded-full text-xs font-medium -translate-y-1/2 translate-x-1/2 border border-white bg-blue-600 text-white"
                  >
                    {{ selectedStatusCount }}
                  </span>
                </button>

                <div
                  class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden divide-y divide-gray-200 min-w-44 z-20 bg-white shadow-md rounded-lg mt-2"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="ticket-status-filter"
                >
                  <div class="divide-y divide-gray-200">
                    <label
                      v-for="status in statusOptions"
                      :key="status.value"
                      class="flex items-center py-2.5 px-3 cursor-pointer"
                    >
                      <input
                        v-model="filters.statuses"
                        :value="status.value"
                        type="checkbox"
                        class="shrink-0 mt-0.5 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500"
                        @change="applyStatus"
                      >
                      <span class="ms-3 text-sm text-gray-800">{{ status.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto">
              <div class="relative w-full md:w-[260px]">
                <input
                  v-model="searchInput"
                  type="text"
                  class="py-2 px-3 ps-11 block w-full border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm mã yêu cầu hoặc tiêu đề"
                  @keyup.enter="applySearch"
                />
                <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                  <svg class="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <button type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 whitespace-nowrap focus:outline-hidden focus:ring-2 focus:ring-blue-100" @click="applySearch">
                Tìm kiếm
              </button>

              <button @click="goToAddTicket" type="button" class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-linear-to-r from-blue-600 to-blue-500 text-white hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-300">
                <svg class="shrink-0 size-4 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Tạo yêu cầu mới
              </button>
            </div>
          </div>

          <div v-loading="loading">
            <div v-if="errorMessage" class="px-4 sm:px-6 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {{ errorMessage }}
            </div>

            <div class="hidden lg:block max-w-full overflow-x-auto">
              <table class="min-w-[760px] w-full divide-y divide-gray-200 dark:divide-neutral-700">
                <thead class="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Mã yêu cầu</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Tiêu đề</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Người gửi</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Cửa hàng</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Bộ phận</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Trạng thái</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Cập nhật</th>
                    <th v-if="canDeleteTicket" class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700">Tác vụ</th>
                  </tr>
                </thead>

                <tbody v-if="hasTickets" class="divide-y divide-gray-200 dark:divide-neutral-700">
                  <tr
                    v-for="ticket in tickets"
                    :key="ticket.id"
                    class="bg-white hover:bg-gray-50 cursor-pointer"
                    @click="goToTicketDetail(ticket.id)"
                  >
                    <td class="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600">{{ ticket.ticket_code || `#${ticket.id}` }}</td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">{{ ticket.title || '--' }}</td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">#{{ ticket.requester_id || '--' }}</td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">{{ ticket.store_id || '--' }}</td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">{{ ticket.responsible_department?.name || '--' }}</td>
                    <td class="px-3 sm:px-4 py-2">
                      <span class="inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="statusClass(ticket.status)">
                        {{ normalizeStatus(ticket.status) }}
                      </span>
                    </td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-gray-600">{{ formatDateTime(ticket.updatedAt || ticket.createdAt) }}</td>
                    <td v-if="canDeleteTicket" class="px-3 sm:px-4 py-2 text-end">
                      <div class="hs-dropdown relative inline-flex [--placement:bottom-right]">
                        <button
                          type="button"
                          class="cursor-pointer size-8 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-600 hover:bg-gray-50"
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
                        <div class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-32 z-20 bg-white shadow-md rounded-lg mt-2 border border-gray-200">
                          <button
                            type="button"
                            class="cursor-pointer w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                    <td :colspan="canDeleteTicket ? 8 : 7" class="py-10">
                      <div class="flex flex-col items-center justify-center text-gray-500">
                        <p class="text-sm">Không có dữ liệu</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="lg:hidden p-3 sm:p-4 space-y-3">
              <div
                v-for="ticket in tickets"
                :key="ticket.id"
                class="cursor-pointer rounded-xl border border-gray-200 bg-white p-3.5 hover:bg-gray-50"
                @click="goToTicketDetail(ticket.id)"
              >
                <div v-if="canDeleteTicket" class="flex justify-end">
                  <button
                    type="button"
                    class="cursor-pointer text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                    :disabled="deletingId === ticket.id"
                    @click.stop="handleDeleteTicket(ticket)"
                  >
                    {{ deletingId === ticket.id ? 'Đang xoá...' : 'Xoá' }}
                  </button>
                </div>
                <div class="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p class="text-base font-semibold text-slate-700">Mã yêu cầu: <span class="text-blue-600">{{ ticket.ticket_code || `#${ticket.id}` }}</span></p>
                  <p class="mt-1 text-sm leading-snug font-semibold text-slate-700 line-clamp-2">{{ ticket.title || '--' }}</p>
                  <p class="mt-1 text-sm text-slate-700">• {{ normalizeStatus(ticket.status) }}</p>
                </div>

                <div class="mt-3 space-y-1.5 text-sm">
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Người gửi:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">#{{ ticket.requester_id || '--' }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Cửa hàng:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ ticket.store_id || '--' }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Bộ phận:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700 break-words">{{ ticket.responsible_department?.name || '--' }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Cập nhật:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ formatDateTime(ticket.updatedAt || ticket.createdAt) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="!hasTickets" class="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
                Không có dữ liệu
              </div>
            </div>
          </div>

          <div class="px-4 sm:px-6 py-4 flex flex-wrap gap-3 justify-between items-center border-t border-gray-200 dark:border-neutral-700">
            <div>
              <p class="text-sm text-gray-600">
                Trang <span class="font-semibold text-gray-800">{{ pagination.page }}</span>/<span class="font-semibold text-gray-800">{{ pagination.pageCount || 1 }}</span>
                - Tổng <span class="font-semibold text-gray-800">{{ pagination.total }}</span>
              </p>
            </div>

            <div class="shrink-0">
              <div class="inline-flex gap-x-2">
                <button
                  type="button"
                  class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  :disabled="pagination.page <= 1 || loading"
                  @click="prevPage"
                >
                  <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                <button
                  type="button"
                  class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                  :disabled="pagination.page >= pagination.pageCount || loading || pagination.pageCount === 0"
                  @click="nextPage"
                >
                  <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
