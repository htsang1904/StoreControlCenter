<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  createQcDraftSession,
  deleteQcDraftSession,
  getQcStoreOverviewApi,
  listQcDraftSessions,
  listQcTemplates,
  qcHelpers,
} from '@/services/qc_service'
import CreateQcDraftModal from '@/components/CreateQcDraftModal.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import StatSummaryCard from '@/components/StatSummaryCard.vue'

const route = useRoute()
const router = useRouter()
const { state } = useApp()

const loading = ref(false)
const searchInput = ref('')
const SEARCH_DEBOUNCE_MS = 300
let searchDebounce = null

const creatingDraft = ref(false)
const isDraftModalOpen = ref(false)
const draftSessions = ref([])
const draftModalError = ref('')
const draftLoadError = ref('')
const sessionLoadError = ref('')

const filters = reactive({
  q: '',
  status: '',
  from: '',
  to: '',
})

const summary = ref({
  totalSessions: 0,
  passed: 0,
  failed: 0,
  avgScore: 0,
  avgMaxScore: 0,
  avgScoreRate: 0,
  passRate: 0,
})
const sessions = ref([])
const expandedSessionId = ref(null)
const hasRows = computed(() => tableRows.value.length > 0)

const resultOptions = [
  { value: '', label: 'Tất cả kết quả' },
  { value: 'passed', label: 'Đạt' },
  { value: 'failed', label: 'Không đạt' },
]

const qcTemplateOptions = ref([])

const draftForm = reactive({
  templateId: '',
  auditedAt: '',
  note: '',
})

const reasonLabels = {
  incomplete: 'Còn tiêu chí chưa chấm',
  failed: 'Có tiêu chí không đạt',
  critical: 'Có lỗi critical',
  threshold: 'Chưa đạt ngưỡng % tổng điểm',
}

const selectedResultCount = computed(() => (filters.status ? 1 : 0))
const storeId = computed(() => Number(route.params.storeId || 0))

const selectedStore = computed(() => {
  const stores = Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []
  return stores.find((item) => Number(item?.id || 0) === storeId.value) || null
})

const storeTitle = computed(() => {
  const store = selectedStore.value
  if (!store) return `Cửa hàng #${storeId.value || '--'}`
  return store.shortAddress || store.address || store.code || `Cửa hàng #${store.id}`
})
const pageDescription = computed(() => {
  const store = selectedStore.value
  const storeCode = String(store?.code || '').trim()
  if (storeCode) {
    return `Theo dõi phiên QC, phiếu nháp và lịch sử kiểm tra của ${storeCode}.`
  }
  return 'Theo dõi phiên QC, phiếu nháp và lịch sử kiểm tra của cửa hàng này.'
})

const filteredSummary = computed(() => {
  const totalSessions = sessions.value.length
  const passed = sessions.value.filter((item) => item.result === 'passed').length
  const failed = sessions.value.filter((item) => item.result === 'failed').length
  const totalScore = sessions.value.reduce((sum, item) => sum + Number(item.totalScore || 0), 0)
  const totalMaxScore = sessions.value.reduce((sum, item) => sum + Number(item.maxScore || 0), 0)
  const criticalFailedSessions = sessions.value.filter((item) => Number(item.failedCriticalCount || 0) > 0).length

  return {
    totalSessions,
    passed,
    failed,
    criticalFailedSessions,
    avgScore: totalSessions > 0 ? Math.round((totalScore / totalSessions) * 10) / 10 : 0,
    avgMaxScore: totalSessions > 0 ? Math.round((totalMaxScore / totalSessions) * 10) / 10 : 0,
    avgScoreRate: totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 1000) / 10 : 0,
    passRate: totalSessions > 0 ? Math.round((passed / totalSessions) * 100) : 0,
  }
})

