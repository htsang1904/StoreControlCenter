<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import { useApp } from '@/plugins/app'
import { getDashboardOverview, listTickets } from '@/services/ticket_service'
import { getQcStoresOverviewApi } from '@/services/qc_service'

const route = useRoute()
const { state } = useApp()

const loading = ref(false)
const errorMessage = ref('')

const ticketSummary = ref({
  total_ticket: 0,
  in_progress: 0,
  resolved: 0,
  overdue: 0,
})
const ticketTopStores = ref([])
const qcSummary = ref({
  totalSessions: 0,
  passed: 0,
  failed: 0,
  avgScore: 0,
  avgMaxScore: 0,
  avgScoreRate: 0,
  passRate: 0,
})
const recentTickets = ref([])

const dashboardRange = computed(() => {
  return normalizeDateRangeFromQuery(route.query || {}, getDefaultDateRange())
})

const stores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  return value === 'assigned' ? 'in_progress' : value
}

function statusLabel(status) {
  const map = {
    new: 'Mới',
    in_progress: 'Đang xử lý',
    resolved: 'Đã xong',
    closed: 'Đã đóng',
    rejected: 'Từ chối',
  }
  return map[normalizeStatus(status)] || 'Khác'
}

function statusClass(status) {
  const map = {
    new: 'app-badge--info',
    in_progress: 'app-badge--warning',
    resolved: 'app-badge--success',
    closed: 'app-badge--neutral',
    rejected: 'app-badge--danger',
  }
  return map[normalizeStatus(status)] || 'app-badge--neutral'
}

function storeDisplay(ticket) {
  return (
    ticket?.store?.shortAddress ||
    ticket?.store?.address ||
    ticket?.store?.code ||
    ticket?.store_name ||
    (ticket?.store_id ? `Store #${ticket.store_id}` : '--')
  )
}

function formatRelativeTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.max(Math.floor(diffMs / 60000), 0)

  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ngày trước`

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const numberFormatter = new Intl.NumberFormat('vi-VN')
const storeTonePalette = [
  {
    dotClass: 'bg-sky-500',
    railClass: 'bg-sky-100',
    fillClass: 'bg-sky-500',
    badgeClass: 'border border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    dotClass: 'bg-teal-500',
    railClass: 'bg-teal-100',
    fillClass: 'bg-teal-500',
    badgeClass: 'border border-teal-200 bg-teal-50 text-teal-700',
  },
  {
    dotClass: 'bg-amber-500',
    railClass: 'bg-amber-100',
    fillClass: 'bg-amber-500',
    badgeClass: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    dotClass: 'bg-rose-500',
    railClass: 'bg-rose-100',
    fillClass: 'bg-rose-500',
    badgeClass: 'border border-rose-200 bg-rose-50 text-rose-700',
  },
]

const kpiCards = computed(() => [
  {
    key: 'total_ticket',
    label: 'Tổng Ticket',
    value: numberFormatter.format(Number(ticketSummary.value.total_ticket || 0)),
    meta: 'Trong kỳ',
    icon: 'list_alt',
    tone: 'sky',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    value: numberFormatter.format(Number(ticketSummary.value.in_progress || 0)),
    meta: 'Cần theo dõi',
    icon: 'pending',
    tone: 'amber',
  },
  {
    key: 'qc_pass_rate',
    label: 'Tỉ lệ QC đạt',
    value: `${Number(qcSummary.value.passRate || 0)}%`,
    meta: 'Mục tiêu 95%',
    icon: 'check_circle',
    tone: 'emerald',
  },
  {
    key: 'overdue',
    label: 'Cảnh báo quá hạn',
    value: numberFormatter.format(Number(ticketSummary.value.overdue || 0)),
    meta: 'Sát SLA',
    icon: 'timer',
    tone: 'rose',
  },
])

const topStoreStats = computed(() => {
  const storesData = Array.isArray(ticketTopStores.value) ? ticketTopStores.value : []
  const maxCount = storesData.reduce((max, item) => Math.max(max, Number(item?.count || 0)), 0)

  return storesData.slice(0, 4).map((item, index) => {
    const count = Number(item?.count || 0)
    const share = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
    const palette = storeTonePalette[index % storeTonePalette.length]
    return {
      name: item?.name || `Store #${item?.store_id || '--'}`,
      count,
      percent: maxCount > 0 ? Math.max(Math.round((count / maxCount) * 100), 6) : 0,
      shareLabel: share > 0 ? `${share}% so với nhóm dẫn đầu` : 'Chưa có phát sinh',
      ...palette,
    }
  })
})

