<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import {
  createQcSession,
  deleteQcDraftSession,
  getQcDraftSessionById,
  getQcSessionApi,
  getQcTemplateById,
  qcHelpers,
  updateQcDraftSession,
} from '@/services/qc_service'
import QCCriterionTreeItem from '@/components/QCCriterionTreeItem.vue'
import QCCreateStructureNode from '@/components/QCCreateStructureNode.vue'
import QCSessionRemediationPanel from '@/components/QCSessionRemediationPanel.vue'
import EvidenceViewer from '@/components/EvidenceViewer.vue'

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()

function isStoreActive(store) {
  return store?.is_active !== false && store?.isActive !== false
}

const saving = ref(false)
const errorMessage = ref('')
const MAX_ATTACHMENTS_PER_CRITERION = 3
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024
const AUTOSAVE_DEBOUNCE_MS = 1200
const CRITERION_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chưa chấm' },
  { id: 'fail', label: 'Không đạt' },
  { id: 'na', label: 'N/A' },
]
let autosaveTimer = null
let qcElapsedTimer = null

const sessionId = computed(() => String(route.params.sessionId || route.query.sessionId || '').trim())
const isReadonlySession = computed(() => Boolean(sessionId.value))
const draftId = computed(() => String(route.query.draftId || '').trim())
const hasDraftContext = computed(() => Boolean(draftId.value) || isReadonlySession.value)
const activeDraftId = ref('')
const draftCreatedAt = ref('')
const currentTime = ref(Date.now())
const hydratingDraft = ref(false)
const templateData = ref(null)
const activeCriterionFilter = ref('all')
const criterionSearch = ref('')
const activeStructureNodeId = ref('')
const activeFocusCriterionId = ref('')
const remediationPanelRef = ref(null)
const remediationActionState = ref({ canSubmit: false, disabled: true, loading: false, count: 0 })
const evidenceViewerOpen = ref(false)
const evidenceViewerImages = ref([])
const evidenceViewerIndex = ref(0)
const expandedStructureNodeIds = ref(new Set())
const structureOutlineOpen = ref(false)

const storeId = computed(() => Number(route.params.storeId || 0))
const selectedStore = computed(() => {
  const stores = Array.isArray(state.userInfo?.stores) ? state.userInfo.stores.filter(isStoreActive) : []
  return stores.find((item) => Number(item?.id || 0) === storeId.value) || null
})
const storeTitle = computed(() => {
  const store = selectedStore.value
  if (!store) return `Cửa hàng #${storeId.value || '--'}`
  return store.shortAddress || store.address || store.code || `Cửa hàng #${store.id}`
})

function toLocalDateTimeInput(value) {
  const source = value ? new Date(value) : new Date()
  const date = Number.isNaN(source.getTime()) ? new Date() : source
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function resolveDraftStartedAt(draft = {}) {
  return draft?.createdAt || draft?.auditedAt || (form.auditedAt ? new Date(form.auditedAt).toISOString() : '') || draft?.updatedAt || new Date().toISOString()
}

const form = reactive({
  templateId: '',
  formVersionId: null,
  auditedAt: toLocalDateTimeInput(),
  note: '',
  criteriaStates: {},
})

const selectedTemplate = computed(() => {
  if (templateData.value) return templateData.value
  return {
    id: '',
    code: '',
    name: hydratingDraft.value ? 'Đang tải biểu mẫu...' : '',
    activeVersionId: null,
    version: '',
    passThreshold: qcHelpers.passThreshold,
    criteriaTree: [],
    flatCriteria: [],
  }
})

const scorableCriteria = computed(() => {
  const source = selectedTemplate.value.flatCriteria || []
  const parentCriterionIds = new Set(
    source
      .map((criterion) => criterion.parentId)
      .filter((parentId) => parentId !== null && parentId !== undefined && String(parentId) !== '')
      .map((parentId) => String(parentId))
  )

  return source
    .filter((criterion) => !parentCriterionIds.has(String(criterion.id)))
    .map((criterion, index) => ({
    ...criterion,
    criterionIndex: index + 1,
    }))
})

const qcFormTitle = computed(() => selectedTemplate.value.name || 'Phiếu QC')


const buildDefaultCriterionState = (criterion = {}) => {
  const mode = String(criterion?.mode || criterion?.scoreType || 'point')
  const maxScore = Math.max(Number(criterion?.maxScore || 0), 0)
  return {
    status: 'pass',
    score: mode === 'point' || mode === 'pass_fail' ? maxScore : null,
    note: '',
    attachments: [],
  }
}

const resolveCriterionStatus = (criterion, criterionState = {}) => {
  const rawStatus = String(criterionState?.status || 'pending')
  if (rawStatus === 'na') return 'na'

  if (criterion?.mode === 'point') {
    const rawScore = criterionState?.score
    if (rawScore === null || rawScore === undefined || String(rawScore) === '') {
      return rawStatus === 'fail' || rawStatus === 'pass' ? rawStatus : 'pending'
    }

    const score = Number(rawScore)
    if (!Number.isFinite(score)) return 'pending'
    const maxScore = Number(criterion?.maxScore || 0)
    const minPassScore = Number(criterion?.minPassScore ?? (maxScore / 2))
    return score >= minPassScore ? 'pass' : 'fail'
  }

  return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
}

const ensureCriterionState = (criterionId) => {
  if (!form.criteriaStates[criterionId]) {
    const criterion = scorableCriteria.value.find((item) => String(item.id) === String(criterionId))
    form.criteriaStates[criterionId] = buildDefaultCriterionState(criterion)
  }
  return form.criteriaStates[criterionId]
}

const getCriterionState = (criterionId) => {
  const criterion = scorableCriteria.value.find((item) => String(item.id) === String(criterionId))
  return form.criteriaStates[criterionId] || buildDefaultCriterionState(criterion)
}

const onCriterionUpdate = (id, updates) => {
  if (isReadonlySession.value) return
  const state = ensureCriterionState(id)
  Object.assign(state, updates)
  if (updates?.status === 'na') {
    state.score = null
    state.note = ''
    state.attachments = []
  }
}

const onAttachmentUpload = async (id, event) => {
  if (isReadonlySession.value) return
  const input = event?.target
  const selectedFiles = Array.from(input?.files || [])
  if (selectedFiles.length === 0) return

  const state = ensureCriterionState(id)
  const availableSlots = MAX_ATTACHMENTS_PER_CRITERION - state.attachments.length

  if (availableSlots <= 0) {
    toast.error(`Mỗi tiêu chí chỉ được đính kèm tối đa ${MAX_ATTACHMENTS_PER_CRITERION} ảnh.`)
    if (input) input.value = ''
    return
  }

  const filesToProcess = selectedFiles.slice(0, availableSlots)
  const nextAttachments = []
  const issues = []

  for (const file of filesToProcess) {
    if (!String(file.type || '').startsWith('image/')) {
      issues.push(`${file.name}: không phải định dạng ảnh`)
      continue
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      issues.push(`${file.name}: vượt quá ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}`)
      continue
    }

    try {
      const previewUrl = await readFileAsDataUrl(file)
      nextAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl,
        preview: previewUrl,
        url: previewUrl,
      })
    } catch (error) {
      issues.push(error?.message || `Không đọc được ảnh ${file.name}`)
    }
  }

  if (nextAttachments.length > 0) {
    state.attachments = [...state.attachments, ...nextAttachments]
  }

  if (selectedFiles.length > availableSlots) {
    issues.push(`Chỉ thêm ${availableSlots}/${selectedFiles.length} ảnh do giới hạn tối đa`)
  }

  if (issues.length > 0) {
    toast.error(issues[0])
  }

  if (input) input.value = ''
}

