<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getDashboardOverview } from '@/services/ticket_service'

const toIsoDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const shiftDays = (days) => {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return toIsoDate(base)
}

const today = toIsoDate(new Date())
const dateFrom = ref(shiftDays(-6))
const dateTo = ref(today)
const showAllStores = ref(false)
const rangePickerOpen = ref(false)
const rangePickerRef = ref(null)
const dashboardLoading = ref(false)
const dashboardError = ref('')
const overviewData = ref({
  summary: {
    total_ticket: 0,
    in_progress: 0,
    resolved: 0,
    overdue: 0,
  },
  status: [],
  top_stores: [],
  activity_feed: [],
})

let rangePickerInstance = null

const summaryBase = [
  {
    key: 'total_ticket',
    label: 'Tổng ticket',
    delta: 'Trong kỳ',
    tone: 'text-blue-600',
    chip: 'bg-blue-50 text-blue-700',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    delta: 'Đang mở',
    tone: 'text-amber-600',
    chip: 'bg-amber-50 text-amber-700',
  },
  {
    key: 'resolved',
    label: 'Đã xử lý',
    delta: 'Trong kỳ',
    tone: 'text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700',
  },
  {
    key: 'overdue',
    label: 'Sắp quá hạn',
    delta: 'Cần ưu tiên',
    tone: 'text-rose-600',
    chip: 'bg-rose-50 text-rose-700',
  },
]

const summaryCards = computed(() =>
  summaryBase.map((item) => ({
    ...item,
    value: Number(overviewData.value?.summary?.[item.key] || 0),
  }))
)

const statusColorMap = {
  new: 'bg-slate-500',
  in_progress: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
}

const statusData = computed(() => {
  const apiStatus = Array.isArray(overviewData.value?.status) ? overviewData.value.status : []
  return apiStatus.map((item) => ({
    ...item,
    value: Number(item?.value || 0),
    color: statusColorMap[item?.key] || 'bg-slate-400',
  }))
})

const topStores = computed(() => (Array.isArray(overviewData.value?.top_stores) ? overviewData.value.top_stores : []))

const displayedStores = computed(() => {
  if (showAllStores.value) return topStores.value
  return topStores.value.slice(0, 5)
})

const statusTotal = computed(() => statusData.value.reduce((sum, item) => sum + item.value, 0))

const statusWithPercent = computed(() =>
  statusData.value.map((item) => {
    const percent = statusTotal.value > 0 ? Math.round((item.value / statusTotal.value) * 100) : 0
    return { ...item, percent }
  })
)

const maxStoreCount = computed(() =>
  topStores.value.reduce((max, store) => (store.count > max ? store.count : max), 1)
)

const activityFeed = computed(() => (Array.isArray(overviewData.value?.activity_feed) ? overviewData.value.activity_feed : []))

