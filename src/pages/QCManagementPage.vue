<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import { useApp } from '@/plugins/app'
import { getQcStoresOverviewApi } from '@/services/qc_service'

const router = useRouter()
const route = useRoute()
const { state } = useApp()

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 5
const initialRange = getDefaultDateRange()

const searchInput = ref('')
const searchKeyword = ref('')
const searchDebounce = ref(null)
const currentPage = ref(1)
const numberFormatter = new Intl.NumberFormat('vi-VN')

const sortDirections = ref({
  totalSessions: null,
  passed: null,
  avgScoreRate: null,
  failed: null,
})

const loading = ref(false)
const dateFrom = ref(initialRange.from)
const dateTo = ref(initialRange.to)
const summary = ref({
  totalSessions: 0,
  passed: 0,
  failed: 0,
  avgScore: 0,
  avgMaxScore: 0,
  avgScoreRate: 0,
  passRate: 0,
})
const storeStats = ref([])
const loadError = ref('')

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
    const q = { ...route.query }
    if (newQ === '') {
      delete q.store_ids
    } else {
      q.store_ids = newQ
    }
    router.replace({ query: q })
  }
})

function syncRangeFromRoute() {
  const range = normalizeDateRangeFromQuery(route.query || {}, getDefaultDateRange())
  dateFrom.value = range.from
  dateTo.value = range.to
}

function normalizeRegionLabel(value) {
  const text = String(value || '').trim()
  if (!text) return 'Chưa phân vùng'
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 0) return 'Chưa phân vùng'
  return parts[parts.length - 1]
}

function normalizeHealth(store) {
  if (!store.lastAuditAt || Number(store.totalSessions || 0) <= 0) {
    return {
      key: 'unchecked',
      label: 'Chưa kiểm tra',
      badgeClass: 'app-badge--neutral',
      scoreClass: 'border border-slate-200 bg-slate-100 text-slate-500',
    }
  }

  const scoreRate = Number(store.avgScoreRate || 0)
  const failed = Number(store.failed || 0)

  if (scoreRate >= 85 && failed <= 0) {
    return {
      key: 'standard',
      label: 'Đạt tiêu chuẩn',
      badgeClass: 'app-badge--success',
      scoreClass: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
    }
  }

  if (scoreRate >= 70) {
    return {
      key: 'warning',
      label: 'Cần nhắc nhở',
      badgeClass: 'app-badge--warning',
      scoreClass: 'border border-amber-200 bg-amber-100 text-amber-700',
    }
  }

  return {
    key: 'critical',
    label: 'Vi phạm nghiêm trọng',
    badgeClass: 'app-badge--danger',
    scoreClass: 'border border-rose-200 bg-rose-100 text-rose-700',
  }
}

function formatRelativeTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return 'Vừa cập nhật'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} phút trước`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  if (hours < 48) return 'Hôm qua'

  return `${Math.floor(hours / 24)} ngày trước`
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

function normalizeLastAuditResult(result) {
  const normalized = String(result || '').trim().toLowerCase()
  if (normalized === 'pass' || normalized === 'passed') {
    return {
      label: 'Đạt',
      class: 'app-badge--success',
    }
  }

  if (normalized === 'fail' || normalized === 'failed') {
    return {
      label: 'Không đạt',
      class: 'app-badge--danger',
    }
  }

  return {
    label: 'Chưa chốt',
    class: 'app-badge--neutral',
  }
}

function formatCsvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

const stores = computed(() => {
  const source = Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []
  return source.map((store) => ({
    id: Number(store?.id || 0),
    storeId: String(store?.storeId || ''),
    code: store?.code || '',
    name: store?.shortAddress || store?.address || store?.code || `Cửa hàng #${store?.id || ''}`,
    address: store?.address || '',
    shortAddress: store?.shortAddress || '',
    managerName: store?.managerName || store?.manager || store?.ownerName || 'Chưa gán',
  }))
})

