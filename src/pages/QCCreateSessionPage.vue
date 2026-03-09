<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  createQcDraftSession,
  createQcFinding,
  createQcSession,
  deleteQcDraftSession,
  getQcDraftSessionById,
  getQcTemplateById,
  listQcSessionsApi,
  listQcTemplates,
  qcHelpers,
  updateQcDraftSession,
} from '@/services/qc_service'
import QCCriterionTreeItem from '@/components/QCCriterionTreeItem.vue'

const route = useRoute()
const router = useRouter()
const { state } = useApp()

const saving = ref(false)
const errorMessage = ref('')
const QC_TEMPLATE_SELECT_ID = 'qc-template-id'
const MAX_ATTACHMENTS_PER_CRITERION = 3
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024
const WEEKLY_SKIP_NOTE = 'Tiêu chí đã được chấm trong tuần này.'
const AUTOSAVE_DEBOUNCE_MS = 1200
let autosaveTimer = null

const draftId = computed(() => String(route.query.draftId || '').trim())
const activeDraftId = ref('')
const draftSavedAt = ref('')
const hydratingDraft = ref(false)
const weeklyCheckedCriterionIds = ref(new Set())
let weeklyCriteriaRequestId = 0
const qcTemplates = ref([])
const templateData = ref(null)

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

