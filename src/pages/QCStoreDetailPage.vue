<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { QC_TEMPLATE_OPTIONS } from '@/constants/qc_templates'
import {
  createQcDraftSession,
  deleteQcDraftSession,
  getQcStoreOverviewApi,
  listQcDraftSessions,
  qcHelpers,
} from '@/services/qc_service'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ReportPeriodDropdown from '@/components/ReportPeriodDropdown.vue'

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

const qcTemplateOptions = QC_TEMPLATE_OPTIONS

const draftForm = reactive({
  templateId: qcTemplateOptions[0].id,
  auditedAt: '',
  note: '',
})

const reasonLabels = {
  incomplete: 'Còn tiêu chí chưa chấm',
  failed: 'Có tiêu chí không đạt',
  critical: 'Có lỗi critical',
  threshold: 'Chưa đạt ngưỡng điểm',
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
    tone: 'text-blue-600',
    hint: `Tổng kỳ đã chọn: ${summary.value.totalSessions}`,
  },
  {
    key: 'passRate',
    label: 'Tỷ lệ đạt',
    value: `${filteredSummary.value.passRate}%`,
    tone: 'text-emerald-600',
    hint: `Toàn kỳ: ${summary.value.passRate}%`,
  },
  {
    key: 'failed',
    label: 'Cần khắc phục',
    value: filteredSummary.value.failed,
    tone: 'text-rose-600',
    hint: `${filteredSummary.value.criticalFailedSessions} phiên có lỗi critical`,
  },
  {
    key: 'avgScoreRate',
    label: 'Điểm TB',
    value: `${filteredSummary.value.avgScoreRate}%`,
    tone: 'text-amber-600',
    hint: `${filteredSummary.value.avgScore}/${filteredSummary.value.avgMaxScore} điểm`,
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
  const matched = qcTemplateOptions.find((item) => item.id === templateId)
  if (!matched) return templateId || 'Chưa chọn biểu mẫu'
  return `${matched.name} (${matched.version})`
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

function toIsoDate(date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return normalized.toISOString().slice(0, 10)
}

function toLocalDateTimeInput(value) {
  const source = value ? new Date(value) : new Date()
  const date = Number.isNaN(source.getTime()) ? new Date() : source
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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

  return { from: filters.from, to: filters.to }
}

function isPresetActive(key) {
  const preset = getPresetRange(key)
  return preset.from === filters.from && preset.to === filters.to
}

const activePresetKey = computed(() => {
  const keys = ['today', 'yesterday', 'this_month', 'last_month']
  return keys.find((key) => isPresetActive(key)) || ''
})

function applyPreset(key) {
  const preset = getPresetRange(key)
  filters.from = preset.from
  filters.to = preset.to
  void applyFilters()
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
  draftForm.templateId = qcTemplateOptions[0].id
  draftForm.auditedAt = toLocalDateTimeInput()
  draftForm.note = ''
  isDraftModalOpen.value = true
}

const closeCreateDraftModal = () => {
  if (creatingDraft.value) return
  draftModalError.value = ''
  isDraftModalOpen.value = false
}

const continueDraftSession = (draftId) => {
  if (!draftId || !storeId.value) return
  router.push(`/QC/store/${storeId.value}/create?draftId=${encodeURIComponent(String(draftId))}`)
}

const createDraftAndOpen = async () => {
  if (!storeId.value) return
  creatingDraft.value = true
  draftModalError.value = ''
  try {
    const drafted = await createQcDraftSession({
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: draftForm.templateId,
      auditedAt: draftForm.auditedAt ? new Date(draftForm.auditedAt).toISOString() : new Date().toISOString(),
      note: draftForm.note,
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

const loadStoreData = async () => {
  if (!storeId.value) return

  await Promise.all([applyFilters(), loadDraftSessions()])
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
    <div class="header max-w-full p-2.5 text-[18px] font-bold text-white mx-4 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500 flex items-center">
      <button @click="goBack" type="button" class="cursor-pointer p-1 mr-2 inline-flex items-center rounded-lg bg-white/40 text-white shadow-2xs hover:bg-white/30 focus:outline-hidden focus:bg-white/30">
        <svg class="shrink-0 size-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      Lịch sử QC theo cửa hàng
    </div>

    <div class="page-stack mx-4">
      <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0 lg:flex-1">
            <p class="text-xs text-slate-500">Đang xem cửa hàng</p>
            <h2 class="text-base font-semibold text-slate-800 truncate" :title="storeTitle">{{ storeTitle }}</h2>
            <p class="text-xs text-slate-500">Store ID: {{ selectedStore?.id || storeId || '--' }}</p>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[28rem] lg:shrink-0">
            <div class="w-full sm:flex-1 lg:min-w-72">
              <DateRangePicker
                v-model:from="filters.from"
                v-model:to="filters.to"
                :disabled="loading"
                @change="applyFilters"
              />
            </div>
            <ReportPeriodDropdown :active-key="activePresetKey" :disabled="loading" @select="applyPreset" />
          </div>
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

      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">Phiếu QC nháp</h3>
            <p class="text-xs text-slate-500">Khởi tạo trước, chỉnh sửa sau. Dữ liệu nháp sẽ được giữ lại để tiếp tục.</p>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            @click="openCreateDraftModal"
          >
            Tạo phiếu nháp
          </button>
        </div>

        <p class="mt-2 text-xs text-slate-500">Phiếu nháp sẽ hiển thị trực tiếp trong bảng bên dưới với trạng thái <strong>Draft</strong>.</p>
        <p v-if="draftLoadError" class="mt-1 text-xs font-medium text-rose-600">{{ draftLoadError }}</p>
      </section>

      <div class="flex flex-col">
        <div class="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden dark:bg-neutral-900 dark:border-neutral-700">
          <div class="px-4 sm:px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200 dark:border-neutral-700">
            <div class="w-full md:w-auto">
              <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                <button
                  id="qc-status-filter"
                  type="button"
                  class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-blue-600 bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-2xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-300"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  Kết quả
                  <svg class="shrink-0 size-3.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                  <span
                    v-if="selectedResultCount > 0"
                    class="absolute top-0 end-0 inline-flex items-center py-0.5 px-1.5 rounded-full text-xs font-medium -translate-y-1/2 translate-x-1/2 border border-white bg-blue-600 text-white"
                  >
                    {{ selectedResultCount }}
                  </span>
                </button>

                <div
                  class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden divide-y divide-gray-200 min-w-44 z-20 bg-white shadow-md rounded-lg mt-2"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="qc-status-filter"
                >
                  <div class="divide-y divide-gray-200">
                    <label
                      v-for="result in resultOptions"
                      :key="result.value || 'all'"
                      class="flex items-center py-2.5 px-3 cursor-pointer"
                    >
                      <input
                        v-model="filters.status"
                        :value="result.value"
                        type="radio"
                        class="shrink-0 mt-0.5 border-gray-300 text-blue-600 focus:ring-blue-500"
                        @change="applyFilters"
                      >
                      <span class="ms-3 text-sm text-gray-800">{{ result.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto md:justify-end">
              <div class="relative w-full md:w-[300px]">
                <input
                  v-model="searchInput"
                  type="text"
                  class="py-2 px-3 ps-11 block w-full border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Tìm mã phiếu, mẫu QC, ghi chú..."
                />
                <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                  <svg class="size-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </div>
              </div>
              <button
                type="button"
                class="cursor-pointer py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-blue-600 bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-2xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-300 whitespace-nowrap shrink-0"
                @click="openCreateDraftModal"
              >
                Tạo phiếu nháp
              </button>
            </div>
          </div>

          <p v-if="sessionLoadError" class="px-4 sm:px-6 py-2 text-xs font-medium text-rose-600 border-b border-gray-200">
            {{ sessionLoadError }}
          </p>

          <div v-loading="loading">
            <div class="hidden lg:block max-w-full overflow-x-auto">
              <table class="min-w-[980px] w-full divide-y divide-gray-200 dark:divide-neutral-700">
                <thead class="bg-gray-50 dark:bg-neutral-800">
                  <tr>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Mã phiếu</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Biên bản</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Auditor</th>
                    <th class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700">Điểm</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Kết quả</th>
                    <th class="px-3 sm:px-4 py-2.5 text-start text-xs font-semibold uppercase text-gray-700">Ngày chấm</th>
                    <th class="px-3 sm:px-4 py-2.5 text-end text-xs font-semibold uppercase text-gray-700"></th>
                  </tr>
                </thead>

                <tbody v-if="hasRows" class="divide-y divide-gray-200 dark:divide-neutral-700">
                  <template v-for="session in tableRows" :key="session.rowKey">
                    <tr class="bg-white hover:bg-gray-50">
                      <td class="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600">{{ session.code }}</td>
                      <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">
                        <p class="font-medium text-slate-700">{{ session.templateName || '--' }}</p>
                        <p class="text-xs text-slate-500">{{ session.templateVersion || '--' }}</p>
                      </td>
                      <td class="px-3 sm:px-4 py-2 text-sm text-gray-700">{{ session.auditorName || '--' }}</td>
                      <td class="px-3 sm:px-4 py-2 text-end">
                        <template v-if="isDraftRow(session)">
                          <p class="text-sm font-semibold text-slate-500">--</p>
                          <p class="text-xs text-slate-400">Chưa chấm</p>
                        </template>
                        <template v-else>
                          <p class="text-sm font-semibold text-gray-700">{{ session.totalScore }}/{{ session.maxScore }}</p>
                          <p class="text-xs text-slate-500">{{ sessionScoreRate(session) }}%</p>
                        </template>
                      </td>
                      <td class="px-3 sm:px-4 py-2">
                        <span class="inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                          {{ resultLabel(session.result) }}
                        </span>
                      </td>
                      <td class="px-3 sm:px-4 py-2 text-sm text-gray-600">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</td>
                      <td class="px-3 sm:px-4 py-2 text-end">
                        <button
                          type="button"
                          class="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          @click="handleRowAction(session)"
                        >
                          {{ isDraftRow(session) ? 'Tiếp tục' : (isSessionExpanded(session.id) ? 'Thu gọn' : 'Chi tiết') }}
                        </button>
                        <button
                          v-if="isDraftRow(session)"
                          type="button"
                          class="ml-1 cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          @click="removeDraftSession(session.id)"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>

                    <tr v-if="!isDraftRow(session) && isSessionExpanded(session.id)" class="bg-slate-50/80">
                      <td colspan="7" class="px-4 py-3">
                        <div class="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3">
                          <div class="flex flex-wrap items-center gap-2">
                            <span
                              v-for="reason in sessionReasons(session)"
                              :key="`${session.id}-${reason}`"
                              class="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                            >
                              {{ reason }}
                            </span>
                            <span
                              v-if="sessionReasons(session).length === 0"
                              class="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                            >
                              Không có lỗi cần theo dõi
                            </span>
                          </div>

                          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú phiên</p>
                            <p class="mt-1 text-sm text-slate-700">{{ session.note || '--' }}</p>
                          </div>

                          <div v-if="sessionFailedItems(session).length > 0" class="space-y-2">
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Tiêu chí không đạt ({{ sessionFailedItems(session).length }})
                            </p>
                            <div class="grid gap-2 md:grid-cols-2">
                              <div
                                v-for="item in sessionFailedItems(session)"
                                :key="`${session.id}-${item.id}`"
                                class="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2"
                              >
                                <div class="flex flex-wrap items-center gap-2">
                                  <p class="text-sm font-semibold text-rose-800">{{ item.name }}</p>
                                  <span
                                    class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                    :class="criterionStatusClass(item.status)"
                                  >
                                    {{ criterionStatusLabel(item.status) }}
                                  </span>
                                  <span
                                    v-if="item.critical"
                                    class="inline-flex rounded-md bg-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-800"
                                  >
                                    Critical
                                  </span>
                                </div>
                                <p class="mt-1 text-xs text-rose-700">{{ item.note || 'Chưa có ghi chú chi tiết.' }}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>

                <tbody v-else>
                  <tr>
                    <td colspan="7" class="py-10">
                      <div class="flex flex-col items-center justify-center text-gray-500">
                        <p class="text-sm">Chưa có phiên QC hoặc phiếu nháp nào cho cửa hàng này.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="lg:hidden p-3 sm:p-4 space-y-3">
              <div
                v-for="session in tableRows"
                :key="session.rowKey"
                class="rounded-xl border border-gray-200 bg-white p-3.5"
              >
                <div class="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p class="text-base font-semibold text-slate-700">
                    Mã phiếu: <span class="text-blue-600">{{ session.code }}</span>
                  </p>
                  <p class="mt-1 text-xs text-slate-500">{{ session.templateName || '--' }} · {{ session.templateVersion || '--' }}</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700">{{ session.auditorName || '--' }}</p>
                  <span class="mt-2 inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                    {{ resultLabel(session.result) }}
                  </span>
                </div>

                <div class="mt-3 space-y-1.5 text-sm">
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Điểm:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">
                      {{ isDraftRow(session) ? 'Chưa chấm' : `${session.totalScore}/${session.maxScore} (${sessionScoreRate(session)}%)` }}
                    </span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Ngày chấm:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</span>
                  </div>
                  <div class="flex items-start justify-between gap-3">
                    <span class="shrink-0 text-slate-600">Ghi chú:</span>
                    <span class="min-w-0 text-right font-medium text-slate-700">{{ session.note || '--' }}</span>
                  </div>
                </div>

                <button
                  type="button"
                  class="mt-3 w-full cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  @click="handleRowAction(session)"
                >
                  {{ isDraftRow(session) ? 'Tiếp tục chỉnh sửa' : (isSessionExpanded(session.id) ? 'Thu chi tiết' : 'Xem tiêu chí cần khắc phục') }}
                </button>
                <button
                  v-if="isDraftRow(session)"
                  type="button"
                  class="mt-2 w-full cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  @click="removeDraftSession(session.id)"
                >
                  Xóa phiếu nháp
                </button>

                <div v-if="!isDraftRow(session) && isSessionExpanded(session.id)" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      v-for="reason in sessionReasons(session)"
                      :key="`${session.id}-mobile-${reason}`"
                      class="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                    >
                      {{ reason }}
                    </span>
                    <span
                      v-if="sessionReasons(session).length === 0"
                      class="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                    >
                      Không có lỗi cần theo dõi
                    </span>
                  </div>

                  <div v-if="sessionFailedItems(session).length > 0" class="space-y-2">
                    <div
                      v-for="item in sessionFailedItems(session)"
                      :key="`${session.id}-mobile-${item.id}`"
                      class="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2"
                    >
                      <div class="flex flex-wrap items-center gap-1.5">
                        <p class="text-sm font-semibold text-rose-800">{{ item.name }}</p>
                        <span
                          class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold"
                          :class="criterionStatusClass(item.status)"
                        >
                          {{ criterionStatusLabel(item.status) }}
                        </span>
                        <span
                          v-if="item.critical"
                          class="inline-flex rounded-md bg-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-800"
                        >
                          Critical
                        </span>
                      </div>
                      <p class="mt-1 text-xs text-rose-700">{{ item.note || 'Chưa có ghi chú chi tiết.' }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!hasRows" class="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
                Chưa có phiên QC hoặc phiếu nháp nào cho cửa hàng này.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isDraftModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeCreateDraftModal"
    >
      <div class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold text-slate-800">Khởi tạo phiếu QC nháp</h3>
            <p class="text-xs text-slate-500">Sau khi tạo, bạn sẽ vào màn chỉnh sửa chi tiết và dữ liệu được giữ dạng nháp.</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            @click="closeCreateDraftModal"
          >
            <span class="text-base leading-none">&times;</span>
          </button>
        </div>

        <div class="mt-3 space-y-2.5">
          <label class="block text-sm text-slate-700">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Loại biên bản QC</span>
            <select
              v-model="draftForm.templateId"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option v-for="template in qcTemplateOptions" :key="template.id" :value="template.id">
                {{ template.name }} ({{ template.version }})
              </option>
            </select>
          </label>

          <label class="block text-sm text-slate-700">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thời điểm kiểm tra</span>
            <input
              v-model="draftForm.auditedAt"
              type="datetime-local"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
          </label>

          <label class="block text-sm text-slate-700">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú mở đầu</span>
            <textarea
              v-model="draftForm.note"
              rows="3"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="Ghi chú nhanh mục tiêu phiên QC..."
            ></textarea>
          </label>

          <p v-if="draftModalError" class="text-xs font-medium text-rose-600">{{ draftModalError }}</p>
        </div>

        <div class="mt-3 flex justify-end gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            :disabled="creatingDraft"
            @click="closeCreateDraftModal"
          >
            Hủy
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            :disabled="creatingDraft"
            @click="createDraftAndOpen"
          >
            {{ creatingDraft ? 'Đang tạo...' : 'Tạo nháp và chỉnh sửa' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
