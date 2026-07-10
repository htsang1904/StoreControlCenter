<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import { getDashboardOverview, listTickets } from '@/services/ticket_service'
import { getQcStoresOverviewApi } from '@/services/qc_service'

const VueApexCharts = defineAsyncComponent(() => import('vue3-apexcharts'))

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()

const loading = ref(false)
const errorMessage = ref('')
const isMounted = ref(false)
const kpiTooltip = reactive({ visible: false, top: 0, left: 0, text: '' })

onMounted(() => {
  isMounted.value = true
})

const ticketSummary = ref({
  total_ticket: 0,
  in_progress: 0,
  resolved: 0,
  due_soon: 0,
  overdue: 0,
})
const liveSummary = ref({
  total_ticket: 0,
  in_progress: 0,
  resolved: 0,
  due_soon: 0,
  overdue: 0,
  avg_processing_time: 0,
  qc_pass_rate: 0,
})
const ticketStatusData = ref([])
const ticketTrends = ref({})
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
const chartGroupBy = ref('day')
const chartGroupOptions = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
]
const chartGroupLabel = computed(() => chartGroupOptions.find((option) => option.value === chartGroupBy.value)?.label || 'Theo ngày')

function notifyError(message) {
  errorMessage.value = message
  toast.error(message)
}

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
    ticket?.store?.name ||
    ticket?.store?.shortAddress ||
    ticket?.store_name ||
    (ticket?.store_id ? `Store #${ticket.store_id}` : '--')
  )
}