const onAttachmentRemove = (id, index) => {
  if (isReadonlySession.value) return
  const state = ensureCriterionState(id)
  state.attachments.splice(index, 1)
}

const initializeCriteriaStates = () => {
  const nextStates = {}
  scorableCriteria.value.forEach((criterion) => {
    nextStates[criterion.id] = buildDefaultCriterionState(criterion)
  })
  form.criteriaStates = nextStates
}

const buildDraftCriteriaStates = ({ includeAttachments = true } = {}) => {
  return Object.entries(form.criteriaStates || {}).reduce((acc, [criterionId, state]) => {
    const attachments = Array.isArray(state?.attachments) ? state.attachments : []
    acc[String(criterionId)] = {
      status: String(state?.status || 'pending'),
      score: state?.score === null || state?.score === undefined || String(state?.score) === '' ? null : Number(state.score),
      note: String(state?.note || ''),
      attachments: includeAttachments
        ? attachments.map((item, index) => ({
          id: String(item?.id || `attachment-${index + 1}`),
          name: String(item?.name || `image-${index + 1}`),
          type: String(item?.type || 'image/*'),
          size: Number(item?.size || 0),
          previewUrl: String(item?.previewUrl || item?.preview || item?.url || '').trim(),
          preview: String(item?.preview || item?.previewUrl || item?.url || '').trim(),
          url: String(item?.url || item?.previewUrl || item?.preview || '').trim(),
        })).filter((item) => item.previewUrl || item.preview || item.url)
        : [],
    }
    return acc
  }, {})
}

const persistDraftNow = async ({ includeAttachments = true } = {}) => {
  if (isReadonlySession.value || !activeDraftId.value || hydratingDraft.value) return

  try {
    await updateQcDraftSession(activeDraftId.value, {
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: form.templateId,
      formVersionId: form.formVersionId || selectedTemplate.value.activeVersionId || null,
      auditedAt: form.auditedAt ? new Date(form.auditedAt).toISOString() : new Date().toISOString(),
      note: form.note,
      criteriaStates: buildDraftCriteriaStates({ includeAttachments }),
    })
  } catch (_error) {
    return
  }
}

const scheduleDraftAutosave = async () => {
  if (isReadonlySession.value || hydratingDraft.value) return
  if (!activeDraftId.value) return

  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }

  autosaveTimer = setTimeout(() => {
    void persistDraftNow()
  }, AUTOSAVE_DEBOUNCE_MS)
}

const restoreReadonlySession = async () => {
  if (!sessionId.value) return

  try {
    hydratingDraft.value = true
    const session = await getQcSessionApi(sessionId.value)
    if (!session) {
      errorMessage.value = 'Không tìm thấy phiên QC.'
      return
    }

    activeDraftId.value = ''
    draftCreatedAt.value = session.createdAt || session.auditedAt || ''
    form.templateId = String(session.formId || session.templateId || session.template?.id || '')
    form.formVersionId = Number(session.formVersionId || 0) || null
    form.auditedAt = toLocalDateTimeInput(session.auditedAt || session.createdAt)
    form.note = String(session.note || '')

    if (!/^\d+$/.test(form.templateId)) {
      templateData.value = null
      form.criteriaStates = {}
      errorMessage.value = 'Phiên QC thiếu mã biểu mẫu nội bộ nên không thể mở chi tiết.'
      return
    }

    const template = await getQcTemplateById(form.templateId, { formVersionId: form.formVersionId })
    if (!template) {
      templateData.value = null
      form.criteriaStates = {}
      errorMessage.value = 'Không tải được cấu trúc biểu mẫu QC cho phiên này.'
      return
    }

    const sessionCriteria = Array.isArray(session.criteria) ? session.criteria : []
    const criteriaByLookup = new Map()
    sessionCriteria.forEach((criterion) => {
      if (criterion?.id !== null && criterion?.id !== undefined) criteriaByLookup.set(String(criterion.id), criterion)
      if (criterion?.code) criteriaByLookup.set(String(criterion.code), criterion)
    })
    templateData.value = {
      ...template,
      passThreshold: session.templatePassThreshold ?? template.passThreshold,
    }
    initializeCriteriaStates()

    const nextStates = {}
    scorableCriteria.value.forEach((criterion) => {
      const saved = criteriaByLookup.get(String(criterion.id)) || criteriaByLookup.get(String(criterion.code || ''))
      nextStates[criterion.id] = {
        status: String(saved?.status || 'pending'),
        score: saved?.score === null || saved?.score === undefined || String(saved?.score) === '' ? null : Number(saved.score),
        note: String(saved?.note || ''),
        attachments: Array.isArray(saved?.attachments) ? saved.attachments.map((attachment) => ({ ...attachment })) : [],
      }
    })

    form.criteriaStates = nextStates
    errorMessage.value = ''
  } catch (error) {
    templateData.value = null
    form.criteriaStates = {}
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không tải được phiên QC.'
  } finally {
    hydratingDraft.value = false
  }
}

