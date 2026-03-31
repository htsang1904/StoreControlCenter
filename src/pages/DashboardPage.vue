<script setup>
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import draggable from 'vuedraggable'
import { useRoute } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import StoreFilterButton from '@/components/StoreFilterButton.vue'
import { useApp } from '@/plugins/app'
import { getDashboardOverview, listTickets } from '@/services/ticket_service'
import { getQcStoresOverviewApi } from '@/services/qc_service'
import { onMounted } from 'vue'

const route = useRoute()
const { state } = useApp()

const loading = ref(false)
const errorMessage = ref('')
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})

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
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-600',
  },
  {
    key: 'avg_processing_time',
    label: 'TB Thời gian xử lý',
    value: `${Number((mockAvgProcessingTime.value * (chartMultiplier?.value || 1)).toFixed(1))} giờ`,
    meta: 'Trên mỗi ticket',
    icon: 'schedule',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-600',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    value: numberFormatter.format(Number(ticketSummary.value.in_progress || 0)),
    meta: 'Cần theo dõi',
    icon: 'pending',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-600',
  },
  {
    key: 'qc_pass_rate',
    label: 'Tỉ lệ QC đạt',
    value: `${Number(qcSummary.value.passRate || 0)}%`,
    meta: 'Mục tiêu 95%',
    icon: 'check_circle',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-600',
  },
  {
    key: 'overdue',
    label: 'Cảnh báo quá hạn',
    value: numberFormatter.format(Number(ticketSummary.value.overdue || 0)),
    meta: 'Sát SLA',
    icon: 'timer',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-600',
  },
])

const sparklineCommonOptions = {
  chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0, stops: [0, 100] } },
  tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => '' } }, marker: { show: false } }
}

const sparklineData = computed(() => {
  const mult = chartMultiplier.value === 0 ? 0.1 : chartMultiplier.value
  return {
    total_ticket: {
      series: [{ data: [12, 14, 18, 15, 21, 19, 25].map(v => Math.round(v * mult)) }],
      options: { ...sparklineCommonOptions, colors: ['#0EA5E9'] }
    },
    avg_processing_time: {
      series: [{ data: [2.5, 2.3, 2.6, 2.4, 2.1, 1.9, 2.2].map(v => Number((v * mult).toFixed(1))) }],
      options: { ...sparklineCommonOptions, colors: ['#6366F1'] }
    },
    in_progress: {
      series: [{ data: [5, 7, 4, 8, 6, 9, 5].map(v => Math.round(v * mult)) }],
      options: { ...sparklineCommonOptions, colors: ['#F59E0B'] }
    },
    qc_pass_rate: {
      series: [{ data: [92, 94, 91, 95, 96, 94, 97].map(v => Math.min(100, Math.round(v + (mult - 1) * 5))) }],
      options: { ...sparklineCommonOptions, colors: ['#10B981'] }
    },
    overdue: {
      series: [{ data: [2, 3, 1, 4, 2, 5, 1].map(v => Math.round(v * mult)) }],
      options: { ...sparklineCommonOptions, colors: ['#F43F5E'] }
    }
  }
})

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

const chartPeriod = computed(() => {
  const f = new Date(dashboardRange.value.from)
  const t = new Date(dashboardRange.value.to)
  const diff = (t - f) / (1000 * 3600 * 24)
  if (diff <= 8) return 'week'
  if (diff > 40) return 'year'
  return 'month'
})

const dashboardWidgets = ref([
  { id: 'kpi_table', type: 'kpi_table', span: 12, minSpan: 12 },
  { id: 'main_chart', type: 'main_chart', span: 12, minSpan: 6 },
  { id: 'top_ticket_chart', type: 'top_ticket_chart', span: 6, minSpan: 6 },
  { id: 'top_qc_chart', type: 'top_qc_chart', span: 6, minSpan: 6 }
])

const chartStoreFilter = ref([])

watch(stores, (newStores) => {
  if (newStores.length > 0 && chartStoreFilter.value.length === 0) {
    chartStoreFilter.value = newStores.map(s => s.id)
  }
}, { immediate: true })

const chartMultiplier = computed(() => {
  if (chartStoreFilter.value.length === 0) return 0
  if (chartStoreFilter.value.length === stores.value.length && stores.value.length > 0) return 1
  const sum = chartStoreFilter.value.reduce((acc, id) => acc + id, 0)
  return Math.max(0.1, (sum % 3 + 1) * 0.3)
})

const ticketChartData = computed(() => {
  const mult = chartMultiplier.value
  if (mult === 0) {
    return {
      categories: ['-'],
      tickets: [0],
      supportTime: [0]
    }
  }
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

const topStoreTicketBarOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'bar' },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
  colors: ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B'],
  dataLabels: { enabled: true, style: { colors: ['#fff'] } },
  xaxis: { categories: mockStoreTicketStats.value.map(s => s.name) },
  legend: { show: false }
}))

