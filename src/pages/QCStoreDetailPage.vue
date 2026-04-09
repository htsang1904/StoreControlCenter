<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  createQcDraftSession,
  deleteQcDraftSession,
  deleteQcSession,
  getQcSessionApi,
  getQcStoreOverviewApi,
  listQcDraftSessions,
  listQcTemplates,
  qcHelpers,
} from '@/services/qc_service'
import CreateQcDraftModal from '@/components/CreateQcDraftModal.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import StatSummaryCard from '@/components/StatSummaryCard.vue'
import CommonModal from '@/components/CommonModal.vue'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()

const loading = ref(false)
const searchInput = ref('')
const SEARCH_DEBOUNCE_MS = 300
let searchDebounce = null

const creatingDraft = ref(false)
const isDraftModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isDeleteSessionModalOpen = ref(false)
const deletingDraftId = ref(null)
const deletingSessionId = ref(null)
const deletingDraft = ref(false)
const deletingSession = ref(false)
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
const selectedSessionForModal = ref(null)
const isSessionDetailModalOpen = ref(false)
const loadingSessionDetail = ref(false)
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

  return {
    totalSessions,
    passed,
    failed,
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
    meta: `Toàn kỳ ${summary.value.totalSessions}`,
    icon: 'fact_check',
    tone: 'sky',
  },
  {
    key: 'passRate',
    label: 'Tỷ lệ đạt',
    value: `${filteredSummary.value.passRate}%`,
    meta: `Toàn kỳ ${summary.value.passRate}%`,
    icon: 'task_alt',
    tone: 'emerald',
  },
  {
    key: 'failed',
    label: 'Cần khắc phục',
    value: `${filteredSummary.value.failed}`,
    meta: `Toàn kỳ ${summary.value.failed}`,
    icon: 'warning',
    tone: 'rose',
  },
  {
    key: 'avgScoreRate',
    label: 'Điểm TB',
    value: `${filteredSummary.value.avgScoreRate}%`,
    meta: `${filteredSummary.value.avgScore}/${filteredSummary.value.avgMaxScore} điểm`,
    icon: 'monitoring',
    tone: 'amber',
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
    ? 'app-badge--warning'
    : result === 'pending'
      ? 'app-badge--neutral'
    : result === 'passed'
      ? 'app-badge--success'
      : 'app-badge--danger'
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
  if (status === 'pass') return 'app-badge--success'
  if (status === 'fail') return 'app-badge--danger'
  if (status === 'na') return 'app-badge--neutral'
  if (status === 'skipped_weekly') return 'app-badge--info'
  return 'app-badge--warning'
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

const viewSessionDetailModal = async (session) => {
  selectedSessionForModal.value = session
  isSessionDetailModalOpen.value = true
  
  if (session && !isDraftRow(session)) {
    loadingSessionDetail.value = true
    try {
      const fullSession = await getQcSessionApi(session.id)
      if (fullSession && selectedSessionForModal.value?.id === session.id) {
        selectedSessionForModal.value = fullSession
      }
    } catch (error) {
      toast.error('Không tải được tiêu chí của phiên này.')
    } finally {
      loadingSessionDetail.value = false
    }
  }
}

const closeSessionDetailModal = () => {
  isSessionDetailModalOpen.value = false
  selectedSessionForModal.value = null
}

const handleRowAction = (row) => {
  if (isDraftRow(row)) {
    continueDraftSession(row.id)
    return
  }
  viewSessionDetailModal(row)
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
      pageSize: 100,
      fetchAll: true,
    })

    summary.value = overview.summary
    sessions.value = overview.sessions
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

const confirmRemoveDraftSession = (draftId) => {
  if (!draftId) return
  deletingDraftId.value = draftId
  isDeleteModalOpen.value = true
}