function toLocalDateTimeInput(value) {
  const source = value ? new Date(value) : new Date()
  const date = Number.isNaN(source.getTime()) ? new Date() : source
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const form = reactive({
  templateId: '',
  auditedAt: toLocalDateTimeInput(),
  note: '',
  criteriaStates: {},
})

const selectedTemplate = computed(() => {
  if (templateData.value) return templateData.value
  return { id: '', name: 'Đang tải...', version: '', passThreshold: 80, criteriaTree: [], flatCriteria: [] }
})

const flatCriteria = computed(() => {
  const source = selectedTemplate.value.flatCriteria || []
  return source.map((criterion, index) => ({
    ...criterion,
    criterionIndex: index + 1,
  }))
})

const ensureCriterionState = (criterionId) => {
  if (!form.criteriaStates[criterionId]) {
    form.criteriaStates[criterionId] = {
      status: 'pending',
      score: null,
      note: '',
      attachments: [],
    }
  }
  return form.criteriaStates[criterionId]
}

const getCriterionState = (criterionId) => (
  form.criteriaStates[criterionId] || { status: 'pending', score: null, note: '', attachments: [] }
)

const onCriterionUpdate = (id, updates) => {
  const state = ensureCriterionState(id)
  Object.assign(state, updates)
  
  // Custom logic for score-status sync if needed
  if (updates.score !== undefined && updates.score !== null) {
    state.status = 'pass'
  }
}

const onAttachmentUpload = async (id, event) => {
  const input = event?.target
  const selectedFiles = Array.from(input?.files || [])
  if (selectedFiles.length === 0) return

  errorMessage.value = ''
  const state = ensureCriterionState(id)
  const availableSlots = MAX_ATTACHMENTS_PER_CRITERION - state.attachments.length

  if (availableSlots <= 0) {
    errorMessage.value = `Mỗi tiêu chí chỉ được đính kèm tối đa ${MAX_ATTACHMENTS_PER_CRITERION} ảnh.`
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
    errorMessage.value = issues[0]
  }

  if (input) input.value = ''
}

const onAttachmentRemove = (id, index) => {
  const state = ensureCriterionState(id)
  state.attachments.splice(index, 1)
}

const getWeekStart = (dateString) => {
  const source = dateString ? new Date(dateString) : new Date()
  const date = Number.isNaN(source.getTime()) ? new Date() : source
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

const toIsoDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const refreshWeeklyCheckedCriteria = async () => {
  if (!storeId.value) {
    weeklyCheckedCriterionIds.value = new Set()
    return
  }

  const weekStart = getWeekStart(form.auditedAt)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const from = toIsoDate(weekStart)
  const to = toIsoDate(weekEnd)
  const requestId = ++weeklyCriteriaRequestId

  try {
    const payload = await listQcSessionsApi({
      storeId: storeId.value,
      from,
      to,
      pageSize: 200,
      fetchAll: true,
    })

    if (requestId !== weeklyCriteriaRequestId) return

    const checked = new Set()
    const rows = Array.isArray(payload?.sessions) ? payload.sessions : []
    rows.forEach((session) => {
      const criteria = Array.isArray(session?.criteria) ? session.criteria : []
      criteria.forEach((item) => {
        const status = String(item?.status || '').toLowerCase()
        const score = Number(item?.score)
        if (status === 'pass' || status === 'fail' || Number.isFinite(score)) {
          checked.add(String(item?.id || ''))
        }
      })
    })

    weeklyCheckedCriterionIds.value = checked
  } catch (_error) {
    if (requestId !== weeklyCriteriaRequestId) return
    weeklyCheckedCriterionIds.value = new Set()
  }
}

const hasWeeklyChecked = (criterionId) => {
  return weeklyCheckedCriterionIds.value.has(String(criterionId))
}

const applyWeeklyAvailability = (criterion, state) => {
  if (criterion.frequency !== 'weekly_once') return

  if (hasWeeklyChecked(criterion.id)) {
    state.status = 'skipped_weekly'
    state.score = null
    if (!state.note || state.note === WEEKLY_SKIP_NOTE) {
      state.note = WEEKLY_SKIP_NOTE
    }
    return
  }

  if (state.status === 'skipped_weekly') {
    state.status = 'pending'
    if (state.note === WEEKLY_SKIP_NOTE) {
      state.note = ''
    }
  }
}

const initializeCriteriaStates = () => {
  const nextStates = {}
  flatCriteria.value.forEach((criterion) => {
    const state = {
      status: 'pending',
      score: null,
      note: '',
      attachments: [],
    }

    applyWeeklyAvailability(criterion, state)

    nextStates[criterion.id] = state
  })
  form.criteriaStates = nextStates
}

const refreshWeeklyCriteriaStates = () => {
  flatCriteria.value.forEach((criterion) => {
    const state = ensureCriterionState(criterion.id)
    applyWeeklyAvailability(criterion, state)
  })
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

const ensureActiveDraftSession = async () => {
  if (activeDraftId.value || hydratingDraft.value || !storeId.value) {
    return activeDraftId.value
  }

  try {
    const created = await createQcDraftSession({
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: form.templateId,
      auditedAt: form.auditedAt ? new Date(form.auditedAt).toISOString() : new Date().toISOString(),
      note: form.note,
      criteriaStates: buildDraftCriteriaStates(),
    })

    activeDraftId.value = created.id
    draftSavedAt.value = created.updatedAt || created.createdAt || ''

    if (!draftId.value) {
      await router.replace({
        path: `/QC/store/${storeId.value}/create`,
        query: { draftId: created.id },
      })
    }

    return created.id
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tạo phiếu nháp.'
    return ''
  }
}

const persistDraftNow = async ({ includeAttachments = true } = {}) => {
  if (!activeDraftId.value || hydratingDraft.value) return

  let updated = null
  try {
    updated = await updateQcDraftSession(activeDraftId.value, {
      storeId: storeId.value,
      storeName: storeTitle.value,
      templateId: form.templateId,
      auditedAt: form.auditedAt ? new Date(form.auditedAt).toISOString() : new Date().toISOString(),
      note: form.note,
      criteriaStates: buildDraftCriteriaStates({ includeAttachments }),
    })
  } catch (_error) {
    return
  }

  if (updated?.updatedAt) {
    draftSavedAt.value = updated.updatedAt
  }
}

const scheduleDraftAutosave = async () => {
  if (hydratingDraft.value) return
  if (!activeDraftId.value) {
    const draftSessionId = await ensureActiveDraftSession()
    if (!draftSessionId) return
  }

  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }

  autosaveTimer = setTimeout(() => {
    void persistDraftNow()
  }, AUTOSAVE_DEBOUNCE_MS)
}

const restoreDraftSession = async () => {
  if (!draftId.value) {
    activeDraftId.value = ''
    draftSavedAt.value = ''
    return
  }

  let draft = null
  try {
    draft = await getQcDraftSessionById(draftId.value)
  } catch (error) {
    activeDraftId.value = ''
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không tải được phiếu nháp.'
    return
  }

  if (!draft) {
    activeDraftId.value = ''
    errorMessage.value = 'Không tìm thấy phiếu nháp hoặc nháp đã bị xóa.'
    return
  }

  if (Number(draft.storeId) !== Number(storeId.value)) {
    activeDraftId.value = ''
    errorMessage.value = 'Phiếu nháp không thuộc cửa hàng hiện tại.'
    return
  }

  hydratingDraft.value = true
  activeDraftId.value = draft.id

  form.templateId = qcTemplates.some((item) => item.id === draft.templateId)
    ? draft.templateId
    : qcTemplates[0].id
  form.auditedAt = toLocalDateTimeInput(draft.auditedAt || draft.updatedAt || draft.createdAt)
  form.note = String(draft.note || '')

  await nextTick()
  initializeCriteriaStates()

  const incomingStates = draft.criteriaStates && typeof draft.criteriaStates === 'object'
    ? draft.criteriaStates
    : {}
  const nextStates = {}

  flatCriteria.value.forEach((criterion) => {
    const baseState = form.criteriaStates[criterion.id] || {
      status: 'pending',
      score: null,
      note: '',
      attachments: [],
    }

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
  await refreshWeeklyCheckedCriteria()
  refreshWeeklyCriteriaStates()
  draftSavedAt.value = draft.updatedAt || ''
  errorMessage.value = ''
  hydratingDraft.value = false
}

initializeCriteriaStates()

const loadTemplates = async () => {
  try {
    qcTemplates.value = await listQcTemplates()
    if (!form.templateId && qcTemplates.value.length > 0) {
      form.templateId = qcTemplates.value[0].id
    }
  } catch (error) {
    console.error('Failed to load QC templates', error)
  }
}

const loadTemplateData = async (templateId) => {
  if (!templateId) return
  try {
    templateData.value = await getQcTemplateById(templateId)
    initializeCriteriaStates()
    refreshWeeklyCriteriaStates()
  } catch (error) {
    errorMessage.value = error?.message || 'Không tải được cấu trúc tiêu chí.'
    console.error('Failed to load template data', error)
  }
}

watch(
  () => form.templateId,
  async (newId) => {
    if (newId) {
      await loadTemplateData(newId)
    }
    scheduleDraftAutosave()
  }
)

watch(
  () => storeId.value,
  async () => {
    initializeCriteriaStates()
    await refreshWeeklyCheckedCriteria()
    refreshWeeklyCriteriaStates()
  }
)

watch(
  () => form.auditedAt,
  async () => {
    await refreshWeeklyCheckedCriteria()
    refreshWeeklyCriteriaStates()
    scheduleDraftAutosave()
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

function syncPrelineSelectValue(elementId, value) {
  const selectElement = document.getElementById(elementId)
  if (!selectElement) return

  const normalizedValue = value ? String(value) : ''
  selectElement.value = normalizedValue

  const hsSelect = window.HSSelect?.getInstance?.(selectElement, true)
  if (hsSelect?.element?.setValue) {
    hsSelect.element.setValue(normalizedValue)
  }
}

onMounted(async () => {
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  await loadTemplates()
  syncPrelineSelectValue(QC_TEMPLATE_SELECT_ID, form.templateId)
  await restoreDraftSession()
  await refreshWeeklyCheckedCriteria()
  refreshWeeklyCriteriaStates()
})

watch(
  () => form.templateId,
  async (value) => {
    await nextTick()
    syncPrelineSelectValue(QC_TEMPLATE_SELECT_ID, value)
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

const getCriterionResult = (criterion) => {
  const state = getCriterionState(criterion.id)
  if (state.status === 'na' || state.status === 'skipped_weekly') return state.status

  if (criterion.mode === 'pass_fail') {
    if (state.status === 'pass' || state.status === 'fail') return state.status
    return 'pending'
  }

  if (state.score === null || state.score === undefined || String(state.score) === '') return 'pending'
  const score = Math.max(0, Math.min(Number(state.score || 0), Number(criterion.maxScore || 0)))
  return score >= Number(criterion.passScore || criterion.maxScore || 0) ? 'pass' : 'fail'
}

const criteriaPayload = computed(() => {
  return flatCriteria.value.map((criterion) => {
    const state = getCriterionState(criterion.id)
    let status = state.status
    
    if (criterion.mode === 'point' && state.score !== null && status === 'pass') {
      status = state.score >= (criterion.passScore || criterion.maxScore) ? 'pass' : 'fail'
    }

    return {
      id: criterion.id,
      code: criterion.code,
      name: criterion.name,
      mode: criterion.mode,
      score: state.score,
      maxScore: criterion.maxScore,
      critical: Boolean(criterion.isCritical),
      applicable: status !== 'na' && status !== 'skipped_weekly',
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

const completedCriteria = computed(() => flatCriteria.value.length - sessionEvaluation.value.incompleteCount)
const remainingCriteria = computed(() => sessionEvaluation.value.incompleteCount)
const completionRate = computed(() => (flatCriteria.value.length > 0 ? Math.round((completedCriteria.value / flatCriteria.value.length) * 100) : 0))

const resultLabel = computed(() => {
  if (remainingCriteria.value > 0) return 'Chưa hoàn tất'
  return sessionEvaluation.value.status === 'passed' ? 'Đạt chuẩn' : 'Không đạt'
})

const resultToneClass = computed(() => {
  if (remainingCriteria.value > 0) return 'bg-amber-50'
  return sessionEvaluation.value.status === 'passed' ? 'bg-emerald-50' : 'bg-rose-50'
})

const resultBadgeClass = computed(() => {
  if (remainingCriteria.value > 0) return 'bg-amber-100 text-amber-700'
  return sessionEvaluation.value.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
})

const resultReasons = computed(() => {
  const reasonLabels = {
    incomplete: 'Còn tiêu chí chưa chấm',
    failed: 'Có tiêu chí không đạt',
    critical: 'Có tiêu chí critical chưa đạt',
    threshold: 'Chưa đạt ngưỡng điểm',
  }
  return (sessionEvaluation.value.reasons || []).map((item) => reasonLabels[item] || item)
})

const draftSavedLabel = computed(() => {
  if (!draftSavedAt.value) return ''
  return qcHelpers.toDateLabel(draftSavedAt.value)
})



const goBack = () => {
  router.push(`/QC/store/${storeId.value}`)
}

const submitSession = async () => {
  if (!storeId.value || !selectedStore.value) {
    errorMessage.value = 'Không xác định được cửa hàng để tạo phiếu QC.'
    return
  }

  if (remainingCriteria.value > 0) {
    errorMessage.value = `Còn ${remainingCriteria.value} tiêu chí chưa đánh giá. Vui lòng hoàn tất trước khi lưu.`
    return
  }

  saving.value = true
  errorMessage.value = ''
  await persistDraftNow({ includeAttachments: true })
  const hasCriterionAttachments = criteriaPayload.value.some((criterion) => Array.isArray(criterion.attachments) && criterion.attachments.length > 0)

  try {
    await createQcSession({
      storeId: storeId.value,
      storeName: storeTitle.value,
      auditorId: state.userInfo?.id || null,
      auditorName: state.userInfo?.name || '',
      templateId: selectedTemplate.value.id,
      templateName: selectedTemplate.value.name,
      templateVersion: selectedTemplate.value.version,
      templatePassThreshold: selectedTemplate.value.passThreshold,
      criteria: criteriaPayload.value,
      note: form.note,
      auditedAt: form.auditedAt ? new Date(form.auditedAt).toISOString() : new Date().toISOString(),
    })

    // Session item chưa có nơi persist evidence, nên chỉ xóa draft khi không còn attachment.
    if (activeDraftId.value && !hasCriterionAttachments) {
      await deleteQcDraftSession(activeDraftId.value)
    }

    router.push(`/QC/store/${storeId.value}`)
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tạo phiếu QC.'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }
  void persistDraftNow({ includeAttachments: true })
})

/**
 * Finding Creation Modal Logic
 */
const findingModalActive = ref(false)
const findingSubmitting = ref(false)
const selectedCriterionForFinding = ref(null)
const findingForm = reactive({
  severity: 'medium',
  dueDate: '',
  correctiveAction: '',
})

const openFindingModal = (criterionId) => {
  const crit = flatCriteria.value.find(c => c.id === criterionId)
  if (!crit) return
  
  selectedCriterionForFinding.value = crit
  findingForm.severity = crit.isCritical ? 'high' : 'medium'
  findingForm.correctiveAction = ''
  
  // Set default due_date (e.g., tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  findingForm.dueDate = tomorrow.toISOString().split('T')[0]
  
  findingModalActive.value = true
}

const submitFinding = async () => {
  if (!selectedCriterionForFinding.value || !storeId.value) return
  
  findingSubmitting.value = true
  try {
    const criterionState = getCriterionState(selectedCriterionForFinding.value.id)
    
    await createQcFinding({
      store: storeId.value,
      session_id: activeDraftId.value || null, // Finding linked to draft or temporary session
      criterion_name: selectedCriterionForFinding.value.name,
      severity: findingForm.severity,
      due_date: findingForm.dueDate,
      corrective_action: findingForm.correctiveAction,
      evidence: criterionState.attachments.map(a => ({ ...a })),
      status: 'open'
    })
    
    findingModalActive.value = false
    selectedCriterionForFinding.value = null
    // Suggest refreshing or showing success toast
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không thể tạo yêu cầu khắc phục.'
  } finally {
    findingSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="header max-w-full p-2.5 text-[18px] font-bold text-white mx-4 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500 flex items-center">
      <button @click="goBack" type="button" class="cursor-pointer p-1 mr-2 inline-flex items-center rounded-lg bg-white/40 text-white shadow-2xs hover:bg-white/30 focus:outline-hidden focus:bg-white/30">
        <svg class="shrink-0 size-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      Tạo phiếu QC tại cửa hàng
    </div>

    <div class="page-stack compact mx-4">
      <section class="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start">
          <div class="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5">
            <p class="text-xs text-slate-500">Cửa hàng được kiểm tra</p>
            <h2 class="mt-0.5 truncate text-base font-semibold text-slate-800" :title="storeTitle">{{ storeTitle }}</h2>
            <p v-if="activeDraftId" class="mt-1 text-xs text-blue-700">
              Đang chỉnh phiếu nháp: {{ activeDraftId }}
            </p>
            <p v-if="draftSavedLabel" class="text-xs text-slate-500">Lưu gần nhất: {{ draftSavedLabel }}</p>
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <label class="text-sm text-slate-700">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Loại biên bản QC</span>
              <select
                :id="QC_TEMPLATE_SELECT_ID"
                v-model="form.templateId"
                class="hidden"
                data-hs-select='{
                  "placeholder": "Chọn biên bản QC",
                  "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
                  "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2 px-3 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden",
                  "dropdownClasses": "mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto",
                  "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden",
                  "optionTemplate": "<div class=\"flex justify-between items-center w-full\"><span data-title></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
                  "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-gray-500\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
                }'
              >
                <option v-for="template in qcTemplates" :key="template.id" :value="template.id">
                  {{ template.name }} ({{ template.version }})
                </option>
              </select>
            </label>

            <label class="text-sm text-slate-700">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thời điểm kiểm tra</span>
              <input
                v-model="form.auditedAt"
                type="datetime-local"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>
          </div>
        </div>
      </section>

      <section class="grid gap-3 xl:grid-cols-12">
        <div class="xl:col-span-8 space-y-3">
          <QCCriterionTreeItem
            v-for="criterion in selectedTemplate.criteriaTree"
            :key="criterion.id"
            :criterion="criterion"
            :criteria-states="form.criteriaStates"
            :weekly-checked-ids="weeklyCheckedCriterionIds"
            @update-state="onCriterionUpdate"
            @upload-attachment="onAttachmentUpload"
            @remove-attachment="onAttachmentRemove"
            @open-finding-modal="openFindingModal"
          />
        </div>

        <aside class="xl:col-span-4">
          <section class="sticky top-16 rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
            <h3 class="text-sm font-semibold text-slate-800">Tóm tắt phiếu QC</h3>
            <p class="text-xs text-slate-500">Theo {{ selectedTemplate.name }} ({{ selectedTemplate.version }})</p>
            <p v-if="activeDraftId" class="text-xs text-blue-700">Phiếu nháp đang chỉnh</p>

            <div class="mt-3 space-y-2">
              <div class="rounded-lg bg-slate-50 px-3 py-2">
                <p class="text-xs text-slate-500">Tiêu chí đã đánh giá</p>
                <p class="text-lg font-bold text-slate-800">{{ completedCriteria }}/{{ flatCriteria.length }}</p>
                <p class="text-xs text-slate-500">Hoàn thành {{ completionRate }}%</p>
                <p v-if="remainingCriteria > 0" class="text-xs font-semibold text-rose-600">Còn {{ remainingCriteria }} tiêu chí chưa đánh giá</p>
              </div>
              <div class="rounded-lg bg-slate-50 px-3 py-2">
                <p class="text-xs text-slate-500">Kết quả theo tiêu chí</p>
                <p class="text-sm font-semibold text-emerald-700">Đạt: {{ sessionEvaluation.passedCount }}</p>
                <p class="text-sm font-semibold text-rose-700">Không đạt: {{ sessionEvaluation.failedCount }}</p>
                <p class="text-sm font-semibold text-slate-700">Loại trừ: {{ sessionEvaluation.excludedCount }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 px-3 py-2">
                <p class="text-xs text-slate-500">Điểm tổng</p>
                <p class="text-lg font-bold text-slate-800">{{ sessionEvaluation.totalScore }}/{{ sessionEvaluation.maxScore }}</p>
                <p class="text-xs text-slate-500">Ngưỡng đạt: {{ selectedTemplate.passThreshold }}</p>
              </div>
              <div class="rounded-lg px-3 py-2" :class="resultToneClass">
                <p class="text-xs text-slate-500">Kết quả tạm tính</p>
                <span class="inline-flex rounded-md px-2 py-1 text-xs font-semibold" :class="resultBadgeClass">
                  {{ resultLabel }}
                </span>
                <p v-if="resultReasons.length > 0" class="mt-1 text-xs text-slate-600">
                  {{ resultReasons.join(' • ') }}
                </p>
              </div>
            </div>

            <label class="mt-3 block text-sm text-slate-700">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú tổng</span>
              <textarea
                v-model="form.note"
                rows="3"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700"
                placeholder="Nhập ghi chú chung của phiên QC..."
              ></textarea>
            </label>

            <p v-if="errorMessage" class="mt-3 text-xs text-rose-600">{{ errorMessage }}</p>

            <div class="mt-3 flex justify-end gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                @click="goBack"
              >
                Huỷ
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="saving"
                @click="submitSession"
              >
                {{ saving ? 'Đang lưu...' : 'Lưu phiếu QC' }}
              </button>
            </div>
          </section>
        </aside>
      </section>
    </div>

    <!-- Finding Creation Modal -->
    <div
      v-if="findingModalActive"
      class="fixed inset-0 z-100 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <svg class="size-5 text-rose-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Yêu cầu khắc phục lỗi
          </h3>
          <button @click="findingModalActive = false" class="text-slate-400 hover:text-slate-600">
            <svg class="size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div class="p-3 bg-rose-50 rounded-lg border border-rose-100">
            <p class="text-xs text-rose-600 font-semibold uppercase">Tiêu chí vi phạm</p>
            <p class="text-sm font-medium text-slate-900">{{ selectedCriterionForFinding?.name }}</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-500 uppercase">Mức độ nghiêm trọng</label>
              <select v-model="findingForm.severity" class="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500">
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="critical">Rất nghiêm trọng</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-500 uppercase">Hạn chót khắc phục</label>
              <input v-model="findingForm.dueDate" type="date" class="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase">Yêu cầu hành động cụ thể</label>
            <textarea
              v-model="findingForm.correctiveAction"
              rows="4"
              class="w-full text-sm rounded-lg border-slate-200 focus:ring-blue-500"
              placeholder="Ghi rõ cửa hàng cần làm gì để khắc phục lỗi này..."
            ></textarea>
          </div>

          <div v-if="errorMessage" class="p-3 bg-rose-50 text-rose-600 text-xs rounded-lg border border-rose-100">
            {{ errorMessage }}
          </div>
        </div>

        <div class="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            @click="findingModalActive = false"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-white bg-white/50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            @click="submitFinding"
            :disabled="findingSubmitting || !findingForm.correctiveAction"
            class="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200"
          >
            {{ findingSubmitting ? 'Đang lưu...' : 'Tạo yêu cầu' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