const restoreDraftSession = async () => {
  if (isReadonlySession.value) {
    await restoreReadonlySession()
    return
  }

  if (!draftId.value) {
    activeDraftId.value = ''
    draftCreatedAt.value = ''
    templateData.value = null
    form.templateId = ''
    form.formVersionId = null
    form.criteriaStates = {}
    errorMessage.value = 'Vui lòng khởi tạo phiếu nháp từ màn chi tiết cửa hàng trước khi chấm QC.'
    return
  }

  try {
    hydratingDraft.value = true
    const draft = await getQcDraftSessionById(draftId.value)

    if (!draft) {
      activeDraftId.value = ''
      draftCreatedAt.value = ''
      templateData.value = null
      form.formVersionId = null
      form.criteriaStates = {}
      errorMessage.value = 'Không tìm thấy phiếu nháp hoặc nháp đã bị xóa.'
      return
    }

    if (Number(draft.storeId) !== Number(storeId.value)) {
      activeDraftId.value = ''
      draftCreatedAt.value = ''
      templateData.value = null
      form.formVersionId = null
      form.criteriaStates = {}
      errorMessage.value = 'Phiếu nháp không thuộc cửa hàng hiện tại.'
      return
    }

    const nextTemplateId = String(draft.templateId || '')
    if (!nextTemplateId) {
      activeDraftId.value = draft.id
      draftCreatedAt.value = resolveDraftStartedAt(draft)
      templateData.value = null
      form.formVersionId = null
      form.criteriaStates = {}
      errorMessage.value = 'Phiếu nháp chưa có biểu mẫu QC hợp lệ.'
      return
    }

    activeDraftId.value = draft.id
    draftCreatedAt.value = resolveDraftStartedAt(draft)
    form.templateId = nextTemplateId
    form.formVersionId = draft.formVersionId || null
    form.auditedAt = toLocalDateTimeInput(draft.auditedAt || draft.createdAt || draftCreatedAt.value)
    form.note = String(draft.note || '')

    const template = await getQcTemplateById(nextTemplateId, { formVersionId: form.formVersionId })
    if (!template) {
      templateData.value = null
      form.formVersionId = null
      form.criteriaStates = {}
      errorMessage.value = 'Không tải được cấu trúc biểu mẫu QC cho phiếu nháp này.'
      return
    }

    templateData.value = template
    form.formVersionId = draft.formVersionId || template.activeVersionId || null
    initializeCriteriaStates()

    const incomingStates = draft.criteriaStates && typeof draft.criteriaStates === 'object'
      ? draft.criteriaStates
      : {}
    const nextStates = {}

    scorableCriteria.value.forEach((criterion) => {
      const baseState = form.criteriaStates[criterion.id] || buildDefaultCriterionState(criterion)

      const savedState = incomingStates[criterion.id]
      if (!savedState) {
        nextStates[criterion.id] = { ...baseState }
        return
      }

      nextStates[criterion.id] = {
        status: String(savedState.status || baseState.status || 'pending'),
        score: savedState.score === null || savedState.score === undefined || String(savedState.score) === ''
          ? null
          : Number(savedState.score),
        note: String(savedState.note ?? baseState.note ?? ''),
        attachments: Array.isArray(savedState.attachments)
          ? savedState.attachments.map((attachment) => ({ ...attachment }))
          : [],
      }
    })

    form.criteriaStates = nextStates
    errorMessage.value = ''
  } catch (error) {
    activeDraftId.value = ''
    draftCreatedAt.value = ''
    templateData.value = null
    form.formVersionId = null
    form.criteriaStates = {}
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không tải được phiếu nháp.'
  } finally {
    hydratingDraft.value = false
  }
}

initializeCriteriaStates()

watch(
  () => storeId.value,
  async () => {
    await restoreDraftSession()
  }
)

watch(
  () => form.note,
  () => {
    scheduleDraftAutosave()
  }
)

watch(
  () => form.criteriaStates,
  () => {
    scheduleDraftAutosave()
  },
  { deep: true }
)

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('page-scroll-hidden')
    document.body.classList.add('page-scroll-hidden')
  }
  qcElapsedTimer = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 60000)
  await restoreDraftSession()
})

watch(
  () => sessionId.value,
  async (nextSessionId) => {
    if (!nextSessionId) return
    await restoreReadonlySession()
  }
)

watch(
  () => draftId.value,
  async (nextDraftId) => {
    if (nextDraftId && String(nextDraftId) === String(activeDraftId.value)) {
      return
    }
    await restoreDraftSession()
  }
)

