<script setup>
import { computed, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'
import { getDashboardOverview } from '@/services/ticket_service'
import { getQcStoresOverviewApi } from '@/services/qc_service'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ReportPeriodDropdown from '@/components/ReportPeriodDropdown.vue'

const { state } = useApp()

const loading = ref(false)
const errorMessage = ref('')
const dateFrom = ref(toIsoDate(shiftDays(-6)))
const dateTo = ref(toIsoDate(new Date()))

const ticketSummary = ref({
  total_ticket: 0,
  in_progress: 0,
  resolved: 0,
  overdue: 0,
})
const ticketStatus = ref([])
const ticketTopStores = ref([])
const ticketActivityFeed = ref([])

const qcSummary = ref({
  totalSessions: 0,
  passed: 0,
  failed: 0,
  avgScore: 0,
  avgMaxScore: 0,
  passRate: 0,
})
const showAllStores = ref(false)

function shiftDays(days) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return base
}

function toIsoDate(date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return normalized.toISOString().slice(0, 10)
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
  await loadDashboard()
}

async function handleRangeChange() {
  await loadDashboard()
}

const stores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))

const combinedCards = computed(() => [
  {
    key: 'operations',
    label: 'Tổng nghiệp vụ',
    value: Number(ticketSummary.value.total_ticket || 0) + Number(qcSummary.value.totalSessions || 0),
    hint: 'Ticket + phiên QC',
    tone: 'text-blue-600',
  },
  {
    key: 'ticket_active',
    label: 'Ticket đang xử lý',
    value: Number(ticketSummary.value.in_progress || 0),
    hint: 'Luồng yêu cầu xử lý',
    tone: 'text-amber-600',
  },
  {
    key: 'qc_pass_rate',
    label: 'QC pass rate',
    value: `${Number(qcSummary.value.passRate || 0)}%`,
    hint: 'Theo phiên QC đã chấm',
    tone: 'text-emerald-600',
  },
  {
    key: 'risk',
    label: 'Điểm cảnh báo',
    value: Number(ticketSummary.value.overdue || 0) + Number(qcSummary.value.failed || 0),
    hint: 'Quá hạn ticket + QC fail',
    tone: 'text-rose-600',
  },
])

const ticketCards = computed(() => [
  {
    label: 'Tổng ticket',
    value: Number(ticketSummary.value.total_ticket || 0),
    chip: 'bg-blue-50 text-blue-700',
  },
  {
    label: 'Đang xử lý',
    value: Number(ticketSummary.value.in_progress || 0),
    chip: 'bg-amber-50 text-amber-700',
  },
  {
    label: 'Đã xử lý',
    value: Number(ticketSummary.value.resolved || 0),
    chip: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Sắp quá hạn',
    value: Number(ticketSummary.value.overdue || 0),
    chip: 'bg-rose-50 text-rose-700',
  },
])

const ticketStatusData = computed(() => {
  const statusColorMap = {
    new: 'bg-slate-500',
    in_progress: 'bg-amber-500',
    resolved: 'bg-emerald-500',
    rejected: 'bg-rose-500',
  }

  return (Array.isArray(ticketStatus.value) ? ticketStatus.value : []).map((item) => ({
    ...item,
    value: Number(item?.value || 0),
    color: statusColorMap[item?.key] || 'bg-slate-400',
  }))
})

const ticketStatusTotal = computed(() => ticketStatusData.value.reduce((sum, item) => sum + item.value, 0))
const ticketStatusWithPercent = computed(() =>
  ticketStatusData.value.map((item) => ({
    ...item,
    percent: ticketStatusTotal.value > 0 ? Math.round((item.value / ticketStatusTotal.value) * 100) : 0,
  }))
)

const displayedTopStores = computed(() => {
  const source = Array.isArray(ticketTopStores.value) ? ticketTopStores.value : []
  if (showAllStores.value) return source
  return source.slice(0, 5)
})

const maxTopStoreCount = computed(() =>
  (Array.isArray(ticketTopStores.value) ? ticketTopStores.value : []).reduce((max, store) => (store.count > max ? store.count : max), 1)
)

