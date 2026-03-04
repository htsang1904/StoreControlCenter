<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { getQcStoresOverviewApi } from '@/services/qc_service'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ReportPeriodDropdown from '@/components/ReportPeriodDropdown.vue'

const router = useRouter()
const { state } = useApp()

const searchInput = ref('')
const searchKeyword = ref('')
const SEARCH_DEBOUNCE_MS = 300
let searchDebounce = null
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

function getPresetRange(key) {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (key === 'today') {
    const day = toIsoDate(current)
    return { from: day, to: day }
  }

  if (key === 'yesterday') {
    const yesterday = new Date(current)
    yesterday.setDate(yesterday.getDate() - 1)
    const day = toIsoDate(yesterday)
    return { from: day, to: day }
  }

  if (key === 'this_month') {
    return {
      from: toIsoDate(new Date(current.getFullYear(), current.getMonth(), 1)),
      to: toIsoDate(current),
    }
  }

  if (key === 'last_month') {
    return {
      from: toIsoDate(new Date(current.getFullYear(), current.getMonth() - 1, 1)),
      to: toIsoDate(new Date(current.getFullYear(), current.getMonth(), 0)),
    }
  }

  return { from: dateFrom.value, to: dateTo.value }
}

function isPresetActive(key) {
  const preset = getPresetRange(key)
  return preset.from === dateFrom.value && preset.to === dateTo.value
}

const activePresetKey = computed(() => {
  const keys = ['today', 'yesterday', 'this_month', 'last_month']
  return keys.find((key) => isPresetActive(key)) || ''
})

async function applyPreset(key) {
  const preset = getPresetRange(key)
  dateFrom.value = preset.from
  dateTo.value = preset.to
  await loadOverview()
}

async function handleRangeChange() {
  await loadOverview()
}

const stores = computed(() => {
  const source = Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []
  return source.map((store) => ({
    id: Number(store?.id || 0),
    storeId: String(store?.storeId || ''),
    code: store?.code || '',
    name: store?.shortAddress || store?.address || store?.code || `Cửa hàng #${store?.id || ''}`,
    address: store?.address || '',
  }))
})

const summaryCards = computed(() => [
  {
    key: 'totalSessions',
    label: 'Tổng phiên QC',
    value: summary.value.totalSessions,
    tone: 'text-blue-600',
    hint: 'Tổng lượt audit đã tạo',
  },
  {
    key: 'passRate',
    label: 'Tỷ lệ đạt',
    value: `${summary.value.passRate}%`,
    tone: 'text-emerald-600',
    hint: 'Số phiên đạt chuẩn',
  },
  {
    key: 'failed',
    label: 'Số phiên không đạt',
    value: summary.value.failed,
    tone: 'text-rose-600',
    hint: 'Cần theo dõi khắc phục',
  },
  {
    key: 'avgScoreRate',
    label: 'Điểm TB',
    value: `${summary.value.avgScoreRate}%`,
    tone: 'text-amber-600',
    hint: `${summary.value.avgScore}/${summary.value.avgMaxScore} điểm`,
  },
])

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

const sortIndicatorClass = (field) => {
  return sortDirections.value[field] ? 'text-slate-700' : 'text-slate-400'
}