const formatFileSize = (size = 0) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const readFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}`))
    reader.readAsDataURL(file)
  })
}

const criteriaPayload = computed(() => {
  return scorableCriteria.value.map((criterion) => {
    const state = getCriterionState(criterion.id)
    const status = resolveCriterionStatus(criterion, state)

    return {
      id: criterion.id,
      code: criterion.code,
      name: criterion.name,
      mode: criterion.mode,
      score: state.score,
      maxScore: criterion.maxScore,
      minPassScore: criterion.minPassScore ?? (Number(criterion.maxScore || 0) / 2),
      deductionPercent: criterion.deductionPercent || 0,
      severity: criterion.severity || 'normal',
      applicable: status !== 'na',
      status: status,
      note: String(state.note || '').trim(),
      attachments: state.attachments.map(a => ({ ...a }))
    }
  })
})

const sessionEvaluation = computed(() => {
  return qcHelpers.evaluateSession({
    criteria: criteriaPayload.value,
    passThreshold: selectedTemplate.value.passThreshold,
  })
})

const completedCriteria = computed(() => scorableCriteria.value.length - sessionEvaluation.value.incompleteCount)
const remainingCriteria = computed(() => sessionEvaluation.value.incompleteCount)
const completionRate = computed(() => (scorableCriteria.value.length > 0 ? Math.round((completedCriteria.value / scorableCriteria.value.length) * 100) : 0))
const submitDisabled = computed(() => (
  saving.value
  || hydratingDraft.value
  || (!isReadonlySession.value && !activeDraftId.value)
  || scorableCriteria.value.length === 0
  || remainingCriteria.value > 0
  || !selectedTemplate.value.activeVersionId
))

const draftStatusLabel = computed(() => (
  isReadonlySession.value ? 'Chỉ xem' : activeDraftId.value ? 'Phiếu nháp' : 'Chưa tải nháp'
))

const draftCreatedLabel = computed(() => {
  if (!draftCreatedAt.value) return 'Chưa có ngày tạo'
  return `Tạo ngày ${qcHelpers.toDateLabel(draftCreatedAt.value)}`
})

const draftCreatedTimeLabel = computed(() => (
  draftCreatedAt.value ? qcHelpers.toDateLabel(draftCreatedAt.value) : '--'
))

const qcElapsedLabel = computed(() => {
  if (!draftCreatedAt.value) return '--'

  const createdTime = new Date(draftCreatedAt.value).getTime()
  if (!Number.isFinite(createdTime)) return '--'

  const elapsedMinutes = Math.max(Math.floor((currentTime.value - createdTime) / 60000), 0)
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  if (hours <= 0) return `${minutes} phút`
  return `${hours} giờ ${minutes} phút`
})

const criterionSnapshots = computed(() => (
  scorableCriteria.value.map((criterion) => {
    const criterionState = getCriterionState(criterion.id)
    const status = resolveCriterionStatus(criterion, criterionState)
    return {
      ...criterion,
      status,
      note: String(criterionState?.note || '').trim(),
    }
  })
))

const criterionSnapshotMap = computed(() => (
  new Map(criterionSnapshots.value.map((item) => [String(item.id), item]))
))

const activeFilterMeta = computed(() => (
  CRITERION_FILTERS.find((item) => item.id === activeCriterionFilter.value) || CRITERION_FILTERS[0]
))

const getCriterionSearchText = (criterion) => (
  [
    criterion?.ordering,
    criterion?.code,
    criterion?.name,
    criterion?.description,
  ].filter(Boolean).join(' ').toLowerCase()
)

const matchesCriterionSearch = (criterion) => {
  const searchTerm = String(criterionSearch.value || '').trim().toLowerCase()
  if (!searchTerm) return true
  return getCriterionSearchText(criterion).includes(searchTerm)
}

const matchesCriterionStatusFilter = (criterion) => {
  const snapshot = criterionSnapshotMap.value.get(String(criterion?.id || ''))
  if (!snapshot) return false

  switch (activeCriterionFilter.value) {
    case 'pending':
      return snapshot.status === 'pending'
    case 'fail':
      return snapshot.status === 'fail'
    case 'na':
      return snapshot.status === 'na'
    default:
      return true
  }
}

const collectLeafNodes = (node) => {
  const children = Array.isArray(node?.children) ? node.children : []
  if (!children.length) return [node]
  return children.flatMap((child) => collectLeafNodes(child))
}

const matchesCriterionFilter = (criterion) => (
  matchesCriterionSearch(criterion) && matchesCriterionStatusFilter(criterion)
)

const filterCriteriaTree = (nodes = []) => (
  nodes.reduce((acc, node) => {
    const children = Array.isArray(node?.children) ? filterCriteriaTree(node.children) : []
    const hasChildren = Array.isArray(node?.children) && node.children.length > 0

    if (hasChildren) {
      const selfMatchesSearch = matchesCriterionSearch(node)
      const leafMatchesStatus = collectLeafNodes(node).some((leaf) => matchesCriterionStatusFilter(leaf))

      if ((selfMatchesSearch && leafMatchesStatus) || children.length > 0) {
        acc.push({ ...node, children })
      }
      return acc
    }

    if (matchesCriterionFilter(node)) {
      acc.push(node)
    }

    return acc
  }, [])
)

const failedCriteria = computed(() => (
  criterionSnapshots.value.filter((criterion) => criterion.status === 'fail')
))

const pendingCriteria = computed(() => (
  criterionSnapshots.value.filter((criterion) => criterion.status === 'pending')
))

const failedCriteriaCount = computed(() => failedCriteria.value.length)
const excludedCriteria = computed(() => (
  criterionSnapshots.value.filter((criterion) => criterion.status === 'na')
))
const excludedCriteriaCount = computed(() => excludedCriteria.value.length)

const activeReadonlyTab = computed(() => (String(route.query.view || 'qc') === 'findings' ? 'findings' : 'qc'))

const syncReadonlyFindingCountQuery = () => {
  if (!isReadonlySession.value) return
  const nextCount = String(failedCriteriaCount.value || 0)
  if (String(route.query.findingCount || '') === nextCount) return
  router.replace({ query: { ...route.query, findingCount: nextCount } })
}

watch(
  () => failedCriteriaCount.value,
  syncReadonlyFindingCountQuery,
  { immediate: true }
)

const predictedConclusion = computed(() => {
  if (remainingCriteria.value > 0) return 'pending'
  return sessionEvaluation.value.status === 'passed' ? 'pass' : 'fail'
})

const predictedConclusionLabel = computed(() => {
  if (predictedConclusion.value === 'pass') return 'Đạt'
  if (predictedConclusion.value === 'fail') return 'Chưa đạt'
  return 'Chưa đủ dữ liệu'
})

const progressBarStyle = computed(() => ({
  width: `${completionRate.value}%`,
}))

const leafCountForNode = (node) => {
  const children = Array.isArray(node?.children) ? node.children : []
  if (!children.length) return 1
  return children.reduce((total, child) => total + leafCountForNode(child), 0)
}

const completedCountForNode = (node) => {
  const children = Array.isArray(node?.children) ? node.children : []
  if (children.length) return children.reduce((total, child) => total + completedCountForNode(child), 0)

  const snapshot = criterionSnapshotMap.value.get(String(node?.id || ''))
  return snapshot && snapshot.status !== 'pending' ? 1 : 0
}

const failedCountForNode = (node) => {
  const children = Array.isArray(node?.children) ? node.children : []
  if (children.length) return children.reduce((total, child) => total + failedCountForNode(child), 0)

  const snapshot = criterionSnapshotMap.value.get(String(node?.id || ''))
  return snapshot?.status === 'fail' ? 1 : 0
}

const structureNodeTone = (completed, total, failed) => {
  if (failed > 0) return 'danger'
  if (total > 0 && completed === total) return 'success'
  if (completed > 0) return 'warning'
  return 'idle'
}

const getStructureOrderingSegment = (node, index) => {
  const fallback = String(index + 1)
  if (node?.nodeType === 'group') {
    const segment = String(node?.orderingLabel || '').trim().toUpperCase()
    if (segment) return segment
  }

  const orderingParts = String(node?.ordering || '').split('.').filter(Boolean)
  return orderingParts[orderingParts.length - 1] || fallback
}

const buildStructureNode = (node, level = 1, ancestors = [], index = 0, parentDisplayOrdering = '') => {
  const total = leafCountForNode(node)
  const completed = completedCountForNode(node)
  const failed = failedCountForNode(node)
  const segment = getStructureOrderingSegment(node, index)
  const displayOrdering = parentDisplayOrdering ? `${parentDisplayOrdering}.${segment}` : segment
  const outlineId = [displayOrdering, node.id, node.code, node.name]
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
    .map((part) => String(part).trim())
    .join('::')

  const current = {
    ...node,
    id: node.id,
    outlineId: outlineId || `${level}:${index}:${displayOrdering}`,
    ordering: node.ordering || node.code || '',
    displayOrdering,
    name: node.name || 'Tiêu chí',
    ancestors,
  }

  return {
    ...current,
    level,
    ancestors,
    total,
    completed,
    failed,
    tone: structureNodeTone(completed, total, failed),
    expanded: expandedStructureNodeIds.value.has(current.outlineId),
    children: Array.isArray(node.children) ? node.children.map((child, childIndex) => buildStructureNode(child, level + 1, [...ancestors, current], childIndex, displayOrdering)) : [],
  }
}

const structureTree = computed(() => (
  (selectedTemplate.value.criteriaTree || []).map((node, index) => buildStructureNode(node, 1, [], index))
))

const collectExpandableStructureNodeIds = (nodes = []) => (
  nodes.reduce((acc, node) => {
    if (node.children?.length) {
      acc.push(String(node.outlineId || node.id))
      acc.push(...collectExpandableStructureNodeIds(node.children))
    }
    return acc
  }, [])
)

const isStructureNodeExpanded = (node) => (
  expandedStructureNodeIds.value.has(String(node?.outlineId || node?.id || ''))
)

const expandablePathIdsForNode = (node) => {
  const pathNodes = [...(Array.isArray(node?.ancestors) ? node.ancestors : []), node]
  return pathNodes
    .map((item) => String(item?.outlineId || item?.id || ''))
    .filter(Boolean)
}

const focusOutlineBranch = (node) => {
  expandedStructureNodeIds.value = new Set(expandablePathIdsForNode(node))
}

const toggleStructureNode = (node) => {
  if (!node?.children?.length) return
  focusOutlineBranch(node)
}

const structureTreeSignature = computed(() => (
  collectExpandableStructureNodeIds(selectedTemplate.value.criteriaTree || []).join('|')
))

watch(
  () => structureTreeSignature.value,
  () => {
    const sourceTree = selectedTemplate.value.criteriaTree || []
    if (!activeStructureNodeId.value && sourceTree[0]) {
      activeStructureNodeId.value = String(sourceTree[0].id)
    }
    const activeNode = findStructureNodeById(structureTree.value, activeStructureNodeId.value) || structureTree.value[0] || null
    expandedStructureNodeIds.value = new Set(activeNode ? expandablePathIdsForNode(activeNode) : [])
  },
  { immediate: true }
)

function findStructureNodeById(nodes = [], nodeId = '') {
  for (const node of nodes) {
    if (String(node.id) === String(nodeId)) return node
    const matchedChild = findStructureNodeById(node.children || [], nodeId)
    if (matchedChild) return matchedChild
  }
  return null
}

const activeStructureNode = computed(() => (
  findStructureNodeById(structureTree.value, activeStructureNodeId.value) || structureTree.value[0] || null
))

const activeHeaderNode = computed(() => activeStructureNode.value || null)

const activeHeaderBreadcrumb = computed(() => {
  const headerNode = activeHeaderNode.value
  if (!headerNode) return []
  return [...(headerNode.ancestors || []), headerNode]
})

const structureToggleLabel = computed(() => (structureOutlineOpen.value ? 'Ẩn cấu trúc' : 'Hiện cấu trúc'))

const activeHeaderTitle = computed(() => {
  const node = activeHeaderNode.value
  if (!node) return qcFormTitle.value
  return [node.ordering, node.name].filter(Boolean).join(' ')
})

const activeHeaderCompleted = computed(() => activeHeaderNode.value?.completed ?? completedCriteria.value)
const activeHeaderTotal = computed(() => activeHeaderNode.value?.total ?? scorableCriteria.value.length)

const activeContentSourceTree = computed(() => {
  const headerNode = activeHeaderNode.value
  if (!headerNode) return selectedTemplate.value.criteriaTree
  return headerNode.children?.length ? headerNode.children : [headerNode]
})

const visibleCriteriaTree = computed(() => (
  activeCriterionFilter.value === 'all' && !String(criterionSearch.value || '').trim()
    ? activeContentSourceTree.value
    : filterCriteriaTree(activeContentSourceTree.value)
))

const visibleCriteriaCount = computed(() => (
  visibleCriteriaTree.value.reduce((total, node) => total + leafCountForNode(node), 0)
))

const activateStructureNode = async (node, focusCriterionId = '') => {
  if (!node) return
  activeStructureNodeId.value = String(node.id)
  activeFocusCriterionId.value = focusCriterionId ? String(focusCriterionId) : ''

  focusOutlineBranch(node)

  if (focusCriterionId) {
    await focusCriterion(focusCriterionId)
  }
}

const focusStructureNode = async (node) => {
  if (!node) return

  if (node.children?.length) {
    await activateStructureNode(node)
    return
  }

  const parentNode = node.ancestors?.length
    ? node.ancestors[node.ancestors.length - 1]
    : node

  activeStructureNodeId.value = String(parentNode.id)
  activeFocusCriterionId.value = String(node.id)
  focusOutlineBranch(node)
  await focusCriterion(node.id)
}

const selectWorkspaceGroup = async (node) => {
  if (!node?.children?.length) return
  await activateStructureNode(node)
}

const filteredEmptyMessage = computed(() => {
  if (activeCriterionFilter.value === 'all') {
    return 'Chưa tải được tiêu chí cho phiếu nháp này.'
  }

  return `Không có tiêu chí nào thuộc nhóm "${activeFilterMeta.value.label}".`
})

const setCriterionFilter = (filterId) => {
  activeCriterionFilter.value = filterId
}

const focusCriterion = async (criterionId) => {
  if (!criterionId) return

  await nextTick()
  const element = document.getElementById(`criterion-${criterionId}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}