const qcCards = computed(() => [
  {
    label: 'Tổng phiên QC',
    value: Number(qcSummary.value.totalSessions || 0),
    chip: 'bg-blue-50 text-blue-700',
  },
  {
    label: 'Phiên đạt',
    value: Number(qcSummary.value.passed || 0),
    chip: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Phiên không đạt',
    value: Number(qcSummary.value.failed || 0),
    chip: 'bg-rose-50 text-rose-700',
  },
  {
    label: 'Điểm trung bình',
    value: `${Number(qcSummary.value.avgScore || 0)}/${Number(qcSummary.value.avgMaxScore || 0)}`,
    chip: 'bg-amber-50 text-amber-700',
  },
])

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const ticketResult = await getDashboardOverview({
      date_from: dateFrom.value,
      date_to: dateTo.value,
      top_stores_limit: 5,
      activity_limit: 5,
    })

    const ticketPayload = ticketResult?.data || ticketResult || {}
    ticketSummary.value = {
      total_ticket: Number(ticketPayload?.summary?.total_ticket || 0),
      in_progress: Number(ticketPayload?.summary?.in_progress || 0),
      resolved: Number(ticketPayload?.summary?.resolved || 0),
      overdue: Number(ticketPayload?.summary?.overdue || 0),
    }
    ticketStatus.value = Array.isArray(ticketPayload?.status) ? ticketPayload.status : []
    ticketTopStores.value = Array.isArray(ticketPayload?.top_stores) ? ticketPayload.top_stores : []
    ticketActivityFeed.value = Array.isArray(ticketPayload?.activity_feed) ? ticketPayload.activity_feed : []

    const storeIds = stores.value
      .map((store) => Number(store?.storeId || 0))
      .filter((storeId) => Number.isInteger(storeId) && storeId > 0)

    try {
      const qcResult = await getQcStoresOverviewApi({
        from: dateFrom.value,
        to: dateTo.value,
        page: 1,
        pageSize: 5000,
        storeIds,
      })
      const remoteSummary = qcResult?.data?.summary || {}
      qcSummary.value = {
        totalSessions: Number(remoteSummary.totalSessions || 0),
        passed: Number(remoteSummary.passed || 0),
        failed: Number(remoteSummary.failed || 0),
        avgScore: Number(remoteSummary.avgScore || 0),
        avgMaxScore: Number(remoteSummary.avgMaxScore || 0),
        passRate: Number(remoteSummary.passRate || 0),
      }
    } catch (error) {
      qcSummary.value = {
        totalSessions: 0,
        passed: 0,
        failed: 0,
        avgScore: 0,
        avgMaxScore: 0,
        passRate: 0,
      }
      errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tải dữ liệu QC.'
    }
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tải dữ liệu tổng quan.'
  } finally {
    loading.value = false
  }
}

watch(
  stores,
  async () => {
    await loadDashboard()
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <div class="header mx-4 flex items-center">
      Tổng quan vận hành (Ticket + QC)
    </div>

    <div class="page-stack mx-4">
      <section class="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
        <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" :disabled="loading" @change="handleRangeChange" />
          <ReportPeriodDropdown :active-key="activePresetKey" :disabled="loading" @select="applyPreset" />
        </div>
        <p v-if="errorMessage" class="mt-2 text-xs text-red-600">{{ errorMessage }}</p>
      </section>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="card in combinedCards" :key="card.key" class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xs">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold" :class="card.tone">{{ card.value }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ card.hint }}</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <h2 class="text-sm font-semibold text-slate-800">Snapshot luồng yêu cầu xử lý</h2>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div v-for="card in ticketCards" :key="card.label" class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p class="text-xs text-slate-500">{{ card.label }}</p>
              <p class="mt-1 text-lg font-bold text-slate-800">{{ card.value }}</p>
              <span class="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold" :class="card.chip">Ticket</span>
            </div>
          </div>
        </article>

        <article class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <h2 class="text-sm font-semibold text-slate-800">Snapshot nghiệp vụ QC</h2>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div v-for="card in qcCards" :key="card.label" class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p class="text-xs text-slate-500">{{ card.label }}</p>
              <p class="mt-1 text-lg font-bold text-slate-800">{{ card.value }}</p>
              <span class="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold" :class="card.chip">QC</span>
            </div>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <article class="xl:col-span-6 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-800">Tỷ trọng theo trạng thái ticket</h2>
            <span class="text-xs text-slate-500">Tổng {{ ticketStatusTotal }} ticket</span>
          </div>

          <div class="mt-4 space-y-3">
            <div v-for="item in ticketStatusWithPercent" :key="item.label">
              <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>{{ item.label }}</span>
                <span class="font-semibold">{{ item.value }} ({{ item.percent }}%)</span>
              </div>
              <div class="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500" :class="item.color" :style="{ width: `${item.percent}%` }"></div>
              </div>
            </div>
          </div>
        </article>

        <article class="xl:col-span-6 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-slate-800">Top cửa hàng có nhiều ticket</h2>
            <button
              type="button"
              class="text-xs font-semibold text-blue-600 hover:text-blue-700"
              @click="showAllStores = !showAllStores"
            >
              {{ showAllStores ? 'Thu gọn' : 'Xem tất cả' }}
            </button>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="store in displayedTopStores" :key="`${store.store_id}-${store.name}`" class="grid grid-cols-[1fr_auto] items-center gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-700">{{ store.name }}</p>
                <div class="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    :style="{ width: `${Math.round((store.count / maxTopStoreCount) * 100)}%` }"
                  ></div>
                </div>
              </div>
              <span class="text-xs font-semibold rounded-md bg-blue-50 text-blue-700 px-2 py-1">{{ store.count }}</span>
            </div>
            <p v-if="!displayedTopStores.length && !loading" class="text-sm text-slate-500">Không có dữ liệu cửa hàng trong khoảng thời gian đã chọn.</p>
          </div>
        </article>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
        <h2 class="text-sm font-semibold text-slate-800">Hoạt động gần nhất của ticket</h2>
        <ul class="mt-3 divide-y divide-gray-100">
          <li v-for="item in ticketActivityFeed" :key="`${item.at}-${item.content}`" class="py-2.5 flex items-start gap-3">
            <span class="text-xs font-semibold text-blue-600 rounded-md bg-blue-50 px-2 py-1 shrink-0">{{ item.time }}</span>
            <p class="text-sm text-slate-700">{{ item.content }}</p>
          </li>
          <li v-if="!ticketActivityFeed.length && !loading" class="py-2.5">
            <p class="text-sm text-slate-500">Chưa có hoạt động nào trong khoảng thời gian đã chọn.</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