const executeRemoveDraftSession = async () => {
  if (!deletingDraftId.value) return
  deletingDraft.value = true
  try {
    await deleteQcDraftSession(deletingDraftId.value)
    toast.success('Xóa phiếu nháp thành công')
    isDeleteModalOpen.value = false
    await loadDraftSessions()
  } catch (error) {
    toast.error(error?.response?.data?.message || error?.message || 'Không xóa được phiếu nháp.')
  } finally {
    deletingDraft.value = false
    deletingDraftId.value = null
  }
}

const cancelRemoveDraftSession = () => {
  if (deletingDraft.value) return
  isDeleteModalOpen.value = false
  deletingDraftId.value = null
}

const confirmRemoveSession = (sessionId) => {
  if (!sessionId) return
  deletingSessionId.value = sessionId
  isDeleteSessionModalOpen.value = true
}

const executeRemoveSession = async () => {
  if (!deletingSessionId.value) return
  deletingSession.value = true
  try {
    await deleteQcSession(deletingSessionId.value)
    toast.success('Xóa phiên QC thành công')
    isDeleteSessionModalOpen.value = false
    await loadStoreData()
  } catch (error) {
    toast.error(error?.response?.data?.message || error?.message || 'Không xóa được phiên QC này.')
  } finally {
    deletingSession.value = false
    deletingSessionId.value = null
  }
}