const goBack = () => {
  router.push(`/QC/store/${storeId.value}`)
}

const handleRemediationActionState = (state = {}) => {
  remediationActionState.value = {
    canSubmit: Boolean(state.canSubmit),
    disabled: Boolean(state.disabled),
    loading: Boolean(state.loading),
    count: Number(state.count || 0),
  }
}

const openCriterionEvidence = (payload = {}) => {
  const images = Array.isArray(payload.images) ? payload.images : []
  if (!images.length) return
  evidenceViewerImages.value = images
  evidenceViewerIndex.value = Math.min(Math.max(Number(payload.index || 0), 0), images.length - 1)
  evidenceViewerOpen.value = true
}

const closeCriterionEvidence = () => {
  evidenceViewerOpen.value = false
  evidenceViewerImages.value = []
  evidenceViewerIndex.value = 0
}

const submitRemediationFindings = () => {
  remediationPanelRef.value?.submitAllRemediation?.()
}

const submitSession = async () => {
  if (!storeId.value) {
    errorMessage.value = 'Không xác định được cửa hàng để tạo phiếu QC.'
    return
  }

  if (remainingCriteria.value > 0) {
    errorMessage.value = `Còn ${remainingCriteria.value} tiêu chí chưa đánh giá. Vui lòng hoàn tất trước khi lưu.`
    return
  }

  const submitFormVersionId = form.formVersionId || selectedTemplate.value.activeVersionId
  if (!submitFormVersionId) {
    errorMessage.value = 'Biểu mẫu QC chưa có phiên bản đang áp dụng hợp lệ.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  await persistDraftNow({ includeAttachments: true })

  try {
    await createQcSession({
      storeId: storeId.value,
      formVersionId: submitFormVersionId,
      criteria: criteriaPayload.value,
      note: form.note,
      auditedAt: form.auditedAt ? new Date(form.auditedAt).toISOString() : new Date().toISOString(),
    })

    if (activeDraftId.value) {
      try {
        await deleteQcDraftSession(activeDraftId.value)
      } catch (_error) {
        // Session da tao thanh cong; khong chan dieu huong neu xoa nhap that bai.
      }
    }

    activeDraftId.value = ''
    router.push(`/QC/store/${storeId.value}`)
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tạo phiếu QC.'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('page-scroll-hidden')
    document.body.classList.remove('page-scroll-hidden')
  }
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
  if (qcElapsedTimer) {
    clearInterval(qcElapsedTimer)
  }
  if (!isReadonlySession.value) {
    void persistDraftNow({ includeAttachments: true })
  }
})
</script>