const mergedStoreSources = computed(() => {
  const localRows = [...stores.value]
  const seenStoreIds = new Set(
    localRows
      .map((store) => Number(store?.id || 0))
      .filter((storeId) => Number.isInteger(storeId) && storeId > 0)
  )

  storeStats.value.forEach((stat) => {
    const entityId = Number(stat?.storeEntityId || stat?.storeId || 0)
    if (!Number.isInteger(entityId) || entityId <= 0 || seenStoreIds.has(entityId)) return

    seenStoreIds.add(entityId)
    localRows.push({
      id: entityId,
      storeId: String(stat?.storeNo || ''),
      code: stat?.storeCode || '',
      name: stat?.storeName || stat?.storeCode || `Cửa hàng #${entityId}`,
      address: stat?.address || '',
      shortAddress: stat?.storeName || '',
      managerName: 'Chưa gán',
    })
  })

  return localRows
})

const sortableFields = ['totalSessions', 'passed', 'failed', 'avgScoreRate']
const sortCycle = [null, 'desc', 'asc']

const toggleSort = (field) => {
  if (!sortableFields.includes(field)) return
  const currentDirection = sortDirections.value[field] ?? null
  const currentIndex = sortCycle.indexOf(currentDirection)
  const nextIndex = (currentIndex + 1) % sortCycle.length
  sortDirections.value[field] = sortCycle[nextIndex]
}

const sortIndicator = (field) => {
  if (sortDirections.value[field] === 'desc') return '↓'
  if (sortDirections.value[field] === 'asc') return '↑'
  return '↕'
}

const sortIndicatorClass = (field) => (sortDirections.value[field] ? 'text-slate-700' : 'text-slate-400')

const normalizedStores = computed(() => {
  const statsMap = new Map(
    storeStats.value.map((item) => [Number(item.storeEntityId || item.storeId), item])
  )

  return mergedStoreSources.value.map((store) => {
    const stat = statsMap.get(store.id)
    const merged = {
      ...store,
      totalSessions: Number(stat?.totalSessions || 0),
      passed: Number(stat?.passed || 0),
      failed: Number(stat?.failed || 0),
      avgScore: Number(stat?.avgScore || 0),
      avgMaxScore: Number(stat?.avgMaxScore || 0),
      avgScoreRate: Number(stat?.avgScoreRate || 0),
      passRate: Number(stat?.passRate || 0),
      lastAuditAt: stat?.lastAuditAt || null,
      lastAuditCode: stat?.lastAuditCode || '--',
      lastAuditResult: stat?.lastAuditResult || null,
    }

    const region = normalizeRegionLabel(merged.shortAddress || merged.address)
    const health = normalizeHealth(merged)
    const lastAuditResultMeta = normalizeLastAuditResult(merged.lastAuditResult)
    const totalSessions = Number(merged.totalSessions || 0)
    const failed = Number(merged.failed || 0)
    const passed = Number(merged.passed || 0)

    return {
      ...merged,
      region,
      healthLabel: health.label,
      healthBadgeClass: health.badgeClass,
      scoreBadgeClass: health.scoreClass,
      scoreDisplay: !merged.lastAuditAt ? '--' : Number(merged.avgScore || 0).toFixed(1),
      totalSessionsLabel: numberFormatter.format(totalSessions),
      passedLabel: numberFormatter.format(passed),
      failedLabel: numberFormatter.format(failed),
      latestAuditLabel: formatDateTime(merged.lastAuditAt),
      lastUpdatedLabel: formatRelativeTime(merged.lastAuditAt),
      lastAuditResultLabel: lastAuditResultMeta.label,
      lastAuditResultClass: lastAuditResultMeta.class,
    }
  })
})

const filteredStores = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const activeSortFields = sortableFields.filter((field) => sortDirections.value[field])

  return normalizedStores.value
    .filter((store) => {
      if (!keyword) return true
      return (
        store.name.toLowerCase().includes(keyword) ||
        store.code.toLowerCase().includes(keyword) ||
        store.storeId.toLowerCase().includes(keyword) ||
        store.address.toLowerCase().includes(keyword) ||
        store.region.toLowerCase().includes(keyword) ||
        String(store.managerName || '').toLowerCase().includes(keyword)
      )
    })
    .sort((left, right) => {
      for (const field of activeSortFields) {
        const direction = sortDirections.value[field]
        if (!direction) continue

        const leftValue = Number(left?.[field] || 0)
        const rightValue = Number(right?.[field] || 0)
        if (leftValue !== rightValue) {
          return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
        }
      }

      return String(left.name || '').localeCompare(String(right.name || ''), 'vi')
    })
})

const hasStores = computed(() => filteredStores.value.length > 0)

