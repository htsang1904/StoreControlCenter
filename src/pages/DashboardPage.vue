<script setup>
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import draggable from 'vuedraggable'
import { useRoute, useRouter } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import StoreFilterButton from '@/components/StoreFilterButton.vue'
import { useApp } from '@/plugins/app'
import { getDashboardOverview, listTickets } from '@/services/ticket_service'
import { getQcStoresOverviewApi } from '@/services/qc_service'
import { onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
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

const ticketAvgProcessingTime = ref(0)
const ticketChartRawData = ref({
  categories: [],
  tickets: [],
  supportTime: []
})
const qcTopStoresData = ref([])

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
    value: `${Number(ticketAvgProcessingTime.value.toFixed(1))} giờ`,
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

watch(
  () => route.query.store_ids,
  (newVal) => {
    if (typeof newVal === 'string' && newVal.trim() !== '') {
      const parsed = newVal.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
      if (parsed.join(',') !== chartStoreFilter.value.join(',')) {
        chartStoreFilter.value = parsed
      }
    } else if (!newVal && stores.value.length > 0) {
      // If no query parameter, assume ALL stores are selected
      const allIds = stores.value.map(s => s.id)
      if (allIds.join(',') !== chartStoreFilter.value.join(',')) {
         chartStoreFilter.value = allIds
      }
    }
  },
  { immediate: true }
)

watch(stores, (newStores) => {
  // Only auto-select all stores if there is no store_ids query and no current selection (first load)
  if (newStores.length > 0 && chartStoreFilter.value.length === 0 && !route.query.store_ids) {
    chartStoreFilter.value = newStores.map(s => s.id)
  } else if (newStores.length > 0 && !route.query.store_ids) {
    chartStoreFilter.value = newStores.map(s => s.id)
  }
}, { immediate: true })

watch(chartStoreFilter, (newVal) => {
  const currentQ = String(route.query.store_ids || '')
  let newQ = newVal.join(',')
  
  if (stores.value.length > 0 && newVal.length === stores.value.length) {
    newQ = '' // Clear from URL if all selected
  }

  if (currentQ !== newQ && newVal.length > 0) {
    const query = { ...route.query }
    if (newQ) {
      query.store_ids = newQ
    } else {
      delete query.store_ids
    }
    router.replace({ query })
  }
}, { deep: true })

const chartMultiplier = computed(() => {
  if (chartStoreFilter.value.length === 0) return 0
  if (chartStoreFilter.value.length === stores.value.length && stores.value.length > 0) return 1
  const sum = chartStoreFilter.value.reduce((acc, id) => acc + id, 0)
  return Math.max(0.1, (sum % 3 + 1) * 0.3)
})

const ticketChartData = computed(() => {
  if (ticketChartRawData.value.categories.length === 0) {
    return {
      categories: ['-'],
      tickets: [0],
      supportTime: [0]
    }
  }
  return ticketChartRawData.value
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
  xaxis: { categories: ticketTopStores.value.map(s => s.name || `Store #${s.store_id}`), labels: { trim: true, style: { fontWeight: 600 } } },
  legend: { show: false }
}))

const topStoreTicketBarSeries = computed(() => [
  { name: 'Số yêu cầu', data: ticketTopStores.value.map(s => s.count || 0) }
])

const topStoreQcBarOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'bar' },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
  colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
  dataLabels: { enabled: true, style: { colors: ['#064E3B'] } },
  xaxis: { categories: qcTopStoresData.value.map(s => s.storeName || s.name || `Store #${s.storeId || s.store_id}`), max: 100, labels: { trim: true, style: { fontWeight: 600 } } },
  legend: { show: false }
}))

const topStoreQcBarSeries = computed(() => [
  { name: 'Tỉ lệ đạt (%)', data: qcTopStoresData.value.map(s => s.passRate || 0) }
])

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  const storeIds = chartStoreFilter.value
    .map((id) => Number(id || 0))
    .filter((storeId) => Number.isInteger(storeId) && storeId > 0)

  const isAllSelected = stores.value.length > 0 && storeIds.length === stores.value.length
  const apiStoreIdsStr = isAllSelected ? undefined : storeIds.join(',') || undefined
  const apiStoreIdsArr = isAllSelected ? undefined : storeIds

  const [ticketOverviewResult, qcOverviewResult, recentTicketsResult] = await Promise.allSettled([
    getDashboardOverview({
      date_from: dashboardRange.value.from,
      date_to: dashboardRange.value.to,
      store_ids: apiStoreIdsStr,
      top_stores_limit: 8,
      activity_limit: 8,
    }),
    getQcStoresOverviewApi({
      from: dashboardRange.value.from,
      to: dashboardRange.value.to,
      page: 1,
      pageSize: 500,
      storeIds: apiStoreIdsArr,
    }),
    listTickets({
      page: 1,
      pageSize: 6,
      date_from: dashboardRange.value.from,
      date_to: dashboardRange.value.to,
      store_ids: apiStoreIdsStr,
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
    ticketAvgProcessingTime.value = Number(ticketPayload?.summary?.avg_processing_time || 0)
    ticketChartRawData.value = ticketPayload?.chart_data || { categories: [], tickets: [], supportTime: [] }
    ticketTopStores.value = Array.isArray(ticketPayload?.top_stores) ? ticketPayload.top_stores : []
  } else {
    ticketSummary.value = {
      total_ticket: 0,
      in_progress: 0,
      resolved: 0,
      overdue: 0,
    }
    ticketTopStores.value = []
    ticketAvgProcessingTime.value = 0
    ticketChartRawData.value = { categories: [], tickets: [], supportTime: [] }
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
    
    // Sort logic to take top 5 QC stores with highest passRate
    const storeStats = Array.isArray(qcOverviewResult.value?.data?.storeStats) ? qcOverviewResult.value.data.storeStats : []
    qcTopStoresData.value = [...storeStats].sort((a,b) => b.passRate - a.passRate).slice(0, 5)
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
    qcTopStoresData.value = []
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
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="page-stack space-y-4 p-4 tablet:p-5 pc:p-6">
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