<template>
  <div class="qc-create-shell">
    <div class="app-page qc-create-page">
      <p
        v-if="errorMessage"
        class="app-state-banner text-sm font-medium"
      >
        {{ errorMessage }}
      </p>

      <div class="mb-3 flex min-w-0 items-center gap-2">
        <button
          @click="goBack"
          type="button"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] tablet:w-auto tablet:gap-2 tablet:px-3 tablet:text-sm tablet:font-bold"
          aria-label="Quay lại"
        >
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          <span class="hidden tablet:inline">Quay lại</span>
        </button>

        <span v-if="!isReadonlySession" class="inline-flex min-w-0 shrink items-center gap-1 text-[11px] font-bold text-[var(--success-text)] tablet:text-xs">
          <span class="material-symbols-outlined text-[17px]">check_circle</span>
          <span class="hidden min-[390px]:inline">Tự động lưu</span>
        </span>

        <div class="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 tablet:gap-2">
          <template v-if="!isReadonlySession">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--primary)] bg-white px-2.5 text-xs font-bold text-[var(--primary-strong)] transition hover:bg-[var(--primary-softer)] tablet:px-4 tablet:text-sm"
              @click="persistDraftNow({ includeAttachments: true })"
            >
              Lưu nháp
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:bg-[var(--primary-soft)] disabled:text-white/80 tablet:px-4 tablet:text-sm"
              :disabled="submitDisabled"
              @click="submitSession"
            >
              {{ saving ? 'Đang lưu...' : 'Lưu phiên QC' }}
            </button>
          </template>

          <button
            v-if="isReadonlySession && activeReadonlyTab === 'findings' && remediationActionState.canSubmit"
            type="button"
            class="app-button-primary inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-bold"
            :disabled="remediationActionState.disabled"
            @click="submitRemediationFindings"
          >
            {{ remediationActionState.loading ? 'Đang gửi...' : 'Gửi khắc phục lỗi' }}
          </button>
        </div>
      </div>

      <section v-if="!isReadonlySession || activeReadonlyTab === 'qc'" class="qc-create-grid min-h-0 flex-1">
        <aside class="qc-create-panel qc-create-outline" :class="{ 'qc-create-outline--open': structureOutlineOpen }">
          <div class="qc-create-outline-header">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">Cấu trúc biểu mẫu</h2>
              <p class="mt-0.5 truncate text-xs text-[var(--text-secondary)] tablet:hidden">{{ activeHeaderTitle }}</p>
            </div>
            <button
              type="button"
              class="qc-outline-toggle"
              :aria-expanded="structureOutlineOpen"
              :aria-label="structureToggleLabel"
              @click="structureOutlineOpen = !structureOutlineOpen"
            >
              <span class="material-symbols-outlined text-[20px]">{{ structureOutlineOpen ? 'expand_less' : 'expand_more' }}</span>
              <span class="text-xs font-bold">{{ structureOutlineOpen ? 'Ẩn' : 'Hiện' }}</span>
            </button>
          </div>

          <div class="qc-create-outline-scroll">
            <div v-if="structureTree.length" class="qc-outline-tree">
              <QCCreateStructureNode
                v-for="node in structureTree"
                :key="node.outlineId || node.id"
                :node="node"
                :active-node-id="activeFocusCriterionId || activeStructureNodeId"
                @select="focusStructureNode"
                @toggle="toggleStructureNode"
              />
            </div>

            <div v-else class="p-4">
              <div class="app-state-panel app-state-panel--compact">
                <p class="app-state-title">Chưa có cấu trúc</p>
                <p class="app-state-body">Cấu trúc sẽ hiển thị sau khi tải phiếu nháp.</p>
              </div>
            </div>
          </div>
        </aside>

        <main class="qc-create-panel qc-create-workspace">
          <div class="qc-create-toolbar">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <template v-for="(item, index) in activeHeaderBreadcrumb" :key="`${item.id}-${index}`">
                  <span :class="index === activeHeaderBreadcrumb.length - 1 ? 'font-semibold text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'">{{ item.name }}</span>
                  <span v-if="index < activeHeaderBreadcrumb.length - 1">/</span>
                </template>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-2">
                <h1 class="min-w-0 text-base font-semibold text-[var(--text-primary)] tablet:text-lg" :title="activeHeaderTitle">
                  {{ activeHeaderTitle }}
                </h1>
              </div>
            </div>
          </div>

          <div v-if="!isReadonlySession || activeReadonlyTab === 'qc'" class="qc-create-controls">
            <label class="qc-control-search">
              <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-secondary)]">search</span>
              <input v-model="criterionSearch" type="search" class="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none" placeholder="Tìm tiêu chí" />
            </label>

            <div class="qc-filter-tabs" role="tablist" aria-label="Lọc tiêu chí">
              <button
                v-for="filter in CRITERION_FILTERS"
                :key="filter.id"
                type="button"
                class="qc-filter-tab"
                :class="activeCriterionFilter === filter.id ? 'qc-filter-tab--active' : ''"
                @click="setCriterionFilter(filter.id)"
              >
                {{ filter.label }}
              </button>
            </div>

          </div>

          <div
            v-if="!hasDraftContext || (!isReadonlySession && !activeDraftId) || scorableCriteria.length === 0"
            class="px-6 py-10"
          >
            <div class="app-state-panel app-state-panel--compact">
              <div class="app-state-stack mx-auto">
                <div class="app-state-icon mx-auto">
                  <span class="material-symbols-outlined text-[24px]">assignment</span>
                </div>
                    <p class="app-state-title">{{ isReadonlySession ? 'Chưa tải được tiêu chí cho phiên QC này.' : hasDraftContext ? 'Chưa tải được tiêu chí cho phiếu nháp này.' : 'Chưa có phiếu nháp để tiếp tục.' }}</p>
                <p class="app-state-body">{{ isReadonlySession ? 'Kiểm tra lại phiên QC hoặc quay về màn trước.' : hasDraftContext ? 'Kiểm tra lại biểu mẫu hoặc quay về màn trước để khởi tạo lại phiếu nháp.' : 'Khởi tạo phiếu nháp từ màn chi tiết cửa hàng trước khi bắt đầu chấm QC.' }}</p>
              </div>
            </div>
          </div>

          <div
            v-else-if="visibleCriteriaTree.length === 0"
            class="px-6 py-10"
          >
            <div class="app-state-panel app-state-panel--compact">
              <div class="app-state-stack mx-auto">
                <div class="app-state-icon mx-auto">
                  <span class="material-symbols-outlined text-[24px]">filter_alt_off</span>
                </div>
                <p class="app-state-title">{{ filteredEmptyMessage }}</p>
                <p class="app-state-body">Đổi bộ lọc tiêu chí để tiếp tục rà soát đầy đủ các hạng mục cần chấm.</p>
              </div>
            </div>
          </div>

          <div v-else class="space-y-2 px-3 pb-5 tablet:px-4">
            <QCCriterionTreeItem
              v-for="criterion in visibleCriteriaTree"
              :key="criterion.id"
              :criterion="criterion"
              :criteria-states="form.criteriaStates"
              :max-attachments="MAX_ATTACHMENTS_PER_CRITERION"
              :shallow-groups="true"
              :readonly="isReadonlySession"
              @update-state="onCriterionUpdate"
              @upload-attachment="onAttachmentUpload"
              @remove-attachment="onAttachmentRemove"
              @select-group="selectWorkspaceGroup"
              @open-evidence="openCriterionEvidence"
            />
          </div>
        </main>

        <aside class="qc-create-panel qc-create-summary">
          <div class="border-b border-[var(--stroke)] px-4 py-3">
            <h2 class="text-sm font-semibold text-[var(--text-primary)]">Tổng quan phiếu</h2>
          </div>

          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <section class="space-y-3">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-xs font-medium text-[var(--text-secondary)]">Hoàn tất</p>
                  <p class="mt-1 text-2xl font-bold text-[var(--text-primary)]">{{ completionRate }}%</p>
                </div>
                <p class="text-sm font-semibold text-[var(--text-secondary)]">{{ completedCriteria }}/{{ scorableCriteria.length }}</p>
              </div>

              <div class="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div class="h-full rounded-full bg-[var(--primary)] transition-all" :style="progressBarStyle"></div>
              </div>
            </section>

            <section class="overflow-hidden rounded-lg border border-[var(--stroke)] bg-white">
              <div class="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-3 py-2.5">
                <span class="text-xs font-medium text-[var(--text-secondary)]">Đã chấm</span>
                <strong class="text-sm font-bold text-[var(--text-primary)]">{{ completedCriteria }}</strong>
              </div>
              <div class="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-3 py-2.5">
                <span class="text-xs font-medium text-[var(--text-secondary)]">Còn lại</span>
                <strong class="text-sm font-bold text-[var(--warning-text)]">{{ pendingCriteria.length }}</strong>
              </div>
              <div class="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-3 py-2.5">
                <span class="text-xs font-medium text-[var(--text-secondary)]">Không đạt</span>
                <strong class="text-sm font-bold text-[var(--danger-text)]">{{ failedCriteriaCount }}</strong>
              </div>
              <div class="flex items-center justify-between gap-3 border-b border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2.5">
                <span class="text-xs font-medium text-[var(--danger-text)]">Khắc phục</span>
                <strong class="text-sm font-bold text-[var(--danger-text)]">{{ failedCriteriaCount }}</strong>
              </div>
              <div class="flex items-center justify-between gap-3 bg-[var(--surface-muted)] px-3 py-2.5">
                <span class="text-xs font-medium text-[var(--text-secondary)]">N/A</span>
                <strong class="text-sm font-bold text-[var(--text-primary)]">{{ excludedCriteriaCount }}</strong>
              </div>
            </section>

            <section class="space-y-2 border-y border-[var(--stroke)] py-3 text-xs text-[var(--text-secondary)]">
              <div class="flex items-center justify-between gap-3"><span>Giờ tạo</span><strong class="text-right text-[var(--text-primary)]">{{ draftCreatedTimeLabel }}</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Thời gian QC</span><strong class="text-[var(--text-primary)]">{{ qcElapsedLabel }}</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Điểm</span><strong class="text-[var(--text-primary)]">{{ sessionEvaluation.totalScore }} / {{ sessionEvaluation.maxScore }}</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Không áp dụng</span><strong class="text-[var(--text-primary)]">{{ sessionEvaluation.excludedCount }}</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Khấu trừ</span><strong class="text-[var(--danger-text)]">{{ sessionEvaluation.totalDeduction.toFixed(0) }}%</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Tỷ lệ cuối</span><strong class="text-[var(--text-primary)]">{{ sessionEvaluation.finalScoreRate.toFixed(1) }}%</strong></div>
              <div class="flex items-center justify-between gap-3"><span>Ngưỡng đạt</span><strong class="text-[var(--text-primary)]">{{ selectedTemplate.passThreshold }}%</strong></div>
            </section>

            <section class="space-y-2">
              <p class="text-xs font-semibold text-[var(--text-primary)]">Kết luận</p>
              <div class="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>Trạng thái</span>
                <span class="inline-flex items-center gap-1.5 font-bold" :class="predictedConclusion === 'pass' ? 'text-[var(--success-text)]' : predictedConclusion === 'fail' ? 'text-[var(--danger-text)]' : 'text-[var(--warning-text)]'">
                  <span class="material-symbols-outlined text-[16px]">{{ predictedConclusion === 'pass' ? 'check_circle' : predictedConclusion === 'fail' ? 'cancel' : 'info' }}</span>
                  {{ predictedConclusionLabel }}
                </span>
              </div>
              <label class="block">
                <span class="text-xs font-medium text-[var(--text-secondary)]">Lý do</span>
                <textarea
                  v-model="form.note"
                  :readonly="isReadonlySession"
                  rows="3"
                  class="mt-1 w-full resize-none rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-0"
                  placeholder="Nhập lý do kết luận (không bắt buộc)"
                ></textarea>
              </label>
            </section>
          </div>
        </aside>
      </section>

      <section v-else class="min-h-0 flex-1 overflow-hidden">
        <QCSessionRemediationPanel
          ref="remediationPanelRef"
          :store-id="storeId"
          :session-id="sessionId"
          @action-state="handleRemediationActionState"
        />
      </section>
    </div>

    <EvidenceViewer
      v-model="evidenceViewerOpen"
      :images="evidenceViewerImages"
      initial-source="qc"
      :initial-index="evidenceViewerIndex"
      title="Minh chứng biên bản QC"
      :enable-compare="false"
      @close="closeCriterionEvidence"
    />

  </div>
