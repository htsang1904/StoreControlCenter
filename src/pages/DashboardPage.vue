<script setup>
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
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

// Mock Data
const mockAvgProcessingTime = ref(2.5) 
const mockStoreTicketStats = ref([
  { id: 1, name: 'CH Nguyễn Trãi', ticketCount: 45, avgSupportTime: 2.1 },
  { id: 2, name: 'CH Lê Duẩn', ticketCount: 38, avgSupportTime: 1.8 },
  { id: 3, name: 'CH Phạm Văn Đồng', ticketCount: 30, avgSupportTime: 2.5 },
  { id: 4, name: 'CH Hai Bà Trưng', ticketCount: 25, avgSupportTime: 3.2 },
  { id: 5, name: 'CH Quận 7', ticketCount: 15, avgSupportTime: 1.5 },
])
const mockTopQcStores = ref([
  { id: 1, name: 'CH Quận 7', qcScore: 98, passRate: 100 },
  { id: 2, name: 'CH Lê Duẩn', qcScore: 95, passRate: 98 },
  { id: 3, name: 'CH Nguyễn Trãi', qcScore: 92, passRate: 95 },
  { id: 4, name: 'CH Gò Vấp', qcScore: 90, passRate: 90 },
])
const mockStoreErrors = ref([
  { id: 4, name: 'CH Hai Bà Trưng', errorCount: 12, failRate: 15 },
  { id: 5, name: 'CH Phạm Văn Đồng', errorCount: 8, failRate: 10 },
  { id: 6, name: 'CH Quận 12', errorCount: 5, failRate: 8 },
  { id: 7, name: 'CH Bình Tân', errorCount: 4, failRate: 5 },
])

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
    key: 'avg_processing_time',
    label: 'TB Thời gian xử lý',
    value: `${mockAvgProcessingTime.value} giờ`,
    meta: 'Trên mỗi ticket',
    icon: 'schedule',
    tone: 'indigo',
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

const chartPeriod = ref('month')
const chartPeriodOptions = [
  { value: 'week', label: '7 ngày qua' },
  { value: 'month', label: 'Trong Tháng' },
  { value: 'year', label: 'Cả Năm' }
]

const chartStoreFilter = ref('all')
const chartMultiplier = computed(() => {
  if (chartStoreFilter.value === 'all') return 1
  return (String(chartStoreFilter.value).charCodeAt(0) % 3 + 1) * 0.4 + 0.2
})

const ticketChartData = computed(() => {
  const mult = chartMultiplier.value
  if (chartPeriod.value === 'week') {
    return {
      categories: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      tickets: [12, 19, 15, 22, 18, 30, 25].map(v => Math.round(v * mult)),
      supportTime: [2.1, 1.8, 2.5, 2.0, 1.5, 3.2, 2.8].map(v => Number((v * (1.5 - mult * 0.5)).toFixed(1)))
    }
  } else if (chartPeriod.value === 'year') {
    return {
      categories: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      tickets: [120, 150, 180, 130, 200, 250, 220, 190, 210, null, null, null].map(v => v ? Math.round(v * mult) : null),
      supportTime: [2.5, 2.3, 2.1, 2.0, 2.8, 3.1, 2.4, 2.1, 1.9, null, null, null].map(v => v ? Number((v * (1.5 - mult * 0.5)).toFixed(1)) : null)
    }
  }
  return {
    categories: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
    tickets: [45, 60, 55, 70].map(v => Math.round(v * mult)),
    supportTime: [2.2, 2.0, 2.5, 1.9].map(v => Number((v * (1.5 - mult * 0.5)).toFixed(1)))
  }
})

