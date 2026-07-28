<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDefaultDateRange, normalizeDateRangeFromQuery } from '@/composables/useDateRange'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import AppPagination from '@/components/AppPagination.vue'
import { useApp } from '@/plugins/app'
import { getQcStoresOverviewApi } from '@/services/qc_service'
import { listAdminStores } from '@/services/admin_service'

const router = useRouter()
const route = useRoute()
const { state } = useApp()

const SEARCH_DEBOUNCE_MS = 300
const pageSizeOptions = [20, 50, 100]
const initialRange = getDefaultDateRange()

const searchInput = ref('')
const searchKeyword = ref('')
const searchDebounce = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const numberFormatter = new Intl.NumberFormat('vi-VN')

const sortDirections = ref({
  totalSessions: null,
  passed: null,
  draftSessions: null,
  activeFindingSessions: null,
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
const adminStoreRows = ref([])
const adminStoresLoaded = ref(false)
const adminStoresLoading = ref(false)
const loadError = ref('')

const isAdmin = computed(() => String(state.userInfo?.role || '').toLowerCase() === 'admin')

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
      scoreClass: 'border border-[var(--stroke)] bg-[var(--primary-softer)] text-[var(--text-secondary)]',
    }
  }

  const scoreRate = Number(store.avgScoreRate || 0)
  const failed = Number(store.failed || 0)

  if (scoreRate >= 85 && failed <= 0) {
    return {
      key: 'standard',
      label: 'Đạt tiêu chuẩn',
      badgeClass: 'app-badge--success',
      scoreClass: 'border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]',
    }
  }

  if (scoreRate >= 70) {
    return {
      key: 'warning',
      label: 'Cần nhắc nhở',
      badgeClass: 'app-badge--warning',
      scoreClass: 'border border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]',
    }
  }

  return {
    key: 'critical',
    label: 'Vi phạm nghiêm trọng',
    badgeClass: 'app-badge--danger',
    scoreClass: 'border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]',
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
  const source = isAdmin.value
    ? adminStoreRows.value
    : (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : [])
  return source.map((store) => ({
    id: Number(store?.id || 0),
    storeId: String(store?.storeId || ''),
    code: store?.code || '',
    name: store?.name || store?.code || `Cửa hàng #${store?.id || ''}`,
    address: store?.address || '',
    shortAddress: store?.shortAddress || store?.address || '',
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
      shortAddress: stat?.shortAddress || stat?.address || '',
      managerName: 'Chưa gán',
    })
  })

  return localRows
})

const sortableFields = ['totalSessions', 'passed', 'draftSessions', 'activeFindingSessions', 'failed', 'avgScoreRate']
const sortCycle = [null, 'desc', 'asc']

const toggleSort = (field) => {
  if (!sortableFields.includes(field)) return
  const currentDirection = sortDirections.value[field] ?? null
  const currentIndex = sortCycle.indexOf(currentDirection)
  const nextIndex = (currentIndex + 1) % sortCycle.length
  sortDirections.value = {
    totalSessions: null,
    passed: null,
    draftSessions: null,
    activeFindingSessions: null,
    avgScoreRate: null,
    failed: null,
  }
  sortDirections.value[field] = sortCycle[nextIndex]
}

const sortIndicator = (field) => {
  if (sortDirections.value[field] === 'desc') return '↓'
  if (sortDirections.value[field] === 'asc') return '↑'
  return '↕'
}

const sortIndicatorClass = (field) => (sortDirections.value[field] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')

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
      draftSessions: Number(stat?.draftSessions || 0),
      activeFindingSessions: Number(stat?.activeFindingSessions || 0),
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
      storeSubtitle: merged.shortAddress || merged.address || '--',
      healthLabel: health.label,
      healthBadgeClass: health.badgeClass,
      scoreBadgeClass: health.scoreClass,
      scoreDisplay: !merged.lastAuditAt ? '--' : `${Number(merged.avgScoreRate || 0).toFixed(1)}%`,
      totalSessionsLabel: numberFormatter.format(totalSessions),
      passedLabel: numberFormatter.format(passed),
      failedLabel: numberFormatter.format(failed),
      draftSessionsLabel: numberFormatter.format(Number(merged.draftSessions || 0)),
      activeFindingSessionsLabel: numberFormatter.format(Number(merged.activeFindingSessions || 0)),
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
  const pageCount = Math.ceil(filteredStores.value.length / pageSize.value)
  return Math.max(pageCount, 1)
})