const qcInsight = computed(() => {
  const passRate = Number(qcSummary.value.passRate || 0)

  if (passRate >= 90) {
    return {
      panelClass: 'border-emerald-200 bg-emerald-50/70',
      iconClass: 'bg-emerald-100 text-emerald-700',
      title: 'Chất lượng QC đang ổn định',
      body: `Tỉ lệ QC đạt hiện ở mức ${passRate}%. Có thể tiếp tục giữ nhịp kiểm tra như hiện tại và theo dõi các cửa hàng đang tăng ticket.`,
    }
  }

  if (passRate >= 75) {
    return {
      panelClass: 'border-amber-200 bg-amber-50/75',
      iconClass: 'bg-amber-100 text-amber-700',
      title: 'Có tín hiệu cần theo dõi thêm',
      body: `Tỉ lệ QC đạt đang là ${passRate}%. Nên rà soát nhóm cửa hàng có nhiều ticket hoặc đang có kết quả QC không ổn định.`,
    }
  }

  return {
    panelClass: 'border-rose-200 bg-rose-50/80',
    iconClass: 'bg-rose-100 text-rose-700',
    title: 'Ưu tiên siết lại chất lượng vận hành',
    body: `Tỉ lệ QC đạt hiện chỉ còn ${passRate}%. Nên tập trung vào các cửa hàng có ticket tăng nhanh và kết quả QC dưới chuẩn.`,
  }
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  const storeIds = stores.value
    .map((store) => Number(store?.id || 0))
    .filter((storeId) => Number.isInteger(storeId) && storeId > 0)

  const [ticketOverviewResult, qcOverviewResult, recentTicketsResult] = await Promise.allSettled([
    getDashboardOverview({
      date_from: dashboardRange.value.from,
      date_to: dashboardRange.value.to,
      top_stores_limit: 8,
      activity_limit: 8,
    }),
    getQcStoresOverviewApi({
      from: dashboardRange.value.from,
      to: dashboardRange.value.to,
      page: 1,
      pageSize: 5000,
      storeIds,
    }),
    listTickets({
      page: 1,
      pageSize: 6,
    }),
  ])

  if (ticketOverviewResult.status === 'fulfilled') {
    const ticketPayload = ticketOverviewResult.value?.data || ticketOverviewResult.value || {}
    ticketSummary.value = {
      total_ticket: Number(ticketPayload?.summary?.total_ticket || 0),
      in_progress: Number(ticketPayload?.summary?.in_progress || 0),
      resolved: Number(ticketPayload?.summary?.resolved || 0),
      overdue: Number(ticketPayload?.summary?.overdue || 0),
    }
    ticketTopStores.value = Array.isArray(ticketPayload?.top_stores) ? ticketPayload.top_stores : []
  } else {
    ticketSummary.value = {
      total_ticket: 0,
      in_progress: 0,
      resolved: 0,
      overdue: 0,
    }
    ticketTopStores.value = []
    errorMessage.value = ticketOverviewResult.reason?.response?.data?.message || ticketOverviewResult.reason?.message || 'Không thể tải dữ liệu ticket.'
  }

  if (qcOverviewResult.status === 'fulfilled') {
    const remoteSummary = qcOverviewResult.value?.summary || {}
    qcSummary.value = {
      totalSessions: Number(remoteSummary.totalSessions || 0),
      passed: Number(remoteSummary.passed || 0),
      failed: Number(remoteSummary.failed || 0),
      avgScore: Number(remoteSummary.avgScore || 0),
      avgMaxScore: Number(remoteSummary.avgMaxScore || 0),
      avgScoreRate: Number(remoteSummary.avgScoreRate || 0),
      passRate: Number(remoteSummary.passRate || 0),
    }
  } else {
    qcSummary.value = {
      totalSessions: 0,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgMaxScore: 0,
      avgScoreRate: 0,
      passRate: 0,
    }
    if (!errorMessage.value) {
      errorMessage.value = qcOverviewResult.reason?.response?.data?.message || qcOverviewResult.reason?.message || 'Không thể tải dữ liệu QC.'
    }
  }

  if (recentTicketsResult.status === 'fulfilled') {
    const payload = recentTicketsResult.value?.data || []
    recentTickets.value = Array.isArray(payload) ? payload.slice(0, 6) : []
  } else {
    recentTickets.value = []
    if (!errorMessage.value) {
      errorMessage.value = recentTicketsResult.reason?.response?.data?.message || recentTicketsResult.reason?.message || 'Không thể tải danh sách ticket gần đây.'
    }
  }

  loading.value = false
}

watch(
  [
    stores,
    () => dashboardRange.value.from,
    () => dashboardRange.value.to,
  ],
  () => {
    loadDashboard()
  },
  { immediate: true }
)
</script>

<template>
  <div class="page-stack space-y-4 px-3 py-3">
    <p v-if="errorMessage" class="app-state-banner text-xs">
      {{ errorMessage }}
    </p>

    <section class="grid grid-cols-1 gap-4 tablet:grid-cols-2 pc:grid-cols-4">
      <StatSummaryCard
        v-for="card in kpiCards"
        :key="card.key"
        :label="card.label"
        :value="card.value"
        :meta="card.meta"
        :icon="card.icon"
        :tone="card.tone"
      />
    </section>

    <section class="grid grid-cols-1 gap-6 pc:grid-cols-3">
      <article class="overflow-hidden rounded-xl border border-slate-200 bg-white pc:col-span-2">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="text-sm font-bold text-slate-800">Ticket gần đây</h3>
          <router-link to="/ticket" class="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">Xem tất cả</router-link>
        </div>

        <div class="pc:hidden">
          <div v-if="recentTickets.length" class="divide-y divide-slate-100">
            <article
              v-for="ticket in recentTickets"
              :key="ticket.id"
              class="px-5 py-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {{ ticket.ticket_code || `#${ticket.id}` }}
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">
                    {{ ticket.title || 'Không có tiêu đề' }}
                  </p>
                </div>

                <span
                  class="app-badge inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                  :class="statusClass(ticket.status)"
                >
                  {{ statusLabel(ticket.status) }}
                </span>
              </div>

              <div class="mt-3 grid grid-cols-1 gap-3 tablet:grid-cols-2">
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cửa hàng</p>
                  <p class="mt-1 text-sm font-medium text-slate-700">{{ storeDisplay(ticket) }}</p>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Thời gian</p>
                  <p class="mt-1 text-sm font-medium text-slate-700">{{ formatRelativeTime(ticket.createdAt) }}</p>
                </div>
              </div>
            </article>
          </div>

          <div v-else-if="!loading" class="px-5 py-5">
            <div class="app-state-panel app-state-panel--compact">
              <div class="app-state-stack mx-auto">
                <div class="app-state-icon mx-auto">
                  <span class="material-symbols-outlined text-[24px]">inbox</span>
                </div>
                <p class="app-state-title">Chưa có ticket trong giai đoạn này.</p>
                <p class="app-state-body">Thay đổi khoảng thời gian hoặc quay lại sau khi có hoạt động mới.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="hidden overflow-x-auto pc:block">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="bg-slate-50 text-slate-500">
                <th class="px-5 py-3 font-medium">Mã Ticket</th>
                <th class="px-5 py-3 font-medium">Vấn đề</th>
                <th class="px-5 py-3 font-medium">Cửa hàng</th>
                <th class="px-5 py-3 font-medium">Trạng thái</th>
                <th class="px-5 py-3 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="ticket in recentTickets" :key="ticket.id" class="transition-colors hover:bg-slate-50">
                <td class="px-5 py-4 font-medium text-slate-500">{{ ticket.ticket_code || `#${ticket.id}` }}</td>
                <td class="px-5 py-4 text-slate-700">{{ ticket.title || 'Không có tiêu đề' }}</td>
                <td class="px-5 py-4 text-slate-700">{{ storeDisplay(ticket) }}</td>
                <td class="px-5 py-4">
                  <span
                    class="app-badge rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase"
                    :class="statusClass(ticket.status)"
                  >
                    {{ statusLabel(ticket.status) }}
                  </span>
                </td>
                <td class="px-5 py-4 text-slate-500">{{ formatRelativeTime(ticket.createdAt) }}</td>
              </tr>
              <tr v-if="!recentTickets.length && !loading">
                <td colspan="5" class="px-5 py-5">
                  <div class="app-state-panel app-state-panel--compact">
                    <div class="app-state-stack mx-auto">
                      <div class="app-state-icon mx-auto">
                        <span class="material-symbols-outlined text-[24px]">inbox</span>
                      </div>
                      <p class="app-state-title">Chưa có ticket trong giai đoạn này.</p>
                      <p class="app-state-body">Thay đổi khoảng thời gian hoặc quay lại sau khi có hoạt động mới.</p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-[24px] border border-slate-200 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-slate-500">Vận hành theo cửa hàng</p>
            <h3 class="mt-1 text-base font-semibold text-slate-900">Hiệu suất theo cửa hàng</h3>
          </div>
          <span class="app-badge app-badge--neutral rounded-full px-2.5 py-1 text-[11px] font-semibold">
            Top 4 ticket
          </span>
        </div>

        <div v-if="topStoreStats.length" class="mt-6 space-y-4">
          <article
            v-for="store in topStoreStats"
            :key="store.name"
            class="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="mt-0.5 size-2 shrink-0 rounded-full" :class="store.dotClass"></span>
                  <p class="truncate text-sm font-medium text-slate-800">{{ store.name }}</p>
                </div>
                <p class="mt-1 text-xs text-slate-500">{{ store.shareLabel }}</p>
              </div>

              <span
                class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                :class="store.badgeClass"
              >
                {{ store.count }} ticket
              </span>
            </div>

            <div class="mt-3 h-2 w-full rounded-full" :class="store.railClass">
              <div class="h-2 rounded-full transition-all duration-500" :class="store.fillClass" :style="{ width: `${store.percent}%` }"></div>
            </div>
          </article>
        </div>

        <div v-else-if="!loading" class="mt-6">
          <div class="app-state-panel app-state-panel--compact">
            <div class="app-state-stack mx-auto">
              <div class="app-state-icon mx-auto">
                <span class="material-symbols-outlined text-[24px]">equalizer</span>
              </div>
              <p class="app-state-title">Chưa có dữ liệu cửa hàng nổi bật.</p>
              <p class="app-state-body">Khi ticket phát sinh nhiều hơn, khu vực này sẽ giúp bạn nhận ra nhóm cửa hàng cần theo dõi.</p>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-[20px] border p-4" :class="qcInsight.panelClass">
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-2xl" :class="qcInsight.iconClass">
              <span class="material-symbols-outlined text-[18px]">insights</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ qcInsight.title }}</p>
              <p class="mt-1 text-sm leading-6 text-slate-600">{{ qcInsight.body }}</p>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