const summaryCards = computed(() => [
  {
    key: 'totalSessions',
    label: 'Phiên đang hiển thị',
    value: filteredSummary.value.totalSessions,
    meta: `Toàn bộ: ${summary.value.totalSessions}`,
    metaClass: 'bg-slate-100 text-slate-600',
    icon: 'fact_check',
    iconClass: 'bg-blue-100 text-blue-600',
  },
  {
    key: 'passRate',
    label: 'Tỷ lệ đạt',
    value: `${filteredSummary.value.passRate}%`,
    meta: `Toàn kỳ: ${summary.value.passRate}%`,
    metaClass: 'bg-emerald-50 text-emerald-700',
    icon: 'task_alt',
    iconClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    key: 'failed',
    label: 'Cần khắc phục',
    value: filteredSummary.value.failed,
    meta: `${filteredSummary.value.criticalFailedSessions} phiên critical`,
    metaClass: 'bg-rose-50 text-rose-700',
    icon: 'warning',
    iconClass: 'bg-rose-100 text-rose-600',
  },
  {
    key: 'avgScoreRate',
    label: 'Điểm TB',
    value: `${filteredSummary.value.avgScoreRate}%`,
    meta: `${filteredSummary.value.avgScore}/${filteredSummary.value.avgMaxScore} điểm`,
    metaClass: 'bg-amber-50 text-amber-700',
    icon: 'monitoring',
    iconClass: 'bg-amber-100 text-amber-600',
  },
])

const resultLabel = (result) => {
  if (result === 'draft') return 'Draft'
  if (result === 'pending') return 'Đang chấm'
  if (result === 'passed') return 'Đạt'
  return 'Không đạt'
}
const resultClass = (result) => (
  result === 'draft'
    ? 'bg-amber-100 text-amber-700'
    : result === 'pending'
      ? 'bg-blue-100 text-blue-700'
    : result === 'passed'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700'
)

const getTemplateLabel = (templateId) => {
  const matched = qcTemplateOptions.value.find((item) => item.id === templateId)
  if (!matched) return templateId || 'Chưa chọn biểu mẫu'
  if (matched.code) return `${matched.name} • ${matched.code}`
  return matched.name || matched.id
}

const criterionStatusLabel = (status) => {
  if (status === 'pass') return 'Đạt'
  if (status === 'fail') return 'Không đạt'
  if (status === 'na') return 'N/A'
  if (status === 'skipped_weekly') return 'Đã chấm tuần này'
  return 'Chưa chấm'
}

const criterionStatusClass = (status) => {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-700'
  if (status === 'fail') return 'bg-rose-100 text-rose-700'
  if (status === 'na') return 'bg-slate-200 text-slate-700'
  if (status === 'skipped_weekly') return 'bg-violet-100 text-violet-700'
  return 'bg-amber-100 text-amber-700'
}

const sessionReasons = (session) => {
  const reasons = Array.isArray(session?.decisionReasons) ? session.decisionReasons : []
  return reasons.map((item) => reasonLabels[item] || item)
}

const sessionFailedItems = (session) => {
  const criteria = Array.isArray(session?.criteria) ? session.criteria : []
  return criteria.filter((item) => String(item?.status || '').toLowerCase() === 'fail')
}

const sessionScoreRate = (session) => {
  if (session?.rowType === 'draft') return null
  const total = Number(session?.totalScore || 0)
  const max = Number(session?.maxScore || 0)
  if (max <= 0) return 0
  return Math.round((total / max) * 1000) / 10
}