const totalPages = computed(() => {
  const pageCount = Math.ceil(filteredStores.value.length / PAGE_SIZE)
  return Math.max(pageCount, 1)
})

const pagedStores = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredStores.value.slice(start, start + PAGE_SIZE)
})

const paginationStart = computed(() => {
  if (filteredStores.value.length <= 0) return 0
  return (currentPage.value - 1) * PAGE_SIZE + 1
})

const paginationEnd = computed(() => {
  if (filteredStores.value.length <= 0) return 0
  return Math.min(currentPage.value * PAGE_SIZE, filteredStores.value.length)
})

const visiblePageItems = computed(() => {
  const pageCount = totalPages.value
  const current = currentPage.value

  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(pageCount - 1, current + 1)

  if (start > 2) items.push('dots-left')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < pageCount - 1) items.push('dots-right')
  items.push(pageCount)

  return items
})

const reviewedStoresCount = computed(() => (
  normalizedStores.value.filter((store) => store.scoreDisplay !== '--').length
))

const completedRate = computed(() => {
  if (normalizedStores.value.length <= 0) return 0
  return (reviewedStoresCount.value / normalizedStores.value.length) * 100
})

const avgQcScore = computed(() => {
  const audited = normalizedStores.value.filter((store) => store.scoreDisplay !== '--')
  if (audited.length <= 0) return 0
  const total = audited.reduce((sum, store) => sum + Number(store.avgScoreRate || 0), 0)
  return (total / audited.length) / 10
})

const needReviewCount = computed(() => (
  normalizedStores.value.filter((store) => Number(store.failed || 0) > 0).length
))

const summaryCards = computed(() => [
  {
    key: 'total_stores',
    label: 'Tổng số cửa hàng',
    value: new Intl.NumberFormat('vi-VN').format(normalizedStores.value.length),
    meta: `Hoàn tất ${completedRate.value.toFixed(1)}%`,
    icon: 'storefront',
    tone: 'sky',
  },
  {
    key: 'avg_score',
    label: 'QC Score TB',
    value: avgQcScore.value.toFixed(2),
    meta: `Toàn kỳ ${Number(summary.value.avgScore || 0).toFixed(1)}`,
    icon: 'monitoring',
    tone: 'teal',
  },
  {
    key: 'need_review',
    label: 'Cần kiểm tra lại',
    value: new Intl.NumberFormat('vi-VN').format(needReviewCount.value),
    meta: `${summary.value.failed} phiên lỗi`,
    icon: 'warning',
    tone: 'rose',
  },
  {
    key: 'completed',
    label: 'Đã hoàn thành QC',
    value: `${completedRate.value.toFixed(1)}%`,
    meta: `Pass ${Number(summary.value.passRate || 0).toFixed(1)}%`,
    icon: 'task_alt',
    tone: 'emerald',
  },
])