const topStoreTicketBarSeries = computed(() => [
  { name: 'Số yêu cầu', data: mockStoreTicketStats.value.map(s => s.ticketCount) }
])

const topStoreQcBarOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'bar' },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
  colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
  dataLabels: { enabled: true, style: { colors: ['#064E3B'] } },
  xaxis: { categories: mockTopQcStores.value.map(s => s.name), max: 100 },
  legend: { show: false }
}))

const topStoreQcBarSeries = computed(() => [
  { name: 'Tỉ lệ đạt (%)', data: mockTopQcStores.value.map(s => s.passRate) }
])

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  const storeIds = chartStoreFilter.value
    .map((id) => Number(id || 0))
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
    chartStoreFilter,
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

    <!-- BỘ LỌC CỬA HÀNG -->
    <div class="mb-2 flex items-center justify-end">
       <StoreFilterButton v-model="chartStoreFilter" />
    </div>

    <!-- CÁC WIDGETS CÓ THỂ KÉO THẢ, ĐỔI CHIỀU, THU PHÓNG BẰNG CSS GRID -->
    <draggable 
      v-model="dashboardWidgets" 
      item-key="id" 
      handle=".drag-handle" 
      class="mt-4 grid grid-cols-12 gap-6 items-stretch"
      ghost-class="sortable-ghost-widget"
      drag-class="cursor-grabbing"
      :animation="200"
    >
      <template #item="{ element }">
         <div 
           class="relative group transition-all duration-300 ease-in-out h-full"
           :class="{
             'col-span-12': element.span === 12,
             'col-span-12 tablet:col-span-6': element.span === 6,
           }"
         >
           <!-- Control Toolbox -->
           <div class="drag-handle absolute -left-2 tablet:-left-4 top-1/2 -translate-y-1/2 cursor-grab text-slate-400/30 opacity-0 transition-opacity hover:text-indigo-500 group-hover:opacity-100 z-50 p-2 hidden tablet:block active:cursor-grabbing">
             <span class="material-symbols-outlined text-[28px]">drag_indicator</span>
           </div>

           <div v-if="element.minSpan !== 12" class="absolute right-4 top-3 z-[60] flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 bg-white/80 rounded-lg p-1 backdrop-blur-md shadow-sm border border-white/60">
             <button title="50% Chiều rộng" @click="element.span = 6" :class="element.span === 6 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-700'" class="px-2 py-0.5 text-xs font-bold rounded">50%</button>
             <button title="100% Chiều rộng" @click="element.span = 12" :class="element.span === 12 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-700'" class="px-2 py-0.5 text-xs font-bold rounded">100%</button>
           </div>
           
           <!-- WIDGET 1: KPI TABLE -->
           <template v-if="element.type === 'kpi_table'">
              <div class="flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] h-full w-full">
                <div class="px-6 py-5 border-b border-white/50 shrink-0 bg-white/20">
                   <h3 class="text-base font-black tracking-tight text-slate-800 truncate">Chỉ số Thống kê Tổng quan</h3>
                </div>
                <div class="flex-1 w-full overflow-x-auto overflow-y-hidden">
                  <table class="w-full min-w-[600px] text-left text-sm text-slate-600 h-full">
                    <thead class="border-b border-white/40 bg-white/20 text-xs uppercase text-slate-500">
                      <tr>
                        <th scope="col" class="px-6 py-4 font-black tracking-wider text-slate-700">Chỉ số thống kê</th>
                        <th scope="col" class="px-6 py-4 font-black tracking-wider text-slate-700 text-right">Giá trị hiện tại</th>
                        <th scope="col" class="px-6 py-4 font-black tracking-wider text-slate-700">Ghi chú</th>
                        <th scope="col" class="px-6 py-4 font-black tracking-wider text-slate-700 text-center w-[180px] pc:w-[250px]">Biến động</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/40">
                      <tr v-for="card in kpiCards" :key="card.key" class="transition-colors hover:bg-white/50">
                        <td class="px-6 py-3">
                          <div class="flex items-center gap-4">
                            <div class="flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm" :class="[card.bgClass, card.textClass]">
                              <span class="material-symbols-outlined text-[20px]">{{ card.icon }}</span>
                            </div>
                            <span class="font-bold text-slate-800">{{ card.label }}</span>
                          </div>
                        </td>
                        <td class="px-6 py-3 whitespace-nowrap text-right">
                          <span class="text-[18px] font-black tracking-tight text-slate-800">{{ card.value }}</span>
                        </td>
                        <td class="px-6 py-3">
                          <span class="app-badge rounded-full border border-white/50 bg-white/50 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-md" :class="card.textClass">
                            {{ card.meta }}
                          </span>
                        </td>
                        <td class="px-6 py-1 w-[180px] pc:w-[250px]">
                           <div class="mx-auto h-12 w-[160px] pc:w-[220px] opacity-80 mix-blend-multiply pointer-events-none">
                             <VueApexCharts
                                type="area"
                                height="100%"
                                :options="sparklineData[card.key].options"
                                :series="sparklineData[card.key].series"
                             />
                           </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
           </template>

           <!-- WIDGET 2: MAIN CHART -->
           <template v-else-if="element.type === 'main_chart'">
              <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] h-full w-full">
                <div class="pointer-events-none absolute inset-0 -z-10">
                  <div class="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl"></div>
                  <div class="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl"></div>
                </div>
                <div class="mb-4 ml-2 pr-20 border-b border-transparent pb-1">
                   <h3 class="text-base font-black tracking-tight text-slate-800 truncate">Tần suất Báo lỗi (Ticket) & Thời gian IT Xử lý</h3>
                </div>
                <div class="flex-1 -ml-4 -mt-2">
                   <VueApexCharts
                     type="line"
                     height="300"
                     :options="ticketChartOptions"
                     :series="ticketChartSeries"
                     class="w-full"
                   />
                </div>
              </article>
           </template>

           <!-- WIDGET 3: TOP TICKET BAR CHART -->
           <template v-else-if="element.type === 'top_ticket_chart'">
              <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] h-full w-full">
                <div class="pointer-events-none absolute inset-0 -z-10">
                  <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"></div>
                  <div class="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-violet-300/20 blur-3xl"></div>
                </div>
                <div class="mb-4 ml-2 pr-20 border-b border-transparent pb-1">
                   <h3 class="text-base font-black tracking-tight text-slate-800 truncate">Top Cửa hàng Yêu cầu Hỗ trợ</h3>
                </div>
                <div class="flex-1 -ml-4 -mt-2">
                   <VueApexCharts
                     type="bar"
                     height="250"
                     :options="topStoreTicketBarOptions"
                     :series="topStoreTicketBarSeries"
                     class="w-full"
                   />
                </div>
              </article>
           </template>

           <!-- WIDGET 4: TOP QC BAR CHART -->
           <template v-else-if="element.type === 'top_qc_chart'">
              <article class="relative z-10 flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] h-full w-full">
                <div class="pointer-events-none absolute inset-0 -z-10">
                  <div class="absolute left-0 top-0 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl"></div>
                  <div class="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl"></div>
                </div>
                <div class="mb-4 ml-2 pr-20 border-b border-transparent pb-1">
                   <h3 class="text-base font-black tracking-tight text-slate-800 truncate">Xếp hạng Điểm QC Tốt nhất</h3>
                </div>
                <div class="flex-1 -ml-4 -mt-2">
                   <VueApexCharts
                     type="bar"
                     height="250"
                     :options="topStoreQcBarOptions"
                     :series="topStoreQcBarSeries"
                     class="w-full"
                   />
                </div>
              </article>
           </template>

         </div>
      </template>
    </draggable>

    <!-- STORE FILTER MODAL -->
    <Teleport to="body">
      <div v-if="showStoreFilterPopup" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" @click.self="showStoreFilterPopup = false">
        <div class="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl transition-all">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-black tracking-tight text-slate-800">Chọn cửa hàng hiển thị</h3>
            <button @click="showStoreFilterPopup = false" class="text-slate-400 transition-colors hover:text-slate-600">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="border-b border-slate-100 bg-slate-50/50 p-3">
            <div class="relative flex items-center">
              <span class="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-slate-400">search</span>
              <input 
                v-model="storeSearchQuery" 
                type="text" 
                placeholder="Tìm kiếm cửa hàng..." 
                class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div v-if="filteredStores.length === 0" class="p-8 text-center text-sm text-slate-500">
              Không tìm thấy cửa hàng nào.
            </div>
            <div v-else class="space-y-1">
              <label 
                v-for="store in filteredStores" 
                :key="store.id" 
                class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div class="relative flex items-center">
                  <input 
                    type="checkbox" 
                    :checked="isStoreSelected(store.id)"
                    @change="toggleStoreSelection(store.id)"
                    class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-indigo-400"
                  />
                  <span class="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] text-white opacity-0 transition-opacity peer-checked:opacity-100">check</span>
                </div>
                <span class="select-none text-sm font-semibold text-slate-700">
                  {{ store.name || store.address || `Store #${store.id}` }}
                </span>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-4">
            <div class="flex items-center gap-2">
               <button @click="selectAllStores" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700">Chọn tất cả</button>
               <button @click="clearStoreSelection" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700">Bỏ chọn</button>
            </div>
            <button 
              @click="showStoreFilterPopup = false" 
              class="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700"
            >
              Cập nhật
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
:deep(.sortable-ghost-widget) {
  opacity: 0.5 !important;
  border-radius: 32px !important;
  overflow: hidden !important;
  transform: scale(0.98) !important;
  box-shadow: 0 0 0 2px #6366f1 !important;
}
</style>