const enrichedStores = computed(() => {
  const statsMap = new Map(storeStats.value.map((item) => [Number(item.storeId), item]))
  const keyword = searchKeyword.value.trim().toLowerCase()
  const activeSortFields = sortableFields.filter((field) => sortDirections.value[field])

  return stores.value
    .map((store) => {
      const stat = statsMap.get(store.id)
      return {
        ...store,
        totalSessions: stat?.totalSessions || 0,
        passed: stat?.passed || 0,
        failed: stat?.failed || 0,
        avgScore: stat?.avgScore || 0,
        avgMaxScore: stat?.avgMaxScore || 0,
        avgScoreRate: stat?.avgScoreRate || 0,
        passRate: stat?.passRate || 0,
        lastAuditAt: stat?.lastAuditAt || null,
        lastAuditCode: stat?.lastAuditCode || '--',
        lastAuditResult: stat?.lastAuditResult || null,
      }
    })
    .filter((store) => {
      if (!keyword) return true
      return (
        store.name.toLowerCase().includes(keyword) ||
        store.code.toLowerCase().includes(keyword) ||
        store.storeId.toLowerCase().includes(keyword) ||
        store.address.toLowerCase().includes(keyword)
      )
    })
    .sort((a, b) => {
      for (const field of activeSortFields) {
        const direction = sortDirections.value[field]
        if (!direction) continue

        const aValue = Number(a?.[field] || 0)
        const bValue = Number(b?.[field] || 0)

        if (aValue !== bValue) {
          return direction === 'asc' ? aValue - bValue : bValue - aValue
        }
      }

      return String(a.name || '').localeCompare(String(b.name || ''), 'vi')
    })
})
const hasStores = computed(() => enrichedStores.value.length > 0)

const openStoreDetail = (storeId) => {
  if (!storeId) return
  router.push(`/QC/store/${storeId}`)
}

const loadOverview = async () => {
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
        avgScoreRate: Number(remoteSummary.scoreRate || remoteSummary.avgScoreRate || 0),
        passRate: Number(remoteSummary.passRate || 0),
      }

      storeStats.value = (Array.isArray(remote.data.storeStats) ? remote.data.storeStats : []).map((item) => ({
        storeId: Number(item?.storeId || 0),
        totalSessions: Number(item?.totalSessions || 0),
        passed: Number(item?.passed || 0),
        failed: Number(item?.failed || 0),
        avgScore: Number(item?.avgScore || 0),
        avgMaxScore: Number(item?.avgMaxScore || 0),
        avgScoreRate: Number(item?.scoreRate || item?.avgScoreRate || 0),
        passRate: Number(item?.passRate || 0),
        lastAuditAt: item?.lastAuditedAt || null,
        lastAuditCode: item?.lastSessionCode || '--',
        lastAuditResult: item?.lastAuditResult || null,
      }))
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
  }

  loading.value = false
}

watch(
  stores,
  async () => {
    await loadOverview()
  },
  { immediate: true }
)

watch(searchInput, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }

  searchDebounce = setTimeout(() => {
    searchKeyword.value = String(value || '').trim()
  }, SEARCH_DEBOUNCE_MS)
})

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }
})
</script>