const pagedStores = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredStores.value.slice(start, start + pageSize.value)
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
  return total / audited.length
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
    hint: 'Tổng số cửa hàng trong danh sách QC hiện tại.',
    tone: 'sky',
  },
  {
    key: 'avg_score',
    label: 'Điểm QC TB',
    value: `${avgQcScore.value.toFixed(1)}%`,
    meta: `Toàn kỳ ${Number(summary.value.avgScoreRate || 0).toFixed(1)}%`,
    hint: 'Điểm QC trung bình quy đổi theo phần trăm của các cửa hàng đang hiển thị.',
    tone: 'teal',
  },
  {
    key: 'need_review',
    label: 'Cần kiểm tra lại',
    value: new Intl.NumberFormat('vi-VN').format(needReviewCount.value),
    meta: `${summary.value.failed} phiên không đạt`,
    hint: 'Số cửa hàng có phiên QC lỗi hoặc cần kiểm tra lại.',
    tone: 'rose',
  },
  {
    key: 'completed',
    label: 'Đã hoàn thành QC',
    value: `${completedRate.value.toFixed(1)}%`,
    meta: `Pass ${Number(summary.value.passRate || 0).toFixed(1)}%`,
    hint: 'Tỷ lệ cửa hàng đã hoàn thành QC trong danh sách hiện tại.',
    tone: 'emerald',
  },
])

function goToPage(page) {
  if (!Number.isInteger(page)) return
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
}

function openStoreDetail(store) {
  const storeId = Number(store?.id || 0)
  if (!storeId) return
  const query = {}
  if (store?.name) query.storeName = store.name
  if (route.query.date_from) query.date_from = route.query.date_from
  if (route.query.date_to) query.date_to = route.query.date_to
  router.push({ path: `/QC/store/${storeId}`, query })
}

async function handleRefresh() {
  await loadOverview()
}