const rangeLabel = computed(() => {
  const from = new Date(`${dateFrom.value}T00:00:00`)
  const to = new Date(`${dateTo.value}T00:00:00`)
  const format = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${format.format(from)} - ${format.format(to)}`
})

const handleOutsideClick = (event) => {
  if (!rangePickerOpen.value) return
  const root = rangePickerRef.value
  if (!root) return
  if (root.contains(event.target)) return
  rangePickerOpen.value = false
}

const setupRangePicker = async () => {
  await nextTick()

  const pickerElement = document.getElementById('dashboard-range-datepicker')
  if (!pickerElement) return
  if (!window.HSDatepicker) return

  if (rangePickerInstance?.destroy) {
    rangePickerInstance.destroy()
  }

  rangePickerInstance = new window.HSDatepicker(pickerElement, {
    type: 'default',
    inputMode: false,
    selectionDatesMode: 'multiple-ranged',
    selectedDates: [dateFrom.value, dateTo.value],
    dateFormat: 'DD/MM/YYYY',
    dateLocale: 'vi-VN',
  })
}

const openRangePicker = async () => {
  if (rangePickerOpen.value) {
    rangePickerOpen.value = false
    return
  }

  rangePickerOpen.value = true
  await setupRangePicker()
}

const cancelRangePicker = () => {
  rangePickerOpen.value = false
}

const applyRangePicker = async () => {
  const selectedDates = rangePickerInstance?.getCurrentState?.()?.selectedDates || []
  if (selectedDates.length < 2) return

  const sortedDates = [...selectedDates].sort()
  dateFrom.value = sortedDates[0]
  dateTo.value = sortedDates[sortedDates.length - 1]
  rangePickerOpen.value = false
  await fetchDashboardData()
}

async function fetchDashboardData() {
  dashboardLoading.value = true
  dashboardError.value = ''

  try {
    const result = await getDashboardOverview({
      date_from: dateFrom.value,
      date_to: dateTo.value,
      top_stores_limit: 20,
      activity_limit: 12,
    })
    const payload = result?.data || result || {}
    overviewData.value = {
      summary: payload?.summary || {},
      status: Array.isArray(payload?.status) ? payload.status : [],
      top_stores: Array.isArray(payload?.top_stores) ? payload.top_stores : [],
      activity_feed: Array.isArray(payload?.activity_feed) ? payload.activity_feed : [],
    }
  } catch (err) {
    dashboardError.value = err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu dashboard.'
    overviewData.value = {
      summary: {
        total_ticket: 0,
        in_progress: 0,
        resolved: 0,
        overdue: 0,
      },
      status: [],
      top_stores: [],
      activity_feed: [],
    }
  } finally {
    dashboardLoading.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleOutsideClick)
  await fetchDashboardData()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  if (rangePickerInstance?.destroy) {
    rangePickerInstance.destroy()
  }
})
</script>

<template>
  <div>
    <div class="header max-w-full flex items-center h-[52px] p-2.5 text-[18px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500">
      Tổng quan vận hành
    </div>

    <div class="max-w-full mx-4 py-4 space-y-4">
      <section class="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-slate-500">Khoảng thời gian</p>
            <p class="mt-0.5 text-xs font-semibold text-slate-700 truncate">{{ rangeLabel }}</p>
          </div>

          <div ref="rangePickerRef" class="relative inline-flex">
            <button
              type="button"
              class="cursor-pointer inline-flex items-center gap-x-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              @click="openRangePicker"
            >
              <span>Chọn ngày</span>
              <svg class="size-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div
              v-if="rangePickerOpen"
              class="absolute right-0 top-full mt-2 z-30 w-[20rem] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"
            >
              <div id="dashboard-range-datepicker" class="hs-datepicker"></div>

              <div class="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-gray-50"
                  @click="cancelRangePicker"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  @click="applyRangePicker"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-if="dashboardLoading" class="mt-1 text-xs text-blue-600">Đang tải dữ liệu dashboard...</p>
        <p v-if="dashboardError" class="mt-2 text-xs text-red-600">{{ dashboardError }}</p>
      </section>

      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <article
          v-for="card in summaryCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xs transition-transform duration-200 hover:-translate-y-0.5"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold" :class="card.tone">{{ card.value }}</p>
          <span class="mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold" :class="card.chip">{{ card.delta }}</span>
        </article>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <article class="xl:col-span-6 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-800">Tỷ trọng theo trạng thái</h2>
            <span class="text-xs text-slate-500">Tổng {{ statusTotal }} ticket</span>
          </div>

          <div class="mt-4 space-y-3">
            <div v-for="item in statusWithPercent" :key="item.label">
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
            <div v-for="store in displayedStores" :key="`${store.store_id}-${store.name}`" class="grid grid-cols-[1fr_auto] items-center gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-700">{{ store.name }}</p>
                <div class="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    :style="{ width: `${Math.round((store.count / maxStoreCount) * 100)}%` }"
                  ></div>
                </div>
              </div>
              <span class="text-xs font-semibold rounded-md bg-blue-50 text-blue-700 px-2 py-1">{{ store.count }}</span>
            </div>
            <p v-if="!displayedStores.length && !dashboardLoading" class="text-sm text-slate-500">Không có dữ liệu cửa hàng trong khoảng thời gian đã chọn.</p>
          </div>
        </article>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
        <h2 class="text-sm font-semibold text-slate-800">Hoạt động gần nhất</h2>
        <ul class="mt-3 divide-y divide-gray-100">
          <li v-for="item in activityFeed" :key="`${item.at}-${item.content}`" class="py-2.5 flex items-start gap-3">
            <span class="text-xs font-semibold text-blue-600 rounded-md bg-blue-50 px-2 py-1 shrink-0">{{ item.time }}</span>
            <p class="text-sm text-slate-700">{{ item.content }}</p>
          </li>
          <li v-if="!activityFeed.length && !dashboardLoading" class="py-2.5">
            <p class="text-sm text-slate-500">Chưa có hoạt động nào trong khoảng thời gian đã chọn.</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
