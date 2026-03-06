<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { getQcStoresOverviewApi } from '@/services/qc_service'

const router = useRouter()
const route = useRoute()
const { state } = useApp()

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 5

const searchInput = ref('')
const searchKeyword = ref('')
const searchDebounce = ref(null)
const currentPage = ref(1)

const sortDirections = ref({
  totalSessions: null,
  avgScoreRate: null,
  failed: null,
})

const loading = ref(false)
const dateFrom = ref(shiftDays(-6))
const dateTo = ref(shiftDays(0))
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

function toIsoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function shiftDays(days) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return toIsoDate(base)
}

function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

function getDefaultRange() {
  return {
    from: shiftDays(-6),
    to: shiftDays(0),
  }
}

function normalizeRangeFromQuery(query) {
  const fallback = getDefaultRange()
  const from = isValidYmd(query?.date_from) ? String(query.date_from) : fallback.from
  const to = isValidYmd(query?.date_to) ? String(query.date_to) : fallback.to
  if (from > to) return fallback
  return { from, to }
}

function syncRangeFromRoute() {
  const range = normalizeRangeFromQuery(route.query || {})
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
      badgeClass: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
      scoreClass: 'border border-slate-200 bg-slate-100 text-slate-500',
    }
  }

  const scoreRate = Number(store.avgScoreRate || 0)
  const failed = Number(store.failed || 0)

  if (scoreRate >= 85 && failed <= 0) {
    return {
      key: 'standard',
      label: 'Đạt tiêu chuẩn',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
      scoreClass: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
    }
  }

  if (scoreRate >= 70) {
    return {
      key: 'warning',
      label: 'Cần nhắc nhở',
      badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
      scoreClass: 'border border-amber-200 bg-amber-100 text-amber-700',
    }
  }

  return {
    key: 'critical',
    label: 'Vi phạm nghiêm trọng',
    badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
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

const sortableFields = ['totalSessions', 'avgScoreRate', 'failed']
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

  return stores.value.map((store) => {
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

    return {
      ...merged,
      region,
      healthLabel: health.label,
      healthBadgeClass: health.badgeClass,
      scoreBadgeClass: health.scoreClass,
      scoreDisplay: !merged.lastAuditAt ? '--' : Number(merged.avgScoreRate || 0).toFixed(1),
      lastUpdatedLabel: formatRelativeTime(merged.lastAuditAt),
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
    trend: `~${completedRate.value.toFixed(1)}%`,
    trendClass: 'text-emerald-600',
    accent: '',
  },
  {
    key: 'avg_score',
    label: 'QC Score TB',
    value: avgQcScore.value.toFixed(2),
    trend: `~${Number(summary.value.avgScore || 0).toFixed(1)}`,
    trendClass: 'text-emerald-600',
    accent: '',
  },
  {
    key: 'need_review',
    label: 'Cần kiểm tra lại',
    value: new Intl.NumberFormat('vi-VN').format(needReviewCount.value),
    trend: `~${summary.value.failed}`,
    trendClass: 'text-rose-500',
    accent: '',
  },
  {
    key: 'completed',
    label: 'Đã hoàn thành QC',
    value: `${completedRate.value.toFixed(1)}%`,
    trend: `~${Number(summary.value.passRate || 0).toFixed(1)}%`,
    trendClass: 'text-emerald-600',
    accent: '',
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

function goToCreateBatch() {
  const target = filteredStores.value[0] || normalizedStores.value[0]
  if (!target?.id) return
  router.push(`/QC/store/${target.id}/create`)
}

async function loadOverview() {
  loading.value = true
  loadError.value = ''

  try {
    const storeIds = stores.value
      .map((store) => Number(store?.storeId || 0))
      .filter((storeId) => Number.isInteger(storeId) && storeId > 0)
    const targetPageSize = storeIds.length > 0
      ? Math.min(Math.max(stores.value.length, 100), 1000)
      : 5000

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
  <div>
    <div class="page-stack mx-2 overflow-visible space-y-4 sm:mx-3 md:mx-0">
      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="ml-auto flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <div class="relative min-w-[220px] flex-1 lg:w-[320px] lg:flex-none">
                <input
                  v-model="searchInput"
                  type="text"
                  class="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm theo mã CH, tên cửa hàng hoặc người phụ trách"
                />
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 transition-colors hover:bg-slate-50"
                @click="handleRefresh"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 11a8 8 0 1 0 2.3 5.7" />
                  <path d="M20 4v7h-7" />
                </svg>
              </button>

              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                @click="exportReport"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Xuất báo cáo
              </button>

              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="normalizedStores.length <= 0"
                @click="goToCreateBatch"
              >
                <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Tạo đợt QC
              </button>
            </div>
          </div>
        </div>

        <p v-if="loadError" class="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-600">
          {{ loadError }}
        </p>

        <div v-loading="loading">
          <div class="hidden overflow-x-auto lg:block">
            <table class="min-w-[1020px] w-full border-collapse text-left">
              <thead>
                <tr class="bg-slate-50">
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mã cửa hàng</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tên cửa hàng</th>
                  <th class="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">QC Score</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Khu vực</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Cập nhật cuối</th>
                  <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                </tr>
              </thead>

              <tbody v-if="hasStores" class="divide-y divide-slate-100">
                <tr
                  v-for="store in pagedStores"
                  :key="store.id"
                  class="cursor-pointer transition-colors hover:bg-slate-50/70"
                  @click="openStoreDetail(store.id)"
                >
                  <td class="px-4 py-3 text-sm font-bold text-slate-900">{{ store.code || store.storeId || '--' }}</td>
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-slate-900">{{ store.name }}</p>
                    <p class="text-xs text-slate-500">Phụ trách: {{ store.managerName }}</p>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span
                      class="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                      :class="store.scoreBadgeClass"
                    >
                      {{ store.scoreDisplay }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{ store.region }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="store.healthBadgeClass">
                      <span class="mr-1.5 text-[10px]">•</span>{{ store.healthLabel }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm italic text-slate-500">{{ store.lastUpdatedLabel }}</td>
                  <td class="px-4 py-3 text-end">
                    <button
                      type="button"
                      class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                      @click.stop="openStoreDetail(store.id)"
                    >
                      <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr>
                  <td colspan="7" class="py-10">
                    <div class="flex flex-col items-center justify-center text-slate-500">
                      <p class="text-sm">Không có cửa hàng phù hợp với bộ lọc tìm kiếm.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="space-y-3 p-3 lg:hidden">
            <div
              v-for="store in pagedStores"
              :key="store.id"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:bg-slate-50"
              @click="openStoreDetail(store.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-900">{{ store.code || store.storeId || '--' }}</p>
                  <p class="mt-1 text-sm font-semibold text-slate-800">{{ store.name }}</p>
                  <p class="text-xs text-slate-500">Phụ trách: {{ store.managerName }}</p>
                </div>
                <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" :class="store.scoreBadgeClass">
                  {{ store.scoreDisplay }}
                </span>
              </div>

              <div class="mt-3 space-y-1.5 text-sm text-slate-600">
                <p>Khu vực: <span class="font-medium text-slate-700">{{ store.region }}</span></p>
                <p>Trạng thái: <span class="font-medium text-slate-700">{{ store.healthLabel }}</span></p>
                <p>Cập nhật: <span class="font-medium text-slate-700">{{ store.lastUpdatedLabel }}</span></p>
              </div>

              <div class="mt-3">
                <button
                  type="button"
                  class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  @click.stop="openStoreDetail(store.id)"
                >
                  Xem chi tiết
                </button>
              </div>
            </div>

            <div v-if="!hasStores" class="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              Không có cửa hàng phù hợp với bộ lọc tìm kiếm.
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
          <p class="text-sm text-slate-500">
            Hiển thị
            <span class="font-semibold text-slate-700">{{ paginationStart }} - {{ paginationEnd }}</span>
            trong tổng số
            <span class="font-semibold text-slate-700">{{ filteredStores.length }}</span>
            cửa hàng
          </p>

          <div class="flex items-center gap-2">
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

            <template v-for="item in visiblePageItems" :key="String(item)">
              <button
                v-if="typeof item === 'number'"
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors"
                :class="item === currentPage ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
              <span v-else class="px-1 text-xs text-slate-400">...</span>
            </template>

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

      <section class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in summaryCards"
          :key="card.key"
          class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          :class="card.accent"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ card.value }}</p>
          <p class="mt-2 text-xs font-medium" :class="card.trendClass">{{ card.trend }}</p>
        </article>
      </section>
    </div>
  </div>
</template>