const cancelRemoveSession = () => {
  if (deletingSession.value) return
  isDeleteSessionModalOpen.value = false
  deletingSessionId.value = null
}

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
  <div class="p-4 tablet:p-5 pc:p-6">
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
          <h1 class="mt-1 truncate text-lg font-semibold text-slate-900 tablet:text-xl" :title="storeTitle">{{ storeTitle }}</h1>
          <p class="mt-1 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
        </div>
      </div>

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

      <section class="flex flex-col space-y-4">
        <div class="flex flex-col overflow-visible rounded-xl border border-gray-200 bg-white">
          <div class="relative z-10 border-b border-gray-200 px-4 py-4 tablet:px-6">
            <div class="flex flex-col gap-3 pc:flex-row pc:items-center">
              <div class="flex flex-col gap-2 tablet:flex-row tablet:flex-wrap tablet:items-center">
                <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                  <button
                    id="qc-status-filter"
                    type="button"
                    class="relative inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 tablet:w-auto"
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    Kết quả
                    <svg class="size-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                    </svg>
                    <span
                      v-if="selectedResultCount > 0"
                      class="absolute -right-1.5 -top-1.5 inline-flex min-w-5 justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    >
                      {{ selectedResultCount }}
                    </span>
                  </button>
                  <div
                    class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-44 z-20 mt-2 rounded-lg border border-slate-200 bg-white"
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
                        class="mt-0.5 shrink-0 border-slate-300 text-slate-900 focus:ring-slate-300"
                        @change="applyFilters"
                      >
                      <span>{{ result.label }}</span>
                    </label>
                  </div>
                </div>

                <DateRangePicker
                  v-model:from="filters.from"
                  v-model:to="filters.to"
                  :disabled="loading"
                  placeholder="Thời gian"
                  @change="applyFilters"
                />
              </div>

              <div class="flex flex-col gap-2 tablet:flex-row tablet:items-center pc:ml-auto">
                <div class="relative w-full tablet:flex-1 pc:w-[300px] pc:flex-none">
                  <input v-model="searchInput" type="text" class="block h-9 w-full rounded-lg border border-gray-200 px-3 ps-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:ring-0" placeholder="Tìm mã phiếu, mẫu QC, ghi chú..." />
                  <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-3">
                    <svg class="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                  </div>
                </div>

                <button
                  type="button"
                  class="inline-flex h-9 w-full shrink-0 whitespace-nowrap items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 tablet:w-auto"
                  @click="openCreateDraftModal"
                >
                  Tạo phiếu QC
                </button>
              </div>
            </div>

            <div v-if="draftLoadError || sessionLoadError" class="mt-3 space-y-2">
              <p v-if="draftLoadError" class="app-state-banner text-xs font-medium">{{ draftLoadError }}</p>
              <p v-if="sessionLoadError" class="app-state-banner text-xs font-medium">{{ sessionLoadError }}</p>
            </div>
          </div>

          <div v-loading="loading" class="overflow-hidden rounded-b-xl">
            <div class="pc:hidden">
              <div v-if="hasRows" class="divide-y divide-slate-100">
                <article
                  v-for="session in tableRows"
                  :key="session.rowKey"
                  class="bg-white px-4 py-4 tablet:px-6"
                >
                  <div class="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
                    <div class="min-w-0 flex-1">
                      <button
                        type="button"
                        class="block text-left"
                        @click="handleRowAction(session)"
                      >
                        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-600">{{ session.code }}</p>
                        <p class="mt-1 text-sm font-semibold text-slate-900">{{ session.templateName || '--' }}</p>
                      </button>
                      <p class="mt-1 text-xs text-slate-500">{{ session.templateVersion || '--' }}</p>
                    </div>

                    <span class="app-badge inline-flex w-fit items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                      {{ resultLabel(session.result) }}
                    </span>
                  </div>

                  <div class="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Auditor</p>
                      <p class="mt-1 text-sm font-medium text-slate-700">{{ session.auditorName || '--' }}</p>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ngày chấm</p>
                      <p class="mt-1 text-sm font-medium text-slate-700">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</p>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Điểm</p>
                      <template v-if="isDraftRow(session)">
                        <p class="mt-1 text-sm font-semibold text-slate-500">--</p>
                      </template>
                      <template v-else>
                        <p class="mt-1 text-sm font-semibold text-slate-900">{{ session.totalScore }}/{{ session.maxScore }}</p>
                        <p class="mt-1 text-xs text-slate-500">{{ sessionScoreRate(session) }}%</p>
                      </template>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ghi chú</p>
                      <p class="mt-1 text-sm text-slate-700">{{ session.note || '--' }}</p>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-col gap-2 tablet:flex-row">
                    <button type="button" class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 tablet:flex-1" @click="handleRowAction(session)">
                      {{ isDraftRow(session) ? 'Tiếp tục' : 'Chi tiết' }}
                    </button>
                    <button v-if="isDraftRow(session)" type="button" class="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 tablet:flex-1" @click="confirmRemoveDraftSession(session.id)">
                      Xóa nháp
                    </button>
                    <button v-else type="button" class="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 tablet:flex-1" @click="confirmRemoveSession(session.id)">
                      Xóa phiên lỗi
                    </button>
                  </div>
                </article>
              </div>

              <div v-else class="px-4 py-12 tablet:px-6">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">fact_check</span>
                    </div>
                    <p class="app-state-title">Chưa có phiên dữ liệu nào.</p>
                    <p class="app-state-body">Tạo phiếu QC mới để bắt đầu theo dõi lịch sử chấm điểm của cửa hàng này.</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden max-w-full overflow-x-auto pc:block">
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
                      <td class="cursor-pointer px-4 py-2 text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline" @click="handleRowAction(session)">{{ session.code }}</td>
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
                        <span class="app-badge inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                          {{ resultLabel(session.result) }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-sm text-gray-600">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</td>
                      <td class="px-4 py-2 text-end flex gap-2 justify-end">
                        <button type="button" class="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50" @click="handleRowAction(session)">
                          {{ isDraftRow(session) ? 'Tiếp tục' : 'Chi tiết' }}
                        </button>
                        <button v-if="isDraftRow(session)" type="button" class="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100" @click="confirmRemoveDraftSession(session.id)">
                          Xóa
                        </button>
                        <button v-else type="button" class="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100" @click="confirmRemoveSession(session.id)">
                          Xóa
                        </button>
                      </td>
                    </tr>
                  </template>
                </tbody>
                <tbody v-else>
                  <tr>
                    <td colspan="7" class="px-4 py-12">
                      <div class="app-state-panel app-state-panel--compact">
                        <div class="app-state-stack mx-auto">
                          <div class="app-state-icon mx-auto">
                            <span class="material-symbols-outlined text-[24px]">fact_check</span>
                          </div>
                          <p class="app-state-title">Chưa có phiên dữ liệu nào.</p>
                          <p class="app-state-body">Tạo phiếu QC mới để bắt đầu theo dõi lịch sử chấm điểm của cửa hàng này.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
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

    <CommonModal
      v-model="isDeleteModalOpen"
      max-width-class="max-w-[360px]"
      :close-disabled="deletingDraft"
      :show-close="false"
      @close="cancelRemoveDraftSession"
    >
      <div class="flex flex-col items-center pt-6 pb-2 text-center focus:outline-none">
        <div class="mb-5 flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
          <span class="material-symbols-outlined text-[28px]">delete</span>
        </div>
        <h3 class="text-lg font-bold text-slate-900 tracking-tight">Xóa phiếu nháp?</h3>
        <p class="mt-2 text-[14px] font-medium text-slate-500 leading-relaxed px-2">
          Dữ liệu đã chấm sẽ bị mất hoàn toàn và chức năng này <span class="text-rose-600 font-semibold underline decoration-rose-200 underline-offset-2">không thể khôi phục</span>.
        </p>

        <div class="mt-8 flex items-center gap-3 w-full">
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-[15px] font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
            :disabled="deletingDraft"
            @click="cancelRemoveDraftSession"
          >
            Giữ lại
          </button>
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-[15px] font-bold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 shadow-sm shadow-rose-200"
            :disabled="deletingDraft"
            @click="executeRemoveDraftSession"
          >
            <span v-if="deletingDraft" class="inline-block size-4 animate-spin rounded-full border-2 border-rose-200 border-t-white"></span>
            <span v-else>Xóa vĩnh viễn</span>
          </button>
        </div>
      </div>
    </CommonModal>

    <CommonModal
      v-model="isDeleteSessionModalOpen"
      max-width-class="max-w-[360px]"
      :close-disabled="deletingSession"
      :show-close="false"
      @close="cancelRemoveSession"
    >
      <div class="flex flex-col items-center pt-6 pb-2 text-center focus:outline-none">
        <div class="mb-5 flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
          <span class="material-symbols-outlined text-[28px]">delete_forever</span>
        </div>
        <h3 class="text-lg font-bold text-slate-900 tracking-tight">Xóa phiên QC đã chốt?</h3>
        <p class="mt-2 text-[14px] font-medium text-slate-500 leading-relaxed px-2">
          Hành động này sẽ xóa hoàn toàn kết quả chấm QC cùng với hình ảnh đính kèm và không thể khôi phục.
        </p>

        <div class="mt-8 flex items-center gap-3 w-full">
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-[15px] font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
            :disabled="deletingSession"
            @click="cancelRemoveSession"
          >
            Giữ lại
          </button>
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-[15px] font-bold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 shadow-sm shadow-rose-200"
            :disabled="deletingSession"
            @click="executeRemoveSession"
          >
            <span v-if="deletingSession" class="inline-block size-4 animate-spin rounded-full border-2 border-rose-200 border-t-white"></span>
            <span v-else>Xóa vĩnh viễn</span>
          </button>
        </div>
      </div>
    </CommonModal>

    <!-- Session Details Modal -->
    <CommonModal
      v-model="isSessionDetailModalOpen"
      max-width-class="max-w-[760px]"
      :show-close="false"
      @close="closeSessionDetailModal"
    >
      <div v-if="selectedSessionForModal" class="flex flex-col focus:outline-none">
        <div class="border-b border-slate-200 px-4 py-4 tablet:px-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-bold text-slate-900 tracking-tight">Chi tiết phiên QC - {{ selectedSessionForModal.code }}</h3>
              <p class="mt-1 text-sm text-slate-500 font-medium">Mẫu: {{ selectedSessionForModal.templateName }} • Auditor: {{ selectedSessionForModal.auditorName }}</p>
            </div>
            <button
              class="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none"
              @click="closeSessionDetailModal"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        
        <div class="max-h-[65vh] overflow-y-auto bg-slate-50/50 p-4 tablet:p-6">
          <div class="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="grid grid-cols-2 gap-4 tablet:grid-cols-4">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Điểm số</p>
                <p class="mt-1 font-semibold text-slate-900">{{ selectedSessionForModal.totalScore }} / {{ selectedSessionForModal.maxScore }}</p>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tỷ lệ</p>
                <p class="mt-1 font-semibold text-slate-900">{{ sessionScoreRate(selectedSessionForModal) }}%</p>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Kết quả</p>
                <span class="mt-1 app-badge inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold" :class="resultClass(selectedSessionForModal.result)">
                  {{ resultLabel(selectedSessionForModal.result) }}
                </span>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ghi chú</p>
                <p class="mt-1 text-sm text-slate-700 truncate" :title="selectedSessionForModal.note">{{ selectedSessionForModal.note || '--' }}</p>
              </div>
            </div>
            
            <div class="mt-4 flex flex-wrap gap-2">
               <span v-for="reason in sessionReasons(selectedSessionForModal)" :key="reason" class="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 border border-rose-200">{{ reason }}</span>
               <span v-if="sessionReasons(selectedSessionForModal).length === 0" class="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-200">Không phát hiện lỗi quan trọng</span>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div v-if="loadingSessionDetail" class="flex flex-col items-center justify-center py-10">
              <span class="mb-3 inline-block size-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800"></span>
              <p class="text-sm text-slate-500 font-medium">Đang tải biểu mẫu chi tiết...</p>
            </div>
            <table v-else class="w-full text-left">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tiêu chí</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hidden tablet:table-cell">Danh mục</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-center">Điểm</th>
                  <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 text-right">Tình trạng</th>
                </tr>
              </thead>
              <tbody v-if="selectedSessionForModal.criteria && selectedSessionForModal.criteria.length > 0" class="divide-y divide-slate-100">
                <tr v-for="criterion in selectedSessionForModal.criteria" :key="criterion.id" class="transition-colors hover:bg-slate-50/50">
                  <td class="px-4 py-3">
                    <p class="text-sm font-semibold text-slate-900">{{ criterion.name }}</p>
                    <p class="mt-1 text-xs text-slate-500 tablet:hidden">{{ criterion.category }}</p>
                    <p v-if="criterion.note" class="mt-1.5 text-xs text-slate-600 bg-slate-100 p-2 rounded-lg border border-slate-200">{{ criterion.note }}</p>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-700 hidden tablet:table-cell align-top">{{ criterion.category }}</td>
                  <td class="px-4 py-3 text-sm font-medium text-slate-700 text-center align-top whitespace-nowrap">
                    <template v-if="criterion.status === 'na' || criterion.status === 'skipped_weekly'">
                      <span class="text-slate-400">--</span>
                    </template>
                    <template v-else-if="criterion.mode === 'pass_fail'">
                       {{ criterion.status === 'pass' ? '1' : '0' }} / 1
                    </template>
                    <template v-else>
                      {{ criterion.score ?? '--' }} / {{ criterion.maxScore }}
                    </template>
                  </td>
                  <td class="px-4 py-3 text-right align-top whitespace-nowrap">
                    <span class="app-badge inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide" :class="criterionStatusClass(criterion.status)">
                      {{ criterionStatusLabel(criterion.status) }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr>
                  <td colspan="4" class="px-4 py-8 text-center">
                    <p class="text-sm text-slate-500">Bảng tiêu chí trống.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="border-t border-slate-200 px-4 py-4 tablet:px-6 flex justify-end bg-white rounded-b-xl">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800" @click="closeSessionDetailModal">
            Đóng
          </button>
        </div>
      </div>
    </CommonModal>
  </div>
</template>