const parseBoundaryTime = (value, mode) => {
  if (!value) return null
  const date = mode === 'to'
    ? new Date(`${value}T23:59:59.999`)
    : new Date(`${value}T00:00:00.000`)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

const draftTableRows = computed(() => {
  if (filters.status) return []

  const keyword = String(filters.q || '').trim().toLowerCase()
  const fromTime = parseBoundaryTime(filters.from, 'from')
  const toTime = parseBoundaryTime(filters.to, 'to')

  return draftSessions.value
    .filter((draft) => {
      const auditedSource = draft?.auditedAt || draft?.updatedAt || draft?.createdAt
      const auditedTime = auditedSource ? new Date(auditedSource).getTime() : null
      if (fromTime && (!auditedTime || auditedTime < fromTime)) return false
      if (toTime && (!auditedTime || auditedTime > toTime)) return false

      if (!keyword) return true
      const haystack = [
        draft?.id,
        draft?.note,
        draft?.templateId,
        getTemplateLabel(draft?.templateId),
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
    .map((draft) => ({
      rowType: 'draft',
      rowKey: `draft-${draft.id}`,
      id: draft.id,
      code: `DRAFT-${String(draft.id).slice(-6).toUpperCase()}`,
      templateName: getTemplateLabel(draft.templateId),
      templateVersion: 'Bản nháp',
      auditorName: '--',
      totalScore: null,
      maxScore: null,
      result: 'draft',
      note: draft.note || '',
      auditedAt: draft.auditedAt || draft.updatedAt || draft.createdAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      failedCriticalCount: 0,
      decisionReasons: [],
      criteria: [],
    }))
})

const sessionTableRows = computed(() => {
  return sessions.value.map((session) => ({
    ...session,
    rowType: 'session',
    rowKey: `session-${session.id}`,
  }))
})

const tableRows = computed(() => {
  return [...draftTableRows.value, ...sessionTableRows.value].sort((left, right) => {
    const leftTime = new Date(left.auditedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(right.auditedAt || right.createdAt || 0).getTime()
    return rightTime - leftTime
  })
})

const isDraftRow = (row) => row?.rowType === 'draft'

const handleRowAction = (row) => {
  if (isDraftRow(row)) {
    continueDraftSession(row.id)
    return
  }
  toggleSessionDetail(row.id)
}

function toLocalDateTimeInput(value) {
  const source = value ? new Date(value) : new Date()
  const date = Number.isNaN(source.getTime()) ? new Date() : source
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const applyFilters = async () => {
  if (!storeId.value) return

  loading.value = true
  sessionLoadError.value = ''
  try {
    const overview = await getQcStoreOverviewApi(storeId.value, {
      q: filters.q,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      pageSize: 200,
      fetchAll: true,
    })

    summary.value = overview.summary
    sessions.value = overview.sessions

    if (!sessions.value.some((item) => item.id === expandedSessionId.value)) {
      expandedSessionId.value = null
    }
  } catch (error) {
    sessions.value = []
    summary.value = {
      totalSessions: 0,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgMaxScore: 0,
      avgScoreRate: 0,
      passRate: 0,
    }
    sessionLoadError.value = error?.response?.data?.message || error?.message || 'Không tải được dữ liệu phiên QC.'
  } finally {
    loading.value = false
  }
}

const loadDraftSessions = async () => {
  draftLoadError.value = ''
  try {
    draftSessions.value = await listQcDraftSessions({
      storeId: storeId.value,
      page: 1,
      pageSize: 200,
      fetchAll: true,
    })
  } catch (error) {
    draftSessions.value = []
    draftLoadError.value = error?.response?.data?.message || error?.message || 'Không tải được danh sách phiếu nháp.'
  }
}

const openCreateDraftModal = () => {
  draftModalError.value = ''
  draftForm.templateId = qcTemplateOptions.value[0]?.id || ''
  draftForm.auditedAt = toLocalDateTimeInput()
  draftForm.note = ''
  isDraftModalOpen.value = true
}

const closeCreateDraftModal = () => {
  draftModalError.value = ''
  isDraftModalOpen.value = false
}

const continueDraftSession = (draftId) => {
  if (!draftId || !storeId.value) return
  router.push(`/QC/store/${storeId.value}/create?draftId=${encodeURIComponent(String(draftId))}`)
}

const createDraftAndOpen = async (payload = {}) => {
  if (!storeId.value) return
  creatingDraft.value = true
  draftModalError.value = ''
  try {
    const drafted = await createQcDraftSession({
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: payload.templateId,
      auditedAt: payload.auditedAt ? new Date(payload.auditedAt).toISOString() : new Date().toISOString(),
      note: payload.note,
    })

    isDraftModalOpen.value = false
    await loadDraftSessions()
    continueDraftSession(drafted.id)
  } catch (error) {
    draftModalError.value = error?.response?.data?.message || error?.message || 'Không thể tạo phiếu nháp.'
  } finally {
    creatingDraft.value = false
  }
}

const removeDraftSession = async (draftId) => {
  if (!draftId) return
  const confirmed = window.confirm('Xóa phiếu nháp này?')
  if (!confirmed) return
  try {
    await deleteQcDraftSession(draftId)
    await loadDraftSessions()
  } catch (error) {
    draftLoadError.value = error?.response?.data?.message || error?.message || 'Không xóa được phiếu nháp.'
  }
}

const toggleSessionDetail = (sessionId) => {
  expandedSessionId.value = expandedSessionId.value === sessionId ? null : sessionId
}

const isSessionExpanded = (sessionId) => expandedSessionId.value === sessionId

const loadTemplates = async () => {
  try {
    qcTemplateOptions.value = await listQcTemplates()
  } catch (error) {
    console.error('Failed to load QC templates', error)
  }
}

const loadStoreData = async () => {
  if (!storeId.value) return

  await Promise.all([applyFilters(), loadDraftSessions(), loadTemplates()])
}

const goBack = () => {
  router.push('/QC')
}

watch(searchInput, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }

  searchDebounce = setTimeout(() => {
    filters.q = String(value || '').trim()
    void applyFilters()
  }, SEARCH_DEBOUNCE_MS)
})

watch(
  () => route.params.storeId,
  async () => {
    await loadStoreData()
  }
)

onMounted(async () => {
  draftForm.auditedAt = toLocalDateTimeInput()
  await loadStoreData()
})

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }
})
</script>

<template>
  <div>
    <div class="page-stack space-y-4">
      <div class="flex min-w-0 items-start gap-3">
        <button
          @click="goBack"
          type="button"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Quay lại danh sách QC"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Chi tiết QC cửa hàng</p>
          <h1 class="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl" :title="storeTitle">{{ storeTitle }}</h1>
          <p class="mt-1 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
        </div>
      </div>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatSummaryCard
          v-for="card in summaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :meta-class="card.metaClass"
          :icon="card.icon"
          :icon-class="card.iconClass"
        />
      </section>

      <section class="flex flex-col space-y-4">
        <div class="flex flex-col rounded-xl border border-gray-200 bg-white shadow-2xs overflow-visible">
          <div class="relative z-10 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div class="overflow-x-auto pb-1">
              <div class="flex w-full min-w-max items-center gap-6">
                <div class="flex shrink-0 items-center gap-2">
                  <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                    <button
                      id="qc-status-filter"
                      type="button"
                      class="relative inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      aria-haspopup="menu"
                      aria-expanded="false"
                    >
                      Kết quả
                      <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                      </svg>
                      <span
                        v-if="selectedResultCount > 0"
                        class="absolute -right-1.5 -top-1.5 inline-flex min-w-5 justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                      >
                        {{ selectedResultCount }}
                      </span>
                    </button>
                    <div
                      class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-44 z-20 rounded-lg border border-slate-200 bg-white shadow-md mt-2"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="qc-status-filter"
                    >
                      <label
                        v-for="result in resultOptions"
                        :key="result.value || 'all'"
                        class="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          v-model="filters.status"
                          :value="result.value"
                          type="radio"
                          class="mt-0.5 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500"
                          @change="applyFilters"
                        >
                        <span>{{ result.label }}</span>
                      </label>
                    </div>
                  </div>

                  <div class="shrink-0">
                    <DateRangePicker
                      v-model:from="filters.from"
                      v-model:to="filters.to"
                      :disabled="loading"
                      placeholder="Thời gian"
                      @change="applyFilters"
                    />
                  </div>
                </div>

                <div class="ml-auto flex shrink-0 items-center gap-2">
                  <div class="relative w-[280px] shrink-0 sm:w-[300px]">
                    <input v-model="searchInput" type="text" class="block h-9 w-full rounded-lg border border-gray-200 px-3 ps-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Tìm mã phiếu, mẫu QC, ghi chú..." />
                    <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-3">
                      <svg class="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="inline-flex h-9 shrink-0 whitespace-nowrap items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-blue-700"
                    @click="openCreateDraftModal"
                  >
                    Tạo phiếu QC
                  </button>
                </div>
              </div>
            </div>

            <div v-if="draftLoadError || sessionLoadError" class="mt-3 space-y-1">
              <p v-if="draftLoadError" class="text-xs font-medium text-rose-600">{{ draftLoadError }}</p>
              <p v-if="sessionLoadError" class="text-xs font-medium text-rose-600">{{ sessionLoadError }}</p>
            </div>
          </div>

          <div v-loading="loading" class="overflow-hidden rounded-b-xl">
            <div class="max-w-full overflow-x-auto">
              <table class="min-w-[980px] w-full divide-y divide-gray-200">
                <thead class="bg-gray-50 uppercase text-xs font-semibold text-gray-700">
                  <tr>
                    <th class="px-4 py-2.5 text-start">Mã phiếu</th>
                    <th class="px-4 py-2.5 text-start">Biên bản</th>
                    <th class="px-4 py-2.5 text-start">Auditor</th>
                    <th class="px-4 py-2.5 text-end">Điểm</th>
                    <th class="px-4 py-2.5 text-start">Kết quả</th>
                    <th class="px-4 py-2.5 text-start">Ngày chấm</th>
                    <th class="px-4 py-2.5 text-end"></th>
                  </tr>
                </thead>
                <tbody v-if="hasRows" class="divide-y divide-gray-200">
                  <template v-for="session in tableRows" :key="session.rowKey">
                    <tr class="bg-white hover:bg-gray-50">
                      <td class="px-4 py-2 text-sm font-medium text-blue-600 underline cursor-pointer" @click="handleRowAction(session)">{{ session.code }}</td>
                      <td class="px-4 py-2 text-sm text-gray-700">
                        <p class="font-medium text-slate-700">{{ session.templateName || '--' }}</p>
                        <p class="text-xs text-slate-500">{{ session.templateVersion || '--' }}</p>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-700">{{ session.auditorName || '--' }}</td>
                      <td class="px-4 py-2 text-end">
                        <template v-if="isDraftRow(session)">
                          <p class="text-sm font-semibold text-slate-500">--</p>
                        </template>
                        <template v-else>
                          <p class="text-sm font-semibold text-gray-700">{{ session.totalScore }}/{{ session.maxScore }}</p>
                          <p class="text-xs text-slate-500">{{ sessionScoreRate(session) }}%</p>
                        </template>
                      </td>
                      <td class="px-4 py-2 text-sm">
                        <span class="inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                          {{ resultLabel(session.result) }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-600">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</td>
                      <td class="px-4 py-2 text-end flex gap-2 justify-end">
                        <button type="button" class="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100" @click="handleRowAction(session)">
                          {{ isDraftRow(session) ? 'Tiếp tục' : (isSessionExpanded(session.id) ? 'Thu gọn' : 'Chi tiết') }}
                        </button>
                        <button v-if="isDraftRow(session)" type="button" class="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100" @click="removeDraftSession(session.id)">
                          Xóa
                        </button>
                      </td>
                    </tr>
                    <tr v-if="!isDraftRow(session) && isSessionExpanded(session.id)" class="bg-slate-50/50">
                      <td colspan="7" class="px-4 py-3">
                        <!-- Details Content (reused from original) -->
                        <div class="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3">
                          <!-- Reasons & Note Content Same as Before -->
                          <div class="flex flex-wrap items-center gap-2">
                             <span v-for="reason in sessionReasons(session)" :key="`${session.id}-${reason}`" class="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">{{ reason }}</span>
                             <span v-if="sessionReasons(session).length === 0" class="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Trong sạch, không phát hiện lỗi quan trọng</span>
                          </div>
                          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú phiên</p>
                            <p class="mt-1 text-sm text-slate-700">{{ session.note || '--' }}</p>
                          </div>
                          <!-- Failed Items -->
                          <div v-if="sessionFailedItems(session).length > 0" class="space-y-2">
                            <p class="text-xs font-semibold uppercase text-slate-500">Tiêu chí không đạt ({{ sessionFailedItems(session).length }})</p>
                            <div class="grid gap-2 md:grid-cols-2">
                               <div v-for="item in sessionFailedItems(session)" :key="`${session.id}-${item.id}`" class="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                                  <div class="flex items-center gap-2 mb-1">
                                     <p class="text-sm font-semibold text-rose-800">{{ item.name }}</p>
                                     <span class="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase" :class="criterionStatusClass(item.status)">{{ criterionStatusLabel(item.status) }}</span>
                                  </div>
                                  <p class="text-xs text-rose-700">{{ item.note || '--' }}</p>
                               </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
                <tbody v-else>
                  <tr><td colspan="7" class="py-12 flex flex-col items-center justify-center text-slate-400 text-sm">Chưa có phiên dữ liệu nào.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

    </div>
    <CreateQcDraftModal
      v-model="isDraftModalOpen"
      :loading="creatingDraft"
      :error-message="draftModalError"
      :store-name="storeTitle"
      :template-options="qcTemplateOptions"
      :initial-template-id="draftForm.templateId"
      :initial-audited-at="draftForm.auditedAt"
      :initial-note="draftForm.note"
      @submit="createDraftAndOpen"
      @close="closeCreateDraftModal"
    />
  </div>
</template>
