<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  createQcDraftSession,
  deleteQcDraftSession,
  deleteQcSession,
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

function isStoreActive(store) {
  return store?.is_active !== false && store?.isActive !== false
}

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
const openActionMenuKey = ref('')
const actionMenuPosition = reactive({ top: 0, left: 0 })
const draftSessions = ref([])
const draftModalError = ref('')
const draftLoadError = ref('')
const sessionLoadError = ref('')
const filters = reactive({
  q: '',
  status: '',
  remediation: '',
  from: String(route.query.date_from || ''),
  to: String(route.query.date_to || ''),
})
const sortDirections = ref({
  code: null,
  form: null,
  auditor: null,
  score: null,
  result: null,
  remediation: null,
  auditedAt: null,
  submittedAt: null,
})
const sortableFields = ['code', 'form', 'auditor', 'score', 'result', 'remediation', 'auditedAt', 'submittedAt']
const sortCycle = [null, 'desc', 'asc']

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
const hasRows = computed(() => tableRows.value.length > 0)
const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const isReviewRole = computed(() => ['admin', 'qc'].includes(userRole.value))
const remediationColumnLabel = computed(() => (isReviewRole.value ? 'Duyệt' : 'Khắc phục'))
const remediationActionLabel = computed(() => (isReviewRole.value ? 'Cần duyệt' : 'Cần khắc phục'))
const remediationSummaryLabel = computed(() => (isReviewRole.value ? 'Yêu cầu cần duyệt' : 'Yêu cầu khắc phục mở'))
const remediationSummaryMeta = computed(() => (
  isReviewRole.value
    ? `${activeFindingSessionCount.value} phiên cần duyệt`
    : `${activeFindingSessionCount.value} phiên cần khắc phục`
))
const remediationSummaryHint = computed(() => (
  isReviewRole.value
    ? 'Số yêu cầu khắc phục QC đang cần admin/QC theo dõi hoặc xác nhận.'
    : 'Số yêu cầu khắc phục QC chưa hoàn tất của cửa hàng này.'
))

const resultOptions = computed(() => [
  { value: '', label: 'Tất cả phiên' },
  { value: 'needs_remediation', label: remediationActionLabel.value, kind: 'remediation' },
  { value: 'passed', label: 'Đã đạt' },
  { value: 'failed', label: 'Không đạt' },
])

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

const selectedResultCount = computed(() => (filters.status || filters.remediation ? 1 : 0))
const storeId = computed(() => Number(route.params.storeId || 0))