function exportReport() {
  const headers = ['Ma cua hang', 'Ten cua hang', 'Khu vuc', 'Diem QC %', 'Phien nhap', 'Phien loi mo', 'Trang thai', 'Cap nhat cuoi']
  const rows = filteredStores.value.map((store) => [
    store.code || store.storeId || '',
    store.name || '',
    store.region || '',
    store.scoreDisplay,
    store.draftSessionsLabel,
    store.activeFindingSessionsLabel,
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

async function loadAdminStores() {
  if (!isAdmin.value || adminStoresLoaded.value || adminStoresLoading.value) return

  adminStoresLoading.value = true
  try {
    const firstPage = await listAdminStores({ page: 1, pageSize: 500 })
    const rows = Array.isArray(firstPage.items) ? [...firstPage.items] : []
    const pageCount = Number(firstPage.pagination?.pageCount || 1)

    for (let page = 2; page <= pageCount; page += 1) {
      const result = await listAdminStores({ page, pageSize: 500 })
      if (Array.isArray(result.items)) rows.push(...result.items)
    }

    adminStoreRows.value = rows
    adminStoresLoaded.value = true
  } catch (error) {
    loadError.value = error?.response?.data?.message || error?.message || 'Không tải được danh sách cửa hàng cho admin.'
  } finally {
    adminStoresLoading.value = false
  }
}

async function loadOverview() {
  loading.value = true
  loadError.value = ''

  try {
    await loadAdminStores()

    const queryStoreIds = route.query.store_ids
      ? route.query.store_ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
      : []
    const storeIds = queryStoreIds.length > 0
      ? queryStoreIds
      : isAdmin.value
        ? []
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
    isAdmin,
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
    sortDirections.value.draftSessions,
    sortDirections.value.activeFindingSessions,
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
  <div class="app-page flex min-h-full flex-col pc:h-full pc:min-h-0 pc:overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col gap-4 pc:overflow-hidden">
      <section class="shrink-0 grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4">
        <StatSummaryCard
          v-for="card in summaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :hint="card.hint"
          :tone="card.tone"
        />
      </section>

      <section class="app-section flex min-h-0 flex-1 flex-col pc:overflow-hidden">
        <div class="shrink-0 border-b border-[var(--stroke)] p-3 tablet:p-4">

          <div class="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap tablet:items-center">
            <div class="relative w-full min-w-0 tablet:min-w-[220px] tablet:flex-1 pc:w-[320px] pc:flex-none">
              <input
                v-model="searchInput"
                type="text"
                class="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white pl-9 pr-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
                placeholder="Tìm kiếm ..."
              />
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 tablet:flex tablet:w-auto tablet:flex-wrap tablet:items-center tablet:ml-auto">
              <button
                type="button"
                class="inline-flex h-9 w-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] pc:w-auto pc:gap-1.5 pc:px-3 pc:text-sm pc:font-medium"
                title="Tải lại"
                aria-label="Tải lại"
                @click="handleRefresh"
              >
                <span class="material-symbols-outlined text-[18px]">refresh</span>
                <span class="hidden pc:inline">Tải lại</span>
              </button>

              <button
                type="button"
                class="inline-flex h-9 w-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:ml-auto pc:w-auto pc:gap-1.5 pc:px-3 pc:text-sm pc:font-medium"
                title="Xuất báo cáo"
                aria-label="Xuất báo cáo"
                @click="exportReport"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                <span class="hidden pc:inline">Xuất báo cáo</span>
              </button>
            </div>
          </div>
        </div>

        <p v-if="loadError" class="app-state-banner m-4 mb-0 shrink-0 text-xs font-medium">
          {{ loadError }}
        </p>

        <div v-loading="loading" class="min-h-0 flex-1 pc:overflow-y-auto">
          <div class="hidden pc:block">
            <table class="min-w-[1080px] w-full border-collapse text-left">
              <thead class="sticky top-0 z-10 bg-[var(--surface-muted)] shadow-[0_1px_0_var(--stroke)]">
                <tr>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Cửa hàng</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('totalSessions')">
                      <span>Tổng phiên</span>
                      <span :class="sortIndicatorClass('totalSessions')">{{ sortIndicator('totalSessions') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('passed')">
                      <span>Phiên đạt</span>
                      <span :class="sortIndicatorClass('passed')">{{ sortIndicator('passed') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('draftSessions')">
                      <span>Phiên nháp</span>
                      <span :class="sortIndicatorClass('draftSessions')">{{ sortIndicator('draftSessions') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('failed')">
                      <span>Phiên không đạt</span>
                      <span :class="sortIndicatorClass('failed')">{{ sortIndicator('failed') }}</span>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('activeFindingSessions')">
                      <span>Phiên lỗi mở</span>
                      <span :class="sortIndicatorClass('activeFindingSessions')">{{ sortIndicator('activeFindingSessions') }}</span>
                    </button>
                  </th>
                  <th class="w-[104px] px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('avgScoreRate')">
                      <span>Điểm QC</span>
                      <span :class="sortIndicatorClass('avgScoreRate')">{{ sortIndicator('avgScoreRate') }}</span>
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody v-if="hasStores" class="divide-y divide-[var(--stroke)]">
                <tr
                  v-for="store in pagedStores"
                  :key="store.id"
                  class="cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                  @click="openStoreDetail(store)"
                >
                  <td class="px-4 py-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-[var(--text-primary)]">{{ store.name }}</p>
                      <p class="text-xs text-[var(--text-secondary)]">{{ store.storeSubtitle }}</p>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-semibold text-[var(--text-primary)]">{{ store.totalSessionsLabel }} phiên</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium app-badge--success">
                      {{ store.passedLabel }} phiên
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      :class="Number(store.draftSessions || 0) > 0 ? 'app-badge--warning' : 'app-badge--neutral'"
                    >
                      {{ store.draftSessionsLabel }} phiên
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium app-badge--danger">
                      {{ store.failedLabel }} phiên
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      :class="Number(store.activeFindingSessions || 0) > 0 ? 'app-badge--warning' : 'app-badge--neutral'"
                    >
                      {{ store.activeFindingSessionsLabel }} phiên
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
                  <td colspan="7" class="px-4 py-10">
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

          <div class="space-y-2 p-2.5 pc:hidden">
            <div
              v-for="store in pagedStores"
              :key="store.id"
              class="cursor-pointer rounded-lg border border-[var(--stroke)] bg-white p-3 shadow-sm transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)]"
              @click="openStoreDetail(store)"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">{{ store.name }}</p>
                <p class="mt-0.5 truncate text-xs leading-4 text-[var(--text-secondary)]">{{ store.storeSubtitle }}</p>
              </div>

              <div class="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                <div class="rounded-md bg-[var(--surface-muted)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Tổng</p>
                  <p class="mt-0.5 font-bold text-[var(--text-primary)]">{{ store.totalSessionsLabel }}</p>
                </div>
                <div class="rounded-md bg-[var(--success-bg)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Đạt</p>
                  <p class="mt-0.5 font-bold text-[var(--success-text)]">{{ store.passedLabel }}</p>
                </div>
                <div class="rounded-md bg-[var(--warning-bg)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Nháp</p>
                  <p class="mt-0.5 font-bold text-[var(--warning-text)]">{{ store.draftSessionsLabel }}</p>
                </div>
                <div class="rounded-md bg-[var(--danger-bg)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Không đạt</p>
                  <p class="mt-0.5 font-bold text-[var(--danger-text)]">{{ store.failedLabel }}</p>
                </div>
                <div class="rounded-md bg-[var(--warning-bg)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Phiên mở</p>
                  <p class="mt-0.5 font-bold text-[var(--warning-text)]">{{ store.activeFindingSessionsLabel }}</p>
                </div>
                <div class="rounded-md bg-[var(--primary-softer)] px-2 py-1.5">
                  <p class="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Điểm %</p>
                  <p class="mt-0.5 font-bold text-[var(--text-primary)]">{{ store.scoreDisplay }}</p>
                </div>
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

        <AppPagination class="shrink-0" :page="currentPage" :page-count="totalPages" :page-size="pageSize" :page-size-options="pageSizeOptions" :total="filteredStores.length" :loading="loading" item-label="cửa hàng" @update:page="goToPage" @update:page-size="changePageSize" />
      </section>
    </div>
  </div>
</template>