</template>

<style scoped>
.qc-create-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-muted);
}

.qc-create-page {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  padding: 0.75rem;
}

.qc-create-grid {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(230px, 0.58fr) minmax(600px, 2.28fr) minmax(270px, 0.78fr);
  gap: 0.625rem;
}

.qc-create-panel {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--stroke);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 0.75rem;
  box-shadow: 0 10px 28px rgba(16, 42, 86, 0.06);
}

.qc-create-outline,
.qc-create-workspace,
.qc-create-summary {
  display: flex;
  flex-direction: column;
}

.qc-create-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--stroke);
  padding: 1rem;
}

.qc-outline-toggle {
  display: none;
  min-height: 2.25rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 0.5rem;
  border: 1px solid var(--stroke);
  background: #ffffff;
  padding: 0 0.625rem;
  color: var(--text-secondary);
  transition: background-color 0.16s ease, color 0.16s ease;
}

.qc-outline-toggle:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.qc-create-outline-scroll,
.qc-create-workspace {
  overflow-y: auto;
  scrollbar-width: none;
}

.qc-create-outline-scroll::-webkit-scrollbar,
.qc-create-workspace::-webkit-scrollbar {
  display: none;
}

.qc-create-toolbar {
  border-bottom: 1px solid var(--stroke);
  background: rgba(255, 255, 255, 0.86);
  padding: 16px;
}