function goToPage(page) {
  if (!Number.isInteger(page)) return
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function prevPage() {
  goToPage(currentPage.value - 1)
}

function nextPage() {
  goToPage(currentPage.value + 1)
}

function openStoreDetail(storeId) {
  if (!storeId) return
  router.push(`/QC/store/${storeId}`)
}

async function handleRefresh() {
  await loadOverview()
}

function exportReport() {
  const headers = ['Ma cua hang', 'Ten cua hang', 'Khu vuc', 'QC score', 'Trang thai', 'Cap nhat cuoi']
  const rows = filteredStores.value.map((store) => [
    store.code || store.storeId || '',
    store.name || '',
    store.region || '',
    store.scoreDisplay,
    store.healthLabel,
    store.lastUpdatedLabel,
  ].map((item) => formatCsvCell(item)).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `qc-store-report-${dateFrom.value}-${dateTo.value}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

async function loadOverview() {
  loading.value = true
  loadError.value = ''

  try {
    const queryStoreIds = route.query.store_ids 
      ? route.query.store_ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
      : []
    const storeIds = queryStoreIds.length > 0
      ? queryStoreIds
      : stores.value.map((store) => Number(store?.id || 0)).filter((id) => Number.isInteger(id) && id > 0)
      
    const targetPageSize = 500

    const remote = await getQcStoresOverviewApi({
      from: dateFrom.value,
      to: dateTo.value,
      page: 1,
      pageSize: targetPageSize,
      storeIds,
    })

    if (remote?.success && remote?.data) {
      const remoteSummary = remote.data.summary || {}
      summary.value = {
        totalSessions: Number(remoteSummary.totalSessions || 0),
        passed: Number(remoteSummary.passed || 0),
        failed: Number(remoteSummary.failed || 0),
        avgScore: Number(remoteSummary.avgScore || 0),
        avgMaxScore: Number(remoteSummary.avgMaxScore || 0),
        avgScoreRate: Number(remoteSummary.avgScoreRate || 0),
        passRate: Number(remoteSummary.passRate || 0),
      }

      storeStats.value = Array.isArray(remote.data.storeStats) ? remote.data.storeStats : []
    }
  } catch (error) {
    summary.value = {
      totalSessions: 0,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgMaxScore: 0,
      avgScoreRate: 0,
      passRate: 0,
    }
    storeStats.value = []
    loadError.value = error?.response?.data?.message || error?.message || 'Không tải được thống kê QC từ backend.'
  } finally {
    loading.value = false
  }
}

watch(
  [
    stores,
    () => route.query.date_from,
    () => route.query.date_to,
    () => route.query.store_ids,
  ],
  async () => {
    syncRangeFromRoute()
    await loadOverview()
  },
  { immediate: true }
)

watch(searchInput, (value) => {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
  searchDebounce.value = setTimeout(() => {
    searchKeyword.value = String(value || '').trim()
  }, SEARCH_DEBOUNCE_MS)
})

watch(
  () => [
    searchKeyword.value,
    sortDirections.value.totalSessions,
    sortDirections.value.passed,
    sortDirections.value.avgScoreRate,
    sortDirections.value.failed,
  ],
  () => {
    currentPage.value = 1
  }
)

watch(filteredStores, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

onBeforeUnmount(() => {
  if (searchDebounce.value) clearTimeout(searchDebounce.value)
})
</script>

<template>
  <div class="p-4 tablet:p-5 pc:p-6">
    <div class="page-stack overflow-visible space-y-4">
      <section class="grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4">
        <StatSummaryCard
          v-for="card in summaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :icon="card.icon"
          :tone="card.tone"
        />
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div class="border-b border-slate-200 p-3 tablet:p-4">
          <div class="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap tablet:items-center">
            <div class="flex min-w-0 flex-1 flex-col gap-2 tablet:flex-row tablet:flex-wrap tablet:items-center">
              <div class="relative w-full min-w-0 flex-1 tablet:min-w-[220px] pc:w-[320px] pc:flex-none">
                <input
                  v-model="searchInput"
                  type="text"
                  class="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-hidden focus:ring-0"
                  placeholder="Tìm kiếm ..."
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 tablet:w-auto"
                @click="handleRefresh"
              >
                Tải lại
              </button>
            </div>

            <button
              type="button"
              class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 tablet:ml-auto tablet:w-auto"
              @click="exportReport"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Xuất báo cáo
            </button>
          </div>
        </div>

        <p v-if="loadError" class="app-state-banner m-4 mb-0 text-xs font-medium">
          {{ loadError }}
        </p>

        <div v-loading="loading">
          <div class="hidden overflow-x-auto pc:block">
            <table class="min-w-[840px] w-full border-collapse text-left">
              <thead>
                <tr class="bg-slate-50">
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Cửa hàng</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <button type="button" class="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500" @click="toggleSort('totalSessions')">
                      Tổng phiên
                      <span :class="sortIndicatorClass('totalSessions')">{{ sortIndicator('totalSessions') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <button type="button" class="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500" @click="toggleSort('passed')">
                      Phiên đạt
                      <span :class="sortIndicatorClass('passed')">{{ sortIndicator('passed') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <button type="button" class="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500" @click="toggleSort('failed')">
                      Phiên lỗi
                      <span :class="sortIndicatorClass('failed')">{{ sortIndicator('failed') }}</span>
                    </button>
                  </th>
                  <th class="w-[104px] px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <button type="button" class="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500" @click="toggleSort('avgScoreRate')">
                      Điểm TB
                      <span :class="sortIndicatorClass('avgScoreRate')">{{ sortIndicator('avgScoreRate') }}</span>
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody v-if="hasStores" class="divide-y divide-slate-100">
                <tr
                  v-for="store in pagedStores"
                  :key="store.id"
                  class="cursor-pointer transition-colors hover:bg-slate-50"
                  @click="openStoreDetail(store.id)"
                >
                  <td class="px-4 py-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-slate-900">{{ store.name }}</p>
                      <p class="text-xs text-slate-500">
                        {{ store.code || store.storeId || '--' }} • {{ store.region }} • Phụ trách: {{ store.managerName }}
                      </p>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-semibold text-slate-900">{{ store.totalSessionsLabel }} phiên</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium app-badge--success">
                      {{ store.passedLabel }} phiên
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium app-badge--danger">
                      {{ store.failedLabel }} phiên
                    </span>
                  </td>
                  <td class="w-[104px] px-3 py-3">
                    <div class="flex justify-center">
                      <span class="inline-flex h-8 min-w-[56px] items-center justify-center rounded-lg px-2 text-xs font-semibold" :class="store.scoreBadgeClass">
                        {{ store.scoreDisplay }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr>
                  <td colspan="5" class="px-4 py-10">
                    <div class="app-state-panel app-state-panel--compact">
                      <div class="app-state-stack mx-auto">
                        <div class="app-state-icon mx-auto">
                          <span class="material-symbols-outlined text-[24px]">storefront</span>
                        </div>
                        <p class="app-state-title">Không có cửa hàng phù hợp.</p>
                        <p class="app-state-body">Thử nới bộ lọc tìm kiếm hoặc làm mới dữ liệu QC để xem thêm kết quả.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="space-y-3 p-3 pc:hidden">
            <div
              v-for="store in pagedStores"
              :key="store.id"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:bg-slate-50"
              @click="openStoreDetail(store.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800">{{ store.name }}</p>
                  <p class="text-xs text-slate-500">
                    {{ store.code || store.storeId || '--' }} • {{ store.region }} • Phụ trách: {{ store.managerName }}
                  </p>
                </div>
                <span class="inline-flex h-11 min-w-14 shrink-0 items-center justify-center rounded-full px-3 text-xs font-bold" :class="store.scoreBadgeClass">
                  {{ store.scoreDisplay }}
                </span>
              </div>

              <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div class="rounded-lg bg-slate-50 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-slate-500">Tổng phiên</p>
                  <p class="mt-1 font-semibold text-slate-800">{{ store.totalSessionsLabel }} phiên</p>
                </div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-slate-500">Phiên đạt</p>
                  <p class="mt-1 font-semibold text-emerald-700">{{ store.passedLabel }} phiên</p>
                </div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-slate-500">Phiên lỗi</p>
                  <p class="mt-1 font-semibold text-rose-700">{{ store.failedLabel }} phiên</p>
                </div>
              </div>

              <div class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p class="text-[11px] uppercase tracking-wide text-slate-500">Điểm TB</p>
                <p class="mt-1 font-semibold text-slate-800">{{ store.scoreDisplay }}</p>
              </div>
            </div>

            <div v-if="!hasStores" class="app-state-panel app-state-panel--compact">
              <div class="app-state-stack mx-auto">
                <div class="app-state-icon mx-auto">
                  <span class="material-symbols-outlined text-[24px]">storefront</span>
                </div>
                <p class="app-state-title">Không có cửa hàng phù hợp.</p>
                <p class="app-state-body">Thử nới bộ lọc tìm kiếm hoặc làm mới dữ liệu QC để xem thêm kết quả.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <p class="text-sm text-slate-500">
            Hiển thị
            <span class="font-semibold text-slate-700">{{ paginationStart }} - {{ paginationEnd }}</span>
            trong tổng số
            <span class="font-semibold text-slate-700">{{ filteredStores.length }}</span>
            cửa hàng
          </p>

          <div class="flex max-w-full items-center justify-between gap-3 tablet:justify-end">
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage <= 1"
              @click="prevPage"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div class="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
              <template v-for="item in visiblePageItems" :key="String(item)">
                <button
                  v-if="typeof item === 'number'"
                  type="button"
                  class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors"
                  :class="item === currentPage ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'"
                  @click="goToPage(item)"
                >
                  {{ item }}
                </button>
                <span v-else class="px-1 text-xs text-slate-400">...</span>
              </template>
            </div>

            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPage >= totalPages"
              @click="nextPage"
            >
              <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