const qcChartData = computed(() => {
  const mult = chartMultiplier.value
  const scoreMod = (mult - 1) * 5
  if (chartPeriod.value === 'week') {
    return {
      categories: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      scores: [90, 92, 88, 95, 96, 91, 94].map(v => Math.min(100, Math.max(0, Math.round(v + scoreMod)))),
      passRates: [95, 98, 90, 100, 100, 92, 97].map(v => Math.min(100, Math.max(0, Math.round(v + scoreMod * 1.2))))
    }
  } else if (chartPeriod.value === 'year') {
    return {
      categories: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      scores: [88, 90, 92, 95, 94, 96, 93, 91, 95, null, null, null].map(v => v ? Math.min(100, Math.max(0, Math.round(v + scoreMod))) : null),
      passRates: [90, 95, 96, 98, 97, 100, 96, 94, 98, null, null, null].map(v => v ? Math.min(100, Math.max(0, Math.round(v + scoreMod * 1.2))) : null)
    }
  }
  return {
    categories: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
    scores: [92, 95, 90, 96].map(v => Math.min(100, Math.max(0, Math.round(v + scoreMod)))),
    passRates: [95, 98, 92, 100].map(v => Math.min(100, Math.max(0, Math.round(v + scoreMod * 1.2))))
  }
})

const commonChartOptions = {
  chart: {
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'inherit',
    zoom: { enabled: false }
  },
  theme: { mode: 'light' },
  grid: {
    borderColor: 'rgba(100, 116, 139, 0.15)',
    strokeDashArray: 4,
  },
  dataLabels: { enabled: false },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '12px' }
  }
}

const ticketChartOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'line' },
  stroke: { width: [0, 4], curve: 'smooth' },
  colors: ['#818CF8', '#38BDF8'],
  fill: {
    type: ['solid', 'gradient'],
    gradient: {
      shade: 'light',
      type: 'vertical',
      opacityFrom: 1,
      opacityTo: 0.8,
    }
  },
  xaxis: {
    categories: ticketChartData.value.categories,
    labels: { style: { colors: '#64748b', fontWeight: 600 } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: [
    { title: { text: 'Số Yêu cầu (Ticket)', style: { color: '#64748b', fontWeight: 600 } }, labels: { style: { colors: '#64748b' } } },
    { opposite: true, title: { text: 'Thời gian IT Xử lý (giờ)', style: { color: '#64748b', fontWeight: 600 } }, labels: { style: { colors: '#64748b' } } }
  ],
  legend: { position: 'top', horizontalAlign: 'right', fontWeight: 600 }
}))

const ticketChartSeries = computed(() => [
  { name: 'Số Yêu cầu (Ticket)', type: 'column', data: ticketChartData.value.tickets },
  { name: 'Thời gian IT Xử lý (giờ)', type: 'line', data: ticketChartData.value.supportTime }
])

const qcChartOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'line' },
  stroke: { width: 4, curve: 'smooth' },
  colors: ['#34D399', '#F43F5E'],
  xaxis: {
    categories: qcChartData.value.categories,
    labels: { style: { colors: '#64748b', fontWeight: 600 } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    min: 0,
    max: 100,
    labels: {
      style: { colors: '#64748b' },
      formatter: (val) => `${val}%`
    }
  },
  legend: { position: 'top', horizontalAlign: 'right', fontWeight: 600 }
}))