.qc-create-controls {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--stroke);
  background: rgba(255, 255, 255, 0.94);
  padding: 0.625rem 0.75rem;
}

.qc-control-search {
  position: relative;
  min-width: 16rem;
  flex: 1 1 auto;
}

.qc-filter-tabs {
  display: inline-flex;
  height: 2.25rem;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--stroke);
  background: #ffffff;
  border-radius: 0.5rem;
}

.qc-filter-tab {
  min-width: 5.25rem;
  cursor: pointer;
  border-right: 1px solid var(--stroke);
  padding: 0 0.875rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.qc-filter-tab:last-child {
  border-right: 0;
}

.qc-filter-tab:hover {
  background: var(--surface-muted);
}

.qc-filter-tab--active {
  background: var(--primary-soft);
  color: var(--primary-strong);
}


@media (max-width: 767px) {
  .qc-create-outline {
    max-height: 4.5rem;
    transition: max-height 0.2s ease;
  }

  .qc-create-outline--open {
    max-height: min(24rem, 58vh);
  }

  .qc-create-outline-header {
    min-height: 4.5rem;
    padding: 0.75rem;
  }

  .qc-outline-toggle {
    display: inline-flex;
  }

  .qc-create-outline-scroll {
    display: none;
  }

  .qc-create-outline--open .qc-create-outline-scroll {
    display: block;
    min-height: 0;
    flex: 1 1 auto;
  }

  .qc-create-controls {
    position: static;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .qc-control-search {
    min-width: 0;
    width: 100%;
  }

  .qc-filter-tabs {
    width: 100%;
  }

  .qc-filter-tab {
    min-width: 0;
    flex: 1 1 0;
    padding: 0 0.5rem;
    white-space: nowrap;
  }
}

.qc-toolbar-button {
  display: inline-flex;
  height: 2.25rem;
  cursor: pointer;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--stroke);
  background: #ffffff;
  border-radius: 0.5rem;
  padding: 0 0.75rem;
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  transition: background-color 0.16s ease, opacity 0.16s ease;
}

.qc-toolbar-button:hover {
  background: var(--surface-muted);
}

.qc-toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.qc-outline-tree {
  padding: 0.625rem;
}


@media (max-width: 63.99rem) {
  .qc-create-shell {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  .qc-create-page {
    overflow: visible;
    padding-bottom: 1rem;
  }

  .qc-create-grid {
    height: auto;
    grid-template-columns: 1fr;
  }

  .qc-create-summary {
    max-height: none;
  }

  .qc-create-outline {
    max-height: 4.5rem;
  }

  .qc-create-outline--open {
    max-height: min(24rem, 58vh);
  }

}

@media (max-width: 47.99rem) {
  .qc-create-page {
    padding: 0.5rem;
  }
}
</style>