<template>
  <div>
    <div class="header mx-4 flex items-center">
      Báo cáo QC cửa hàng
    </div>

    <div class="page-stack mx-4">
      <section class="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
        <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" :disabled="loading" @change="handleRangeChange" />
          <ReportPeriodDropdown :active-key="activePresetKey" :disabled="loading" @select="applyPreset" />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in summaryCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xs"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold" :class="card.tone">{{ card.value }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ card.hint }}</p>
        </article>
      </section>

      <div class="flex flex-col">
        <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden dark:bg-neutral-900 dark:border-neutral-700">
          <div class="px-4 sm:px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200 dark:border-neutral-700">
            <div>
              <h2 class="text-sm font-semibold text-slate-800">Danh sách cửa hàng</h2>
              <p class="text-xs text-slate-500">Chọn cửa hàng để xem lịch sử hoặc tạo phiên QC mới</p>
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto">
              <div class="relative w-full md:w-[260px]">
                <input
                  v-model="searchInput"
                  type="text"
                  class="py-2 px-3 ps-11 block w-full border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm theo mã, địa chỉ..."
                />
                <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                  <svg class="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <p v-if="loadError" class="px-4 sm:px-6 py-2 text-xs font-medium text-rose-600 border-b border-gray-200">
            {{ loadError }}
          </p>

          <div v-loading="loading">
            <div class="hidden lg:block max-w-full overflow-x-auto">
              <table class="min-w-[760px] w-full divide-y divide-gray-200 dark:divide-neutral-700">
                <thead class="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Mã cửa hàng</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Cửa hàng</th>
                    <th
                      class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700 select-none"
                    >
                      <span class="inline-flex cursor-pointer items-center gap-1" @click="toggleSort('totalSessions')">
                        Phiên QC
                        <span class="text-[11px]" :class="sortIndicatorClass('totalSessions')">{{ sortIndicator('totalSessions') }}</span>
                      </span>
                    </th>
                    <th
                      class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700 select-none"
                    >
                      <span class="inline-flex cursor-pointer items-center gap-1" @click="toggleSort('avgScoreRate')">
                        Điểm TB
                        <span class="text-[11px]" :class="sortIndicatorClass('avgScoreRate')">{{ sortIndicator('avgScoreRate') }}</span>
                      </span>
                    </th>
                    <th
                      class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700 select-none"
                    >
                      <span class="inline-flex cursor-pointer items-center gap-1" @click="toggleSort('failed')">
                        Không đạt
                        <span class="text-[11px]" :class="sortIndicatorClass('failed')">{{ sortIndicator('failed') }}</span>
                      </span>
                    </th>
                    <th class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700"></th>
                  </tr>
                </thead>

                <tbody v-if="hasStores" class="divide-y divide-gray-200 dark:divide-neutral-700">
                  <tr
                    v-for="store in enrichedStores"
                    :key="store.id"
                    class="bg-white hover:bg-gray-50 cursor-pointer"
                    @click="openStoreDetail(store.id)"
                  >
                    <td class="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600">{{ store.code || store.storeId || '--' }}</td>
                    <td class="px-3 sm:px-4 py-2">
                      <p class="text-sm font-medium text-gray-700">{{ store.name }}</p>
                      <p class="text-xs text-gray-500">{{ store.address || 'Chưa có địa chỉ' }}</p>
                    </td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-end text-gray-700">{{ store.totalSessions }}</td>
                    <td class="px-3 sm:px-4 py-2 text-end">
                      <p class="text-sm font-semibold text-gray-700">{{ store.avgScoreRate }}%</p>
                      <p class="text-xs text-slate-500">{{ store.avgScore }}/{{ store.avgMaxScore }}</p>
                    </td>
                    <td class="px-3 sm:px-4 py-2 text-sm text-end text-rose-600 font-semibold">{{ store.failed }}</td>
                    <td class="px-3 sm:px-4 py-2 text-end">
                      <button
                        type="button"
                        class="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        @click.stop="openStoreDetail(store.id)"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                </tbody>

                <tbody v-else>
                  <tr>
                    <td colspan="6" class="py-10">
                      <div class="flex flex-col items-center justify-center text-gray-500">
                        <p class="text-sm">Không có cửa hàng phù hợp với bộ lọc tìm kiếm.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="lg:hidden p-3 sm:p-4 space-y-3">
              <div
                v-for="store in enrichedStores"
                :key="store.id"
                class="cursor-pointer rounded-xl border border-gray-200 bg-white p-3.5 hover:bg-gray-50"
                @click="openStoreDetail(store.id)"
              >
                <div class="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p class="text-base font-semibold text-slate-700">
                    Mã cửa hàng: <span class="text-blue-600">{{ store.code || store.storeId || '--' }}</span>
                  </p>
                  <p class="mt-1 text-sm leading-snug font-semibold text-slate-700 line-clamp-2">{{ store.name }}</p>
                </div>

                <div class="mt-3 space-y-1.5 text-sm">
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Địa chỉ:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ store.address || 'Chưa có địa chỉ' }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Phiên QC:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ store.totalSessions }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Điểm TB:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ store.avgScoreRate }}%</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Phiên không đạt:</span>
                    <span class="min-w-0 text-right font-semibold text-rose-600">{{ store.failed }}</span>
                  </div>
                </div>
              </div>

              <div v-if="!hasStores" class="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
                Không có cửa hàng phù hợp với bộ lọc tìm kiếm.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