const storeTitle = computed(() => {
  const queryName = String(route.query.storeName || '').trim()
  if (queryName) return queryName

  const userStores = Array.isArray(state.userInfo?.stores) ? state.userInfo.stores.filter(isStoreActive) : []
  const matchedUserStore = userStores.find((store) => Number(store?.id || 0) === storeId.value)
  if (matchedUserStore) {
    return matchedUserStore.shortAddress || matchedUserStore.address || matchedUserStore.name || matchedUserStore.code || `Cửa hàng #${storeId.value}`
  }

  const matchedSession = sessions.value.find((session) => String(session?.storeName || '').trim())
  if (matchedSession?.storeName) return matchedSession.storeName

  const matchedDraft = draftSessions.value.find((draft) => String(draft?.storeName || '').trim())
  if (matchedDraft?.storeName) return matchedDraft.storeName

  return storeId.value ? `Cửa hàng #${storeId.value}` : ''
})
const filteredSummary = computed(() => {
  const totalSessions = tableRows.value.filter((item) => item.rowType === 'session').length
  const passed = tableRows.value.filter((item) => item.rowType === 'session' && item.result === 'passed').length
  const failed = tableRows.value.filter((item) => item.rowType === 'session' && item.result === 'failed').length
  const totalScore = tableRows.value.reduce((sum, item) => sum + Number(item.totalScore || 0), 0)
  const totalMaxScore = tableRows.value.reduce((sum, item) => sum + Number(item.maxScore || 0), 0)

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

const openFindingCount = computed(() => (
  sessions.value.reduce((total, session) => total + Number(session.openFindings || 0), 0)
))

const activeFindingSessionCount = computed(() => (
  sessions.value.filter((session) => Number(session.openFindings || 0) > 0).length
))

const summaryCards = computed(() => [
  {
    key: 'totalSessions',
    label: 'Phiên đang hiển thị',
    value: filteredSummary.value.totalSessions,
    meta: `Toàn kỳ ${summary.value.totalSessions}`,
    hint: 'Số phiên QC của cửa hàng đang hiển thị theo bộ lọc hiện tại.',
    tone: 'sky',
  },
  {
    key: 'passRate',
    label: 'Tỷ lệ đạt',
    value: `${filteredSummary.value.passRate}%`,
    meta: `Toàn kỳ ${summary.value.passRate}%`,
    hint: 'Tỷ lệ phiên QC đạt trong danh sách đang hiển thị.',
    tone: 'emerald',
  },
  {
    key: 'remediation',
    label: remediationSummaryLabel.value,
    value: `${openFindingCount.value}`,
    meta: remediationSummaryMeta.value,
    hint: remediationSummaryHint.value,
    tone: 'rose',
  },
  {
    key: 'avgScoreRate',
    label: 'Điểm QC TB',
    value: `${filteredSummary.value.avgScoreRate}%`,
    meta: `${filteredSummary.value.avgScore}/${filteredSummary.value.avgMaxScore} điểm`,
    hint: 'Điểm QC trung bình quy đổi theo phần trăm trên các phiên đang hiển thị.',
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

const sessionFormLabel = (session) => {
  if (isDraftRow(session)) return session.templateName || 'Phiếu nháp QC'
  const template = session?.template || {}
  const name = String(template?.name || session?.templateName || '').trim()
  const version = String(template?.version || session?.templateVersion || '').trim()
  const label = name || 'Biểu mẫu QC'
  return version ? `${label} v${version}` : label
}

const remediationLabel = (session) => {
  if (isDraftRow(session)) return '--'
  return Number(session.openFindings || 0) > 0 ? remediationActionLabel.value : 'Đã hoàn tất'
}

const remediationClass = (session) => (
  Number(session?.openFindings || 0) > 0 ? 'app-badge--danger' : 'app-badge--success'
)

const sessionCompletionDuration = (session) => {
  if (isDraftRow(session) || !session?.submittedAt) return '--'
  const start = new Date(session.auditedAt || session.createdAt || '').getTime()
  const end = new Date(session.submittedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '--'
  const minutes = Math.max(Math.round((end - start) / 60000), 1)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain ? `${hours} giờ ${remain} phút` : `${hours} giờ`
}

const toggleActionMenu = (event, row) => {
  event?.stopPropagation?.()
  if (openActionMenuKey.value === row?.rowKey) {
    closeActionMenu()
    return
  }

  const rect = event?.currentTarget?.getBoundingClientRect?.()
  if (rect) {
    const menuWidth = 176
    const menuHeight = 96
    const viewportPadding = 12
    const opensUp = rect.bottom + menuHeight + viewportPadding > window.innerHeight
    actionMenuPosition.top = opensUp
      ? Math.max(viewportPadding, rect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + 8)
    actionMenuPosition.left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - menuWidth)
    )
  }
  openActionMenuKey.value = row?.rowKey || ''
}

const closeActionMenu = () => {
  openActionMenuKey.value = ''
}

const actionMenuOpen = (row) => openActionMenuKey.value === row?.rowKey
const activeActionRow = computed(() => tableRows.value.find((row) => row.rowKey === openActionMenuKey.value) || null)

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

const toggleSort = (field) => {
  if (!sortableFields.includes(field)) return
  const currentDirection = sortDirections.value[field] ?? null
  const currentIndex = sortCycle.indexOf(currentDirection)
  const nextIndex = (currentIndex + 1) % sortCycle.length
  sortDirections.value = {
    code: null,
    form: null,
    auditor: null,
    score: null,
    result: null,
    remediation: null,
    auditedAt: null,
    submittedAt: null,
  }
  sortDirections.value[field] = sortCycle[nextIndex]
}

const sortIndicator = (field) => {
  if (sortDirections.value[field] === 'desc') return '↓'
  if (sortDirections.value[field] === 'asc') return '↑'
  return '↕'
}

const sortIndicatorClass = (field) => (sortDirections.value[field] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]')

const rowSortValue = (row, field) => {
  if (field === 'form') return sessionFormLabel(row).toLowerCase()
  if (field === 'auditor') return String(row?.auditorName || '').toLowerCase()
  if (field === 'score') return Number(sessionScoreRate(row) ?? -1)
  if (field === 'result') return resultLabel(row?.result).toLowerCase()
  if (field === 'remediation') return remediationLabel(row).toLowerCase()
  if (field === 'auditedAt' || field === 'submittedAt') return new Date(row?.[field] || 0).getTime() || 0
  return String(row?.[field] || '').toLowerCase()
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
  if (filters.status || filters.remediation) return []

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
  return sessions.value
    .map((session) => {
      const openFindings = Number(session.openFindings || 0)
      return {
        ...session,
        rowType: 'session',
        rowKey: `session-${session.id}`,
        openFindings,
      }
    })
    .filter((session) => filters.remediation !== 'needs_remediation' || Number(session.openFindings || 0) > 0)
})

const tableRows = computed(() => {
  const rows = [...draftTableRows.value, ...sessionTableRows.value]
  const activeField = sortableFields.find((field) => sortDirections.value[field])
  if (activeField) {
    const direction = sortDirections.value[activeField]
    return rows.sort((left, right) => {
      const leftValue = rowSortValue(left, activeField)
      const rightValue = rowSortValue(right, activeField)
      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        return direction === 'asc' ? Number(leftValue) - Number(rightValue) : Number(rightValue) - Number(leftValue)
      }
      return direction === 'asc'
        ? String(leftValue).localeCompare(String(rightValue), 'vi')
        : String(rightValue).localeCompare(String(leftValue), 'vi')
    })
  }

  return rows.sort((left, right) => {
    const leftTime = new Date(left.auditedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(right.auditedAt || right.createdAt || 0).getTime()
    return rightTime - leftTime
  })
})

const isDraftRow = (row) => row?.rowType === 'draft'

const viewSessionDetail = (session) => {
  if (!session?.id) return
  router.push(`/QC/store/${storeId.value}/session/${encodeURIComponent(String(session.id))}`)
}

const handleRowAction = (row) => {
  closeActionMenu()
  if (isDraftRow(row)) {
    continueDraftSession(row.id)
    return
  }
  viewSessionDetail(row)
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
    const selectedTemplate = qcTemplateOptions.value.find((item) => item.id === String(payload.templateId || ''))
    const drafted = await createQcDraftSession({
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: payload.templateId,
      formVersionId: selectedTemplate?.activeVersionId || null,
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
  const query = {}
  if (route.query.date_from) query.date_from = route.query.date_from
  if (route.query.date_to) query.date_to = route.query.date_to
  router.push({ path: '/QC', query })
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
  <div class="app-page" @click="closeActionMenu">
    <div class="page-stack">
      <div class="flex min-w-0 items-start gap-3">
        <button
          @click="goBack"
          type="button"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
          aria-label="Quay lại danh sách QC"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Chi tiết QC cửa hàng</p>
          <h1 class="mt-1 truncate text-lg font-semibold text-[var(--text-primary)] tablet:text-xl" :title="storeTitle">{{ storeTitle }}</h1>
        </div>
      </div>

      <section class="grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4">
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

      <section class="flex flex-col space-y-4">
        <div class="flex flex-col overflow-visible rounded-xl border border-[var(--stroke)] bg-white">
          <div class="app-section-header relative z-10 tablet:px-6">


            <div class="pc:hidden">
              <div class="relative w-full">
                <input v-model="searchInput" type="text" class="block h-9 w-full rounded-lg border border-[var(--stroke)] px-3 ps-10 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-0" placeholder="Tìm mã phiếu, mẫu QC, ghi chú..." />
                <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-3">
                  <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                </div>
              </div>

              <div class="mt-2 grid grid-cols-3 gap-2">
                <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                  <button
                    id="qc-status-filter-mobile"
                    type="button"
                    class="relative inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    Kết quả
                    <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                    </svg>
                    <span v-if="selectedResultCount > 0" class="absolute -right-1.5 -top-1.5 inline-flex min-w-5 justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ selectedResultCount }}</span>
                  </button>
                  <div class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-44 z-20 mt-2 rounded-lg border border-[var(--stroke)] bg-white" role="menu" aria-orientation="vertical" aria-labelledby="qc-status-filter-mobile">
                    <label v-for="result in resultOptions" :key="result.value || 'all'" class="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                      <input :checked="(result.kind === 'remediation' ? filters.remediation : filters.status) === result.value && (result.kind === 'remediation' || !filters.remediation)" :value="result.value" type="radio" class="mt-0.5 shrink-0 border-[var(--stroke-strong)] text-[var(--text-primary)] focus:ring-[var(--stroke-strong)]" @change="() => { filters.status = result.kind === 'remediation' ? '' : result.value; filters.remediation = result.kind === 'remediation' ? result.value : ''; applyFilters() }">
                      <span>{{ result.label }}</span>
                    </label>
                  </div>
                </div>

                <DateRangePicker class="w-full min-w-0" v-model:from="filters.from" v-model:to="filters.to" :disabled="loading" placeholder="Thời gian" @change="applyFilters" />

                <button type="button" class="app-button-primary inline-flex h-9 w-full min-w-0 shrink-0 whitespace-nowrap items-center justify-center rounded-lg px-2 text-xs font-semibold" @click="openCreateDraftModal">
                  Tạo phiếu QC
                </button>
              </div>
            </div>

            <div class="hidden pc:flex pc:flex-row pc:items-center pc:justify-end pc:gap-2">
              <div class="hs-dropdown [--auto-close:inside] relative inline-block">
                <button
                  id="qc-status-filter"
                  type="button"
                  class="relative inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  Kết quả
                  <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="selectedResultCount > 0" class="absolute -right-1.5 -top-1.5 inline-flex min-w-5 justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ selectedResultCount }}</span>
                </button>
                <div class="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-44 z-20 mt-2 rounded-lg border border-[var(--stroke)] bg-white" role="menu" aria-orientation="vertical" aria-labelledby="qc-status-filter">
                  <label v-for="result in resultOptions" :key="result.value || 'all'" class="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                    <input :checked="(result.kind === 'remediation' ? filters.remediation : filters.status) === result.value && (result.kind === 'remediation' || !filters.remediation)" :value="result.value" type="radio" class="mt-0.5 shrink-0 border-[var(--stroke-strong)] text-[var(--text-primary)] focus:ring-[var(--stroke-strong)]" @change="() => { filters.status = result.kind === 'remediation' ? '' : result.value; filters.remediation = result.kind === 'remediation' ? result.value : ''; applyFilters() }">
                    <span>{{ result.label }}</span>
                  </label>
                </div>
              </div>

              <DateRangePicker v-model:from="filters.from" v-model:to="filters.to" :disabled="loading" placeholder="Thời gian" @change="applyFilters" />

              <div class="relative w-[300px] flex-none">
                <input v-model="searchInput" type="text" class="block h-9 w-full rounded-lg border border-[var(--stroke)] px-3 ps-10 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-0" placeholder="Tìm mã phiếu, mẫu QC, ghi chú..." />
                <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-3">
                  <svg class="size-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
                </div>
              </div>

              <button type="button" class="app-button-primary inline-flex h-9 shrink-0 whitespace-nowrap items-center justify-center rounded-lg px-4 text-sm font-semibold" @click="openCreateDraftModal">
                Tạo phiếu QC
              </button>
            </div>

            <div v-if="draftLoadError || sessionLoadError" class="mt-3 space-y-2">
              <p v-if="draftLoadError" class="app-state-banner text-xs font-medium">{{ draftLoadError }}</p>
              <p v-if="sessionLoadError" class="app-state-banner text-xs font-medium">{{ sessionLoadError }}</p>
            </div>
          </div>

          <div v-loading="loading" class="overflow-hidden rounded-b-xl">
            <div class="pc:hidden">
              <div v-if="hasRows" class="space-y-3 p-2.5 tablet:p-4">
                <article
                  v-for="session in tableRows"
                  :key="session.rowKey"
                  class="cursor-pointer rounded-lg border border-[var(--stroke)] bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)]"
                  @click="handleRowAction(session)"
                >
                  <div class="flex min-w-0 items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-2">
                        <p class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{{ session.code }}</p>
                        <span v-if="isDraftRow(session)" class="shrink-0 rounded bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning-text)]">Nháp</span>
                      </div>
                      <button
                        type="button"
                        class="mt-0.5 block max-w-full text-left"
                        @click.stop="handleRowAction(session)"
                      >
                        <p class="line-clamp-1 text-sm font-semibold leading-5 text-[var(--text-primary)]">{{ sessionFormLabel(session) }}</p>
                      </button>
                    </div>

                    <div class="flex shrink-0 items-start gap-1.5">
                      <span class="app-badge inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="resultClass(session.result)">
                        {{ resultLabel(session.result) }}
                      </span>
                      <button type="button" class="inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" aria-label="Mở menu thao tác" @click="toggleActionMenu($event, session)">
                        <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                      </button>
                    </div>
                  </div>

                  <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--stroke)] pt-2 text-xs">
                    <div class="min-w-0">
                      <span class="text-[var(--text-muted)]">Người lập: </span>
                      <span class="font-medium text-[var(--text-secondary)]">{{ session.auditorName || '--' }}</span>
                    </div>
                    <div class="min-w-0 text-right">
                      <span class="text-[var(--text-muted)]">Ngày: </span>
                      <span class="font-medium text-[var(--text-secondary)]">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</span>
                    </div>
                    <div class="min-w-0">
                      <span class="text-[var(--text-muted)]">Điểm: </span>
                      <span v-if="isDraftRow(session)" class="font-semibold text-[var(--text-secondary)]">--</span>
                      <span v-else class="font-semibold text-[var(--text-primary)]">{{ session.totalScore }}/{{ session.maxScore }} · {{ sessionScoreRate(session) }}%</span>
                    </div>
                    <div v-if="!isDraftRow(session)" class="min-w-0 text-right">
                      <span class="text-[var(--text-muted)]">{{ remediationColumnLabel }}: </span>
                      <span class="font-semibold" :class="session.openFindings > 0 ? 'text-[var(--danger-text)]' : 'text-[var(--success-text)]'">{{ remediationLabel(session) }}</span>
                    </div>
                    <div v-if="session.note" class="col-span-2 min-w-0">
                      <span class="text-[var(--text-muted)]">Ghi chú: </span>
                      <span class="line-clamp-1 font-medium text-[var(--text-secondary)]">{{ session.note }}</span>
                    </div>
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

            <div class="app-table-scroll hidden max-w-full pc:block">
              <table class="min-w-[980px] w-full divide-y divide-[var(--stroke)]">
                <thead class="bg-[var(--surface-muted)] uppercase text-xs font-semibold text-[var(--text-secondary)]">
                  <tr>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('code')">
                        <span>Mã phiếu</span>
                        <span :class="sortIndicatorClass('code')">{{ sortIndicator('code') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('form')">
                        <span>Biên bản</span>
                        <span :class="sortIndicatorClass('form')">{{ sortIndicator('form') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('auditor')">
                        <span>Người lập biên bản</span>
                        <span :class="sortIndicatorClass('auditor')">{{ sortIndicator('auditor') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-end">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('score')">
                        <span>Điểm</span>
                        <span :class="sortIndicatorClass('score')">{{ sortIndicator('score') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('result')">
                        <span>Kết quả</span>
                        <span :class="sortIndicatorClass('result')">{{ sortIndicator('result') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('remediation')">
                        <span>{{ remediationColumnLabel }}</span>
                        <span :class="sortIndicatorClass('remediation')">{{ sortIndicator('remediation') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('auditedAt')">
                        <span>Ngày chấm</span>
                        <span :class="sortIndicatorClass('auditedAt')">{{ sortIndicator('auditedAt') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-start">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)]" @click="toggleSort('submittedAt')">
                        <span>Hoàn thành</span>
                        <span :class="sortIndicatorClass('submittedAt')">{{ sortIndicator('submittedAt') }}</span>
                      </button>
                    </th>
                    <th class="px-4 py-2.5 text-end"></th>
                  </tr>
                </thead>
                <tbody v-if="hasRows" class="divide-y divide-[var(--stroke)]">
                  <template v-for="session in tableRows" :key="session.rowKey">
                    <tr class="cursor-pointer bg-white hover:bg-[var(--surface-muted)]" @click="handleRowAction(session)">
                      <td class="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-secondary)] hover:underline">{{ session.code }}</td>
                      <td class="px-4 py-2 text-sm text-[var(--text-secondary)]">
                        <p class="font-medium text-[var(--text-secondary)]">{{ sessionFormLabel(session) }}</p>
                        <p v-if="isDraftRow(session)" class="text-xs text-[var(--text-secondary)]">Bản nháp</p>
                      </td>
                      <td class="px-4 py-2 text-sm text-[var(--text-secondary)]">{{ session.auditorName || '--' }}</td>
                      <td class="px-4 py-2 text-end">
                        <template v-if="isDraftRow(session)">
                          <p class="text-sm font-semibold text-[var(--text-secondary)]">--</p>
                        </template>
                        <template v-else>
                          <p class="text-sm font-semibold text-[var(--text-secondary)]">{{ session.totalScore }}/{{ session.maxScore }}</p>
                          <p class="text-xs text-[var(--text-secondary)]">{{ sessionScoreRate(session) }}%</p>
                        </template>
                      </td>
                      <td class="px-4 py-2 text-sm">
                        <span class="app-badge inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="resultClass(session.result)">
                          {{ resultLabel(session.result) }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-sm">
                        <span v-if="!isDraftRow(session)" class="app-badge inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold" :class="session.openFindings > 0 ? 'app-badge--danger' : 'app-badge--success'">
                          {{ remediationLabel(session) }}
                        </span>
                        <span v-else class="text-xs text-[var(--text-muted)]">--</span>
                      </td>
                      <td class="px-4 py-2 text-sm text-[var(--text-secondary)]">{{ qcHelpers.toDateLabel(session.auditedAt || session.createdAt) }}</td>
                      <td class="px-4 py-2 text-sm text-[var(--text-secondary)]">{{ sessionCompletionDuration(session) }}</td>
                      <td class="px-4 py-2 text-end">
                        <div class="relative flex justify-end">
                          <button type="button" class="inline-flex size-8 items-center justify-center text-[var(--text-secondary)] transition-colors hover:text-[var(--primary)]" aria-label="Mở menu thao tác" @click="toggleActionMenu($event, session)">
                            <span class="material-symbols-outlined text-[20px]">more_horiz</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
                <tbody v-else>
                  <tr>
                    <td colspan="9" class="px-4 py-12">
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
    <Teleport to="body">
      <div
        v-if="activeActionRow"
        class="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white py-1 shadow-xl"
        :style="{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }"
        @click.stop
      >
        <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]" @click="handleRowAction(activeActionRow)">
          <span class="material-symbols-outlined text-[18px]">visibility</span>
          <span>{{ isDraftRow(activeActionRow) ? 'Tiếp tục' : 'Chi tiết' }}</span>
        </button>
        <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)]" @click="isDraftRow(activeActionRow) ? confirmRemoveDraftSession(activeActionRow.id) : confirmRemoveSession(activeActionRow.id)">
          <span class="material-symbols-outlined text-[18px]">delete</span>
          <span>{{ isDraftRow(activeActionRow) ? 'Xóa nháp' : 'Xóa phiên lỗi' }}</span>
        </button>
      </div>
    </Teleport>

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
        <div class="mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger-text)] ring-8 ring-[var(--danger-bg)]/70">
          <span class="material-symbols-outlined text-[28px]">delete</span>
        </div>
        <h3 class="text-lg font-bold text-[var(--text-primary)] tracking-tight">Xóa phiếu nháp?</h3>
        <p class="mt-2 text-[14px] font-medium text-[var(--text-secondary)] leading-relaxed px-2">
          Dữ liệu đã chấm sẽ bị mất hoàn toàn và chức năng này <span class="text-[var(--danger-text)] font-semibold underline decoration-rose-200 underline-offset-2">không thể khôi phục</span>.
        </p>

        <div class="mt-8 flex items-center gap-3 w-full">
          <button
            type="button"
            class="app-button-secondary inline-flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--stroke-strong)]"
            :disabled="deletingDraft"
            @click="cancelRemoveDraftSession"
          >
            Giữ lại
          </button>
          <button
            type="button"
            class="app-button-danger inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--danger-border)] disabled:opacity-50"
            :disabled="deletingDraft"
            @click="executeRemoveDraftSession"
          >
            <span v-if="deletingDraft" class="inline-block size-4 animate-spin rounded-full border-2 border-[var(--danger-border)] border-t-white"></span>
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
        <div class="mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger-text)] ring-8 ring-[var(--danger-bg)]/70">
          <span class="material-symbols-outlined text-[28px]">delete_forever</span>
        </div>
        <h3 class="text-lg font-bold text-[var(--text-primary)] tracking-tight">Xóa phiên QC đã chốt?</h3>
        <p class="mt-2 text-[14px] font-medium text-[var(--text-secondary)] leading-relaxed px-2">
          Hành động này sẽ xóa hoàn toàn kết quả chấm QC cùng với hình ảnh đính kèm và không thể khôi phục.
        </p>

        <div class="mt-8 flex items-center gap-3 w-full">
          <button
            type="button"
            class="app-button-secondary inline-flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--stroke-strong)]"
            :disabled="deletingSession"
            @click="cancelRemoveSession"
          >
            Giữ lại
          </button>
          <button
            type="button"
            class="app-button-danger inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--danger-border)] disabled:opacity-50"
            :disabled="deletingSession"
            @click="executeRemoveSession"
          >
            <span v-if="deletingSession" class="inline-block size-4 animate-spin rounded-full border-2 border-[var(--danger-border)] border-t-white"></span>
            <span v-else>Xóa vĩnh viễn</span>
          </button>
        </div>
      </div>
    </CommonModal>

    <!-- Session Details Modal -->

  </div>
</template>
