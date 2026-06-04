<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DateRangePicker from '@/components/DateRangePicker.vue'
import {
  DEFAULT_RECENT_RANGE_DAYS,
  getDefaultDateRange,
  getThisMonthDateRange,
  getTodayDateRange,
  isValidYmd,
  normalizeDateRangeFromQuery,
} from '@/composables/useDateRange'

const route = useRoute()
const router = useRouter()

const headerDateFrom = ref('')
const headerDateTo = ref('')

const todayRange = computed(() => getTodayDateRange())
const last7Range = computed(() => getDefaultDateRange(DEFAULT_RECENT_RANGE_DAYS))
const thisMonthRange = computed(() => getThisMonthDateRange())

function syncRangeFromRoute() {
  const range = normalizeDateRangeFromQuery(route.query || {})
  headerDateFrom.value = range.from
  headerDateTo.value = range.to
}

async function updateHeaderRange(from, to) {
  if (!isValidYmd(from) || !isValidYmd(to) || from > to) return
  if (String(route.query?.date_from || '') === from && String(route.query?.date_to || '') === to) return

  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      date_from: from,
      date_to: to,
    },
  })
}

function isActiveRange(range) {
  return headerDateFrom.value === range.from && headerDateTo.value === range.to
}

function applyQuickRange(range) {
  headerDateFrom.value = range.from
  headerDateTo.value = range.to
  void updateHeaderRange(range.from, range.to)
}

function handleDateRangeChange(payload) {
  const from = String(payload?.from || '')
  const to = String(payload?.to || '')
  void updateHeaderRange(from, to)
}

watch(
  () => [route.path, route.query.date_from, route.query.date_to],
  () => {
    syncRangeFromRoute()
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex items-center gap-2 tablet:gap-3">
    <div class="hidden items-center rounded-lg bg-[var(--primary-softer)] p-1 pc:inline-flex">
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="isActiveRange(todayRange) ? 'border border-[var(--stroke)] bg-white text-[var(--text-primary)]' : 'border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
        @click="applyQuickRange(todayRange)"
      >
        Hôm nay
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="isActiveRange(last7Range) ? 'border border-[var(--stroke)] bg-white text-[var(--text-primary)]' : 'border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
        @click="applyQuickRange(last7Range)"
      >
        7 ngày qua
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="isActiveRange(thisMonthRange) ? 'border border-[var(--stroke)] bg-white text-[var(--text-primary)]' : 'border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
        @click="applyQuickRange(thisMonthRange)"
      >
        Tháng này
      </button>
    </div>

    <div class="hidden tablet:block">
      <DateRangePicker
        v-model:from="headerDateFrom"
        v-model:to="headerDateTo"
        @change="handleDateRangeChange"
      />
    </div>

    <div class="hidden h-6 w-px bg-[var(--primary-soft)] pc:block"></div>
  </div>
</template>