const qcChartSeries = computed(() => [
  { name: 'Điểm QC', data: qcChartData.value.scores },
  { name: 'Tỉ lệ đạt', data: qcChartData.value.passRates }
])

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
      pageSize: 500,
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

    <section class="grid grid-cols-1 gap-4 tablet:grid-cols-2 pc:grid-cols-5">
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

    <!-- NEW: BỘ LỌC + BIỂU ĐỒ -->
    <div class="mt-8 flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
       <h2 class="ml-2 text-xl font-black tracking-tight text-slate-800">Biểu đồ Tổng quan</h2>
       
       <div class="flex max-w-full flex-wrap items-center gap-3">
          <!-- BỘ LỌC CỬA HÀNG -->
          <div class="relative shrink-0">
             <select
               v-model="chartStoreFilter"
               class="max-w-[200px] appearance-none truncate rounded-full border border-white/60 bg-white/40 pb-2 pl-4 pr-10 pt-2 text-[12px] font-bold uppercase tracking-wider text-slate-700 shadow-[0_4px_16px_rgb(0,0,0,0.03)] outline-none backdrop-blur-xl transition-all focus:border-indigo-400 focus:bg-white/80"
             >
               <option value="all">Tất cả cửa hàng</option>
               <option v-for="store in stores" :key="store.id" :value="store.id">
                 {{ store.name || store.address || `Store #${store.id}` }}
               </option>
             </select>
             <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <span class="material-symbols-outlined text-[16px]">expand_more</span>
             </span>
          </div>

          <!-- BỘ LỌC THỜI GIAN -->
          <div class="flex items-center gap-2 rounded-full border border-white/60 bg-white/40 p-1.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)] backdrop-blur-xl">
             <button
                v-for="opt in chartPeriodOptions"
                :key="opt.value"
                @click="chartPeriod = opt.value"
                class="rounded-full px-5 py-2 text-[12px] font-bold uppercase tracking-wider transition-all"
                :class="chartPeriod === opt.value ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-600 hover:bg-white/80'"
             >
                {{ opt.label }}
             </button>
          </div>
       </div>
    </div>

    <section class="grid grid-cols-1 gap-6 pc:grid-cols-2 mt-4">
      <!-- Biểu đồ Ticket -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl"></div>
          <div class="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl"></div>
        </div>
        <div class="mb-4 ml-2">
           <h3 class="text-base font-black tracking-tight text-slate-800">Tần suất Báo lỗi (Ticket) & Thời gian IT Xử lý</h3>
        </div>
        <div class="flex-1 -ml-4 -mt-2">
           <VueApexCharts
             type="line"
             height="300"
             :options="ticketChartOptions"
             :series="ticketChartSeries"
           />
        </div>
      </article>

      <!-- Biểu đồ QC -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl"></div>
          <div class="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-rose-300/20 blur-3xl"></div>
        </div>
        <div class="mb-4 ml-2">
           <h3 class="text-base font-black tracking-tight text-slate-800">Biến động điểm QC</h3>
        </div>
        <div class="flex-1 -ml-4 -mt-2">
           <VueApexCharts
             type="line"
             height="300"
             :options="qcChartOptions"
             :series="qcChartSeries"
           />
        </div>
      </article>
    </section>

    <!-- Hàng Ticket Gần đây / QC Tổng quan (Tháng này) -->
    <section class="grid grid-cols-1 gap-6 pc:grid-cols-3 mt-6">
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

      <!-- Tổng quan chấm điểm cửa hàng Tháng/Năm -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-sky-400/20 blur-3xl"></div>
          <div class="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl"></div>
        </div>

        <div class="mb-6">
          <p class="text-[12px] font-bold uppercase tracking-wider text-slate-500/80">Chất lượng vận hành</p>
          <h3 class="mt-1 flex items-baseline gap-2 text-lg font-black tracking-tight text-slate-800">Tổng quan QC <span class="text-sm font-semibold text-slate-500">(Tháng này)</span></h3>
        </div>

        <div class="flex-1 space-y-4">
          <div class="rounded-[24px] border border-white/50 bg-white/60 p-5 text-center shadow-sm backdrop-blur-lg">
             <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Điểm QC Trung Bình</p>
             <p class="mt-2 text-4xl font-black text-slate-800">{{ qcSummary.avgScoreRate || 92 }}<span class="text-lg font-bold text-slate-500">%</span></p>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
             <div class="rounded-[20px] border border-white/60 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 px-3 py-4 text-center shadow-sm backdrop-blur-md">
                <p class="text-2xl font-black text-emerald-600">{{ qcSummary.passRate || 95 }}<span class="text-sm">%</span></p>
                <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">Tỉ lệ đạt</p>
             </div>
             <div class="rounded-[20px] border border-white/60 bg-gradient-to-br from-rose-50/80 to-rose-100/40 px-3 py-4 text-center shadow-sm backdrop-blur-md">
                <p class="text-2xl font-black text-rose-600">{{ qcSummary.failed || 5 }}</p>
                <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-rose-700/70">Phiên rớt</p>
             </div>
          </div>
        </div>
      </article>
    </section>

    <!-- NEW SECTION: TABLES -->
    <section class="grid grid-cols-1 gap-6 pc:grid-cols-3">
      <!-- Bảng Ticket & Support Time -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"></div>
          <div class="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-violet-300/20 blur-3xl"></div>
        </div>

        <div class="mb-6 flex items-center justify-between">
           <h3 class="text-base font-black tracking-tight text-slate-800">Top Cửa hàng Yêu cầu Hỗ trợ (Báo lỗi)</h3>
           <span class="app-badge app-badge--neutral rounded-full border border-white/50 bg-white/50 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-md">Top 5</span>
        </div>
        <div class="flex-1 space-y-3">
          <div v-for="(store, index) in mockStoreTicketStats" :key="store.id" class="flex items-center justify-between rounded-[20px] border border-white/40 bg-white/40 p-3 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md">
             <div class="flex items-center gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-black text-slate-600 shadow-sm">{{ index + 1 }}</span>
                <div class="min-w-0">
                   <p class="truncate text-sm font-bold text-slate-700">{{ store.name }}</p>
                   <p class="text-[11px] font-medium text-slate-500">{{ store.ticketCount }} yêu cầu xử lý</p>
                </div>
             </div>
             <div class="text-right shrink-0 ml-2">
                <p class="text-sm font-black text-indigo-600">{{ store.avgSupportTime }}h</p>
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">IT xử lý</p>
             </div>
          </div>
        </div>
      </article>

      <!-- Xếp hạng QC -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute left-0 top-0 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl"></div>
          <div class="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl"></div>
        </div>

        <div class="mb-6 flex items-center justify-between">
           <h3 class="text-base font-black tracking-tight text-slate-800">Xếp hạng QC (Cao)</h3>
           <span class="app-badge app-badge--success rounded-full border border-white/50 bg-white/50 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-md">Top 4</span>
        </div>
        <div class="flex-1 space-y-3">
          <div v-for="(store, index) in mockTopQcStores" :key="store.id" class="flex items-center justify-between rounded-[20px] border border-white/50 bg-gradient-to-br from-white/40 to-emerald-50/40 p-3 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:to-emerald-50/70 hover:shadow-md">
             <div class="flex items-center gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-black text-emerald-600 shadow-sm">{{ index + 1 }}</span>
                <div class="min-w-0">
                   <p class="truncate text-sm font-bold text-slate-700">{{ store.name }}</p>
                   <p class="text-[11px] font-medium text-slate-500">Tỉ lệ đạt: <strong class="text-emerald-700">{{ store.passRate }}%</strong></p>
                </div>
             </div>
             <div class="text-right shrink-0 ml-2">
                <p class="text-sm font-black text-emerald-600">{{ store.qcScore }}</p>
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Điểm TB</p>
             </div>
          </div>
        </div>
      </article>

      <!-- Gặp nhiều lỗi nhất -->
      <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute right-0 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-rose-400/20 blur-3xl"></div>
          <div class="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-orange-300/20 blur-3xl"></div>
        </div>

        <div class="mb-6 flex items-center justify-between">
           <h3 class="text-base font-black tracking-tight text-slate-800">Cửa hàng cần theo dõi</h3>
           <span class="app-badge app-badge--danger rounded-full border border-white/50 bg-white/50 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-md">Cảnh báo</span>
        </div>
        <div class="flex-1 space-y-3">
          <div v-for="(store, index) in mockStoreErrors" :key="store.id" class="flex items-center justify-between rounded-[20px] border border-white/50 bg-gradient-to-br from-white/40 to-rose-50/40 p-3 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:to-rose-50/70 hover:shadow-md">
             <div class="flex items-center gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-black text-rose-600 shadow-sm">{{ index + 1 }}</span>
                <div class="min-w-0">
                   <p class="truncate text-sm font-bold text-slate-700">{{ store.name }}</p>
                   <p class="text-[11px] font-medium text-rose-600/80">{{ store.errorCount }} issue / fail</p>
                </div>
             </div>
             <div class="text-right shrink-0 ml-2">
                <p class="text-sm font-black text-rose-600">{{ store.failRate }}%</p>
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tỉ lệ rớt</p>
             </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