function storeLabel(store) {
  const name = store?.storeName || store?.name
  return name || store?.shortAddress || `Store #${store?.store_id || store?.storeId || '--'}`
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

function formatDurationFromHours(value) {
  const hours = Number(value || 0)
  if (!Number.isFinite(hours) || hours <= 0) return '0 phút'

  const totalMinutes = Math.max(Math.round(hours * 60), 1)
  if (totalMinutes < 60) return `${totalMinutes} phút`

  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${wholeHours} giờ`
  return `${wholeHours} giờ ${minutes} phút`
}

const numberFormatter = new Intl.NumberFormat('vi-VN')
const kpiCards = computed(() => [
  {
    key: 'total_ticket',
    label: 'Tổng Ticket',
    value: numberFormatter.format(Number(liveSummary.value.total_ticket || 0)),
    meta: trendLabel(ticketTrends.value.total_ticket),
    hint: 'Tổng số ticket phát sinh trong khoảng thời gian dashboard.',
    tone: 'blue',
    icon: 'confirmation_number',
    trend: trendClass(ticketTrends.value.total_ticket),
  },
  {
    key: 'avg_processing_time',
    label: 'TB Thời gian xử lý',
    value: formatDurationFromHours(liveSummary.value.avg_processing_time),
    meta: trendLabel(ticketTrends.value.avg_processing_time),
    hint: 'Thời gian xử lý trung bình tính trên mỗi ticket đã có dữ liệu xử lý.',
    tone: 'purple',
    icon: 'schedule',
    trend: trendClass(ticketTrends.value.avg_processing_time),
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    value: numberFormatter.format(Number(liveSummary.value.in_progress || 0)),
    meta: trendLabel(ticketTrends.value.in_progress),
    hint: 'Số ticket đang được xử lý và cần theo dõi tiến độ.',
    tone: 'orange',
    icon: 'pending_actions',
    trend: trendClass(ticketTrends.value.in_progress),
  },
  {
    key: 'qc_pass_rate',
    label: 'Tỉ lệ QC đạt',
    value: `${Number(liveSummary.value.qc_pass_rate || 0)}%`,
    meta: trendLabel(ticketTrends.value.qc_pass_rate),
    hint: 'Tỷ lệ phiên QC đạt trong khoảng thời gian dashboard.',
    tone: 'green',
    icon: 'check_circle',
    trend: trendClass(ticketTrends.value.qc_pass_rate),
  },
  {
    key: 'overdue',
    label: 'Ticket quá hạn',
    value: numberFormatter.format(Number(liveSummary.value.overdue || liveSummary.value.due_soon || 0)),
    meta: trendLabel(ticketTrends.value.overdue),
    hint: 'Số ticket đã trễ SLA tiếp nhận hoặc xử lý theo rule hệ thống.',
    tone: 'red',
    icon: 'alarm',
    trend: trendClass(ticketTrends.value.overdue),
  },
])

function trendLabel(trend) {
  if (!trend || typeof trend !== 'object') return 'So với kỳ trước'
  const direction = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'
  const percent = Number(trend.percent || 0).toFixed(1)
  return `${direction} ${percent}% so với kỳ trước`
}

function trendClass(trend) {
  if (!trend || trend.sentiment === 'neutral') return 'neutral'
  if (trend.sentiment === 'good') return trend.direction === 'down' ? 'down-good' : 'up-good'
  return trend.direction === 'down' ? 'down-bad' : 'up-bad'
}

const statusToneMap = {
  new: { label: 'Mới', color: '#3b82f6', badge: 'dash-status--new' },
  in_progress: { label: 'Đang xử lý', color: '#fb923c', badge: 'dash-status--progress' },
  resolved: { label: 'Đã xong', color: '#22c55e', badge: 'dash-status--resolved' },
  due_soon: { label: 'Sắp quá hạn', color: '#f59e0b', badge: 'dash-status--due-soon' },
  overdue: { label: 'Đã quá hạn', color: '#ef4444', badge: 'dash-status--overdue' },
}

const ticketStatusRows = computed(() => {
  const total = Number(ticketSummary.value.total_ticket || 0)
  const source = Array.isArray(ticketStatusData.value) ? ticketStatusData.value : []
  const byKey = source.reduce((acc, item) => {
    const key = normalizeStatus(item?.key || item?.status)
    acc[key] = Number(item?.value || item?.count || 0)
    return acc
  }, {})
  const fallback = {
    new: byKey.new || 0,
    in_progress: byKey.in_progress ?? Number(ticketSummary.value.in_progress || 0),
    resolved: byKey.resolved ?? Number(ticketSummary.value.resolved || 0),
    due_soon: Number(ticketSummary.value.due_soon || 0),
    overdue: Number(ticketSummary.value.overdue || 0),
  }

  return ['new', 'in_progress', 'resolved', 'due_soon', 'overdue'].map((key) => {
    const value = Number(fallback[key] || 0)
    const percent = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0
    return {
      key,
      value,
      percent,
      ...statusToneMap[key],
    }
  })
})

const statusDonutSeries = computed(() => ticketStatusRows.value.map((item) => item.value))
const statusDonutOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit' },
  labels: ticketStatusRows.value.map((item) => item.label),
  colors: ticketStatusRows.value.map((item) => item.color),
  dataLabels: { enabled: false },
  legend: { show: false },
  stroke: { width: 0 },
  plotOptions: {
    pie: {
      donut: {
        size: '68%',
        labels: {
          show: true,
          name: { show: true, offsetY: 16, formatter: () => 'Tổng ticket' },
          value: {
            show: true,
            offsetY: -10,
            fontSize: '26px',
            fontWeight: 800,
            formatter: () => numberFormatter.format(Number(ticketSummary.value.total_ticket || 0)),
          },
          total: { show: false },
        },
      },
    },
  },
  tooltip: { y: { formatter: (value) => numberFormatter.format(Number(value || 0)) } },
}))

const lastUpdatedLabel = computed(() => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date()))

function showKpiTooltip(event, text) {
  const rect = event.currentTarget?.getBoundingClientRect()
  if (!rect) return

  kpiTooltip.top = rect.top - 8
  kpiTooltip.left = rect.left + rect.width / 2
  kpiTooltip.text = text || ''
  kpiTooltip.visible = true
}

function hideKpiTooltip() {
  kpiTooltip.visible = false
}

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
    zoom: { enabled: false },
    parentHeightOffset: 0,
    offsetY: 0,
  },
  theme: { mode: 'light' },
  grid: {
    borderColor: 'rgba(148, 163, 184, 0.22)',
    strokeDashArray: 0,
  },
  dataLabels: { enabled: false },
  tooltip: {
    theme: 'dark',
    style: { fontSize: '12px' }
  }
}

const ticketChartOptions = computed(() => ({
  ...commonChartOptions,
  chart: { ...commonChartOptions.chart, type: 'line', stacked: false },
  stroke: { width: [0, 3], curve: 'smooth' },
  colors: ['#3b82f6', '#ff8a00'],
  fill: {
    type: ['solid', 'solid'],
    opacity: [1, 1],
  },
  plotOptions: {
    bar: {
      columnWidth: '30%',
      borderRadius: 3,
      borderRadiusApplication: 'end',
    },
  },
  markers: {
    size: [0, 5],
    strokeWidth: 3,
    strokeColors: '#ffffff',
    colors: ['#3b82f6', '#ffffff'],
    hover: { size: 6 },
  },
  xaxis: {
    categories: ticketChartData.value.categories,
    labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: 500 } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: [
    {
      min: 0,
      title: { text: undefined },
      labels: { style: { colors: '#64748b', fontSize: '11px', fontWeight: 500 } },
    },
    {
      min: 0,
      opposite: true,
      title: { text: undefined },
      labels: {
        formatter: (value) => formatDurationFromHours(value),
        style: { colors: '#64748b', fontSize: '11px', fontWeight: 500 }
      },
    }
  ],
  tooltip: {
    ...commonChartOptions.tooltip,
    y: {
      formatter: (value, { seriesIndex }) => {
        if (seriesIndex === 1) return formatDurationFromHours(value)
        return numberFormatter.format(Number(value || 0))
      },
    },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    offsetY: 0,
    fontSize: '12px',
    fontWeight: 500,
    labels: { colors: '#334155' },
    markers: { width: 10, height: 10, radius: 999, strokeWidth: 0 },
    itemMargin: { horizontal: 14, vertical: 0 },
  },
}))

const ticketChartSeries = computed(() => [
  { name: 'Số lượng ticket', type: 'column', data: ticketChartData.value.tickets },
  { name: 'TB thời gian xử lý', type: 'line', data: ticketChartData.value.supportTime }
])

const hasTicketTrendData = computed(() => (
  ticketChartRawData.value.categories.length > 0 &&
  ticketChartRawData.value.tickets.some((value) => Number(value || 0) > 0)
))

function resolveDashboardStoreFilters() {
  const storeIds = chartStoreFilter.value
    .map((id) => Number(id || 0))
    .filter((storeId) => Number.isInteger(storeId) && storeId > 0)

  return {
    apiStoreIdsStr: storeIds.join(',') || undefined,
    apiStoreIdsArr: storeIds.length > 0 ? storeIds : undefined,
  }
}

function applyTicketOverviewPayload(ticketPayload = {}) {
  const nextLiveSummary = ticketPayload?.live_summary || ticketPayload?.liveSummary || ticketPayload?.summary || {}
  ticketSummary.value = {
    total_ticket: Number(ticketPayload?.summary?.total_ticket || 0),
    in_progress: Number(ticketPayload?.summary?.in_progress || 0),
    resolved: Number(ticketPayload?.summary?.resolved || 0),
    due_soon: Number(ticketPayload?.summary?.due_soon || 0),
    overdue: Number(ticketPayload?.summary?.overdue || 0),
  }
  liveSummary.value = {
    total_ticket: Number(nextLiveSummary?.total_ticket || 0),
    in_progress: Number(nextLiveSummary?.in_progress || 0),
    resolved: Number(nextLiveSummary?.resolved || 0),
    due_soon: Number(nextLiveSummary?.due_soon || 0),
    overdue: Number(nextLiveSummary?.overdue || 0),
    avg_processing_time: Number(nextLiveSummary?.avg_processing_time || 0),
    qc_pass_rate: Number(nextLiveSummary?.qc_pass_rate || 0),
  }
  ticketAvgProcessingTime.value = Number(ticketPayload?.summary?.avg_processing_time || 0)
  ticketChartRawData.value = ticketPayload?.chart_data || { categories: [], tickets: [], supportTime: [] }
  ticketTopStores.value = Array.isArray(ticketPayload?.top_stores) ? ticketPayload.top_stores : []
  ticketStatusData.value = Array.isArray(ticketPayload?.status) ? ticketPayload.status : []
  ticketTrends.value = ticketPayload?.trends && typeof ticketPayload.trends === 'object' ? ticketPayload.trends : {}
}

function resetTicketOverview() {
  ticketSummary.value = {
    total_ticket: 0,
    in_progress: 0,
    resolved: 0,
    due_soon: 0,
    overdue: 0,
  }
  liveSummary.value = {
    total_ticket: 0,
    in_progress: 0,
    resolved: 0,
    due_soon: 0,
    overdue: 0,
    avg_processing_time: 0,
    qc_pass_rate: 0,
  }
  ticketTopStores.value = []
  ticketStatusData.value = []
  ticketTrends.value = {}
  ticketAvgProcessingTime.value = 0
  ticketChartRawData.value = { categories: [], tickets: [], supportTime: [] }
}

async function loadTicketOverview({ showLoading = false } = {}) {
  if (showLoading) loading.value = true
  errorMessage.value = ''

  const { apiStoreIdsStr } = resolveDashboardStoreFilters()

  try {
    const result = await getDashboardOverview({
      date_from: dashboardRange.value.from,
      date_to: dashboardRange.value.to,
      store_ids: apiStoreIdsStr,
      top_stores_limit: 8,
      activity_limit: 8,
      chart_group_by: chartGroupBy.value,
    })
    const ticketPayload = result?.data || result || {}
    applyTicketOverviewPayload(ticketPayload)
  } catch (error) {
    resetTicketOverview()
    notifyError(error?.response?.data?.message || error?.message || 'Không thể tải dữ liệu ticket.')
  } finally {
    if (showLoading) loading.value = false
  }
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  const { apiStoreIdsStr, apiStoreIdsArr } = resolveDashboardStoreFilters()

  const [ticketOverviewResult, qcOverviewResult, recentTicketsResult] = await Promise.allSettled([
    getDashboardOverview({
      date_from: dashboardRange.value.from,
      date_to: dashboardRange.value.to,
      store_ids: apiStoreIdsStr,
      top_stores_limit: 8,
      activity_limit: 8,
      chart_group_by: chartGroupBy.value,
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
    applyTicketOverviewPayload(ticketPayload)
  } else {
    resetTicketOverview()
    notifyError(ticketOverviewResult.reason?.response?.data?.message || ticketOverviewResult.reason?.message || 'Không thể tải dữ liệu ticket.')
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
      notifyError(qcOverviewResult.reason?.response?.data?.message || qcOverviewResult.reason?.message || 'Không thể tải dữ liệu QC.')
    }
  }

  if (recentTicketsResult.status === 'fulfilled') {
    const payload = recentTicketsResult.value?.data || []
    recentTickets.value = Array.isArray(payload) ? payload.slice(0, 6) : []
  } else {
    recentTickets.value = []
    if (!errorMessage.value) {
      notifyError(recentTicketsResult.reason?.response?.data?.message || recentTicketsResult.reason?.message || 'Không thể tải danh sách ticket gần đây.')
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

watch(chartGroupBy, () => {
  loadTicketOverview({ showLoading: true })
})
</script>

<template>
  <div class="app-page dashboard-shell">
    <section class="dashboard-kpis" :class="{ 'is-loading': loading }">
      <article
        v-for="card in kpiCards"
        :key="card.key"
        class="dashboard-kpi-card"
        :class="`dashboard-kpi-card--${card.tone}`"
        @mouseenter="showKpiTooltip($event, card.hint)"
        @mouseleave="hideKpiTooltip"
      >
        <div class="dashboard-kpi-content">
          <div class="dashboard-kpi-heading">
            <span class="dashboard-kpi-icon">
              <span class="material-symbols-outlined">{{ card.icon }}</span>
            </span>
            <p>{{ card.label }}</p>
          </div>
          <strong>{{ card.value }}</strong>
          <span :class="['dashboard-kpi-trend', `dashboard-kpi-trend--${card.trend}`]">{{ card.meta }}</span>
        </div>
      </article>
    </section>

    <section class="dashboard-main-grid">
      <article class="dashboard-panel dashboard-panel--chart">
        <div class="dashboard-panel-header">
          <h2>Ticket theo thời gian</h2>
          <label class="dashboard-chart-period">
            <span class="sr-only">Chọn kiểu gom nhóm biểu đồ</span>
            <select v-model="chartGroupBy" :aria-label="chartGroupLabel">
              <option v-for="option in chartGroupOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span class="material-symbols-outlined">expand_more</span>
          </label>
        </div>
        <div class="dashboard-chart-wrap">
          <VueApexCharts
            v-if="isMounted && hasTicketTrendData"
            height="100%"
            :options="ticketChartOptions"
            :series="ticketChartSeries"
          />
          <div v-else class="dashboard-empty-state">
            <span class="material-symbols-outlined">bar_chart</span>
            <p>Chưa có dữ liệu ticket theo thời gian.</p>
          </div>
        </div>
      </article>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <h2>Top cửa hàng theo ticket</h2>
        </div>
        <div class="dashboard-table-wrap">
          <table class="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cửa hàng</th>
                <th>Số ticket</th>
                <th>TB xử lý</th>
              </tr>
            </thead>
            <tbody v-if="ticketTopStores.length">
              <tr v-for="(store, index) in ticketTopStores.slice(0, 5)" :key="store.store_id || store.name || index">
                <td>{{ index + 1 }}</td>
                <td class="dashboard-store-name" :title="store.name || storeLabel(store)">{{ store.name || storeLabel(store) }}</td>
                <td>{{ numberFormatter.format(Number(store.count || 0)) }}</td>
                <td>{{ formatDurationFromHours(store.avgSupportTime) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="4" class="dashboard-table-empty">Chưa có dữ liệu cửa hàng.</td></tr>
            </tbody>
          </table>
        </div>
        <RouterLink class="dashboard-link" to="/ticket">Xem tất cả <span class="material-symbols-outlined">arrow_forward</span></RouterLink>
      </article>

      <article class="dashboard-panel">
        <div class="dashboard-panel-header">
          <h2>Top cửa hàng theo QC</h2>
        </div>
        <div class="dashboard-table-wrap">
          <table class="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cửa hàng</th>
                <th>Tỉ lệ QC đạt</th>
                <th>Số phiên QC</th>
              </tr>
            </thead>
            <tbody v-if="qcTopStoresData.length">
              <tr v-for="(store, index) in qcTopStoresData.slice(0, 5)" :key="store.storeId || store.store_id || store.name || index">
                <td>{{ index + 1 }}</td>
                <td class="dashboard-store-name" :title="storeLabel(store)">{{ storeLabel(store) }}</td>
                <td>{{ Number(store.passRate || 0).toFixed(1) }}%</td>
                <td>{{ numberFormatter.format(Number(store.totalSessions || store.sessionCount || 0)) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="4" class="dashboard-table-empty">Chưa có dữ liệu QC.</td></tr>
            </tbody>
          </table>
        </div>
        <RouterLink class="dashboard-link" to="/qc">Xem tất cả <span class="material-symbols-outlined">arrow_forward</span></RouterLink>
      </article>
    </section>

    <section class="dashboard-bottom-grid">
      <article class="dashboard-panel dashboard-panel--recent">
        <div class="dashboard-panel-header">
          <h2>Ticket gần đây</h2>
        </div>
        <div class="dashboard-table-wrap">
          <table class="dashboard-table dashboard-table--recent">
            <thead>
              <tr>
                <th>#</th>
                <th>Mã ticket</th>
                <th>Tiêu đề</th>
                <th>Cửa hàng</th>
                <th>Trạng thái</th>
                <th>Thời gian tạo</th>
              </tr>
            </thead>
            <tbody v-if="recentTickets.length">
              <tr v-for="(ticket, index) in recentTickets" :key="ticket.id">
                <td>{{ index + 1 }}</td>
                <td>{{ ticket.ticket_code || `TKT-${ticket.id}` }}</td>
                <td>{{ ticket.title || 'Không có tiêu đề' }}</td>
                <td class="dashboard-store-name" :title="storeDisplay(ticket)">{{ storeDisplay(ticket) }}</td>
                <td><span class="dashboard-status-badge" :class="statusClass(ticket.status)">{{ statusLabel(ticket.status) }}</span></td>
                <td>{{ formatRelativeTime(ticket.createdAt || ticket.created_at) }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="6" class="dashboard-table-empty">Chưa có ticket gần đây.</td></tr>
            </tbody>
          </table>
        </div>
        <RouterLink class="dashboard-link" to="/ticket">Xem tất cả ticket <span class="material-symbols-outlined">arrow_forward</span></RouterLink>
      </article>

      <article class="dashboard-panel dashboard-panel--status">
        <div class="dashboard-panel-header">
          <h2>Tổng quan theo trạng thái</h2>
        </div>
        <div class="dashboard-status-content">
          <div class="dashboard-donut">
            <VueApexCharts
              v-if="isMounted && statusDonutSeries.some((value) => Number(value || 0) > 0)"
              height="210"
              :options="statusDonutOptions"
              :series="statusDonutSeries"
            />
            <div v-else class="dashboard-empty-state dashboard-empty-state--small">
              <span class="material-symbols-outlined">donut_large</span>
              <p>Chưa có dữ liệu trạng thái.</p>
            </div>
          </div>
          <div class="dashboard-status-list">
            <div v-for="item in ticketStatusRows" :key="item.key" class="dashboard-status-row">
              <span class="dashboard-status-dot" :style="{ backgroundColor: item.color }"></span>
              <span>{{ item.label }}</span>
              <strong>{{ numberFormatter.format(item.value) }} ({{ item.percent }}%)</strong>
            </div>
          </div>
        </div>
        <div class="dashboard-updated">
          <span class="material-symbols-outlined">schedule</span>
          <span>Cập nhật: {{ lastUpdatedLabel }}</span>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <span
        v-if="kpiTooltip.visible"
        class="app-metric-card__tooltip app-metric-card__tooltip--fixed pointer-events-none fixed z-[9999] w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs font-medium normal-case leading-5 tracking-normal shadow-lg"
        :style="{ top: `${kpiTooltip.top}px`, left: `${kpiTooltip.left}px` }"
      >
        {{ kpiTooltip.text }}
      </span>
    </Teleport>
  </div>
</template>

<style scoped>
.dashboard-shell {
  color: var(--text-primary);
}

.dashboard-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.dashboard-kpis.is-loading {
  opacity: 0.72;
}

.dashboard-kpi-card {
  min-height: 5.1rem;
  padding: 0.75rem;
  border: 1px solid var(--stroke);
  border-radius: 0.875rem;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.dashboard-kpi-icon {
  width: 1.125rem;
  height: 1.125rem;
  flex: 0 0 1.125rem;
  display: grid;
  place-items: center;
}

.dashboard-kpi-icon .material-symbols-outlined {
  font-size: 1rem;
  font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 32;
}

.dashboard-kpi-content {
  min-width: 0;
}

.dashboard-kpi-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-kpi-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-kpi-content strong {
  display: block;
  margin-top: 0.45rem;
  color: var(--text-primary);
  font-size: 1.35rem;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.035em;
}

.dashboard-kpi-trend {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.35;
}

.dashboard-kpi-trend--up-good,
.dashboard-kpi-trend--down-good {
  color: var(--success-text);
}

.dashboard-kpi-trend--up-bad,
.dashboard-kpi-trend--down-bad {
  color: var(--danger-text);
}

.dashboard-kpi-trend--neutral {
  color: var(--text-secondary);
}

.dashboard-kpi-card--blue .dashboard-kpi-icon { color: var(--info-text); }
.dashboard-kpi-card--purple .dashboard-kpi-icon { color: #7c3aed; }
.dashboard-kpi-card--orange .dashboard-kpi-icon { color: var(--warning-text); }
.dashboard-kpi-card--green .dashboard-kpi-icon { color: var(--success-text); }
.dashboard-kpi-card--red .dashboard-kpi-icon { color: var(--danger-text); }

.dashboard-main-grid,
.dashboard-bottom-grid {
  display: grid;
  align-items: stretch;
  gap: 0.75rem;
}

.dashboard-main-grid {
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.95fr) minmax(18rem, 0.95fr);
  margin-bottom: 0.75rem;
}

.dashboard-bottom-grid {
  grid-template-columns: minmax(0, 1.7fr) minmax(21rem, 1fr);
}

.dashboard-panel {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--stroke);
  border-radius: 0.875rem;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  padding: 0.875rem;
}

.dashboard-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.dashboard-panel-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.dashboard-chart-period {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 1.95rem;
  border: 1px solid var(--stroke);
  border-radius: 0.625rem;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
  overflow: hidden;
}

.dashboard-chart-period select {
  min-height: 1.95rem;
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0 1.85rem 0 0.625rem;
  font: inherit;
  outline: none;
}

.dashboard-chart-period .material-symbols-outlined {
  pointer-events: none;
  position: absolute;
  right: 0.55rem;
  font-size: 1rem;
}

.dashboard-chart-wrap {
  flex: 1 1 auto;
  min-height: 18.5rem;
  display: flex;
  flex-direction: column;
}

.dashboard-chart-wrap :deep(.vue-apexcharts),
.dashboard-chart-wrap :deep(.apexcharts-canvas) {
  flex: 1 1 auto;
  min-height: 0;
}

.dashboard-table-wrap {
  flex: 1 1 auto;
  overflow-x: auto;
  max-height: 18.5rem;
  overflow-y: auto;
  scrollbar-width: none;
}

.dashboard-table-wrap::-webkit-scrollbar {
  display: none;
}

.dashboard-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text-primary);
  font-size: 0.72rem;
}

.dashboard-table th {
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--stroke);
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.dashboard-table td {
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--stroke);
  font-weight: 500;
  vertical-align: middle;
}

.dashboard-store-name {
  max-width: 11rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-table tbody tr:last-child td {
  border-bottom: 0;
}

.dashboard-table th:nth-child(1),
.dashboard-table td:nth-child(1) {
  width: 2rem;
  color: var(--text-secondary);
}

.dashboard-table-empty {
  height: 11.5rem;
  text-align: center !important;
  color: var(--text-muted) !important;
}

.dashboard-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  flex-shrink: 0;
  color: var(--primary-strong);
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
}

.dashboard-link .material-symbols-outlined {
  font-size: 1rem;
}

.dashboard-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  padding: 0 0.4rem;
  border-radius: 0.5rem;
  font-size: 0.68rem;
  font-weight: 500;
  white-space: nowrap;
}

.dashboard-status-badge.app-badge--info { background: var(--info-bg); color: var(--info-text); }
.dashboard-status-badge.app-badge--warning { background: var(--warning-bg); color: var(--warning-text); }
.dashboard-status-badge.app-badge--success { background: var(--success-bg); color: var(--success-text); }
.dashboard-status-badge.app-badge--neutral { background: var(--surface-muted); color: var(--text-secondary); }
.dashboard-status-badge.app-badge--danger { background: var(--danger-bg); color: var(--danger-text); }

.dashboard-status-content {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(11rem, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 0.75rem;
  min-height: 13rem;
}

.dashboard-donut {
  min-width: 0;
}

.dashboard-status-list {
  display: grid;
  gap: 0.625rem;
}

.dashboard-status-row {
  display: grid;
  grid-template-columns: 0.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.625rem;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
}

.dashboard-status-row strong {
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}

.dashboard-status-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 999px;
}

.dashboard-updated {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
}

.dashboard-updated .material-symbols-outlined {
  font-size: 1rem;
}

.dashboard-empty-state {
  min-height: 100%;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.5rem;
  color: var(--text-muted);
  text-align: center;
  font-size: 0.75rem;
  font-weight: 500;
}

.dashboard-empty-state .material-symbols-outlined {
  font-size: 1.5rem;
}

.dashboard-empty-state--small {
  min-height: 9rem;
}

@media (max-width: 64rem) {
  .dashboard-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-main-grid,
  .dashboard-bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  .dashboard-kpis {
    grid-template-columns: 1fr;
  }

  .dashboard-kpi-card {
    min-height: 5.75rem;
  }

  .dashboard-status-content {
    grid-template-columns: 1fr;
  }
}
</style>
