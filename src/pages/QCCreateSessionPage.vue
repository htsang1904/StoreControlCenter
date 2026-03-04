<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { QC_TEMPLATES } from '@/constants/qc_templates'
import {
  createQcDraftSession,
  createQcSession,
  deleteQcDraftSession,
  getQcDraftSessionById,
  listQcSessionsApi,
  qcHelpers,
  updateQcDraftSession,
} from '@/services/qc_service'

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
const qcTemplates = QC_TEMPLATES

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
  templateId: qcTemplates[0].id,
  auditedAt: toLocalDateTimeInput(),
  note: '',
  criteriaStates: {},
})

const selectedTemplate = computed(() => qcTemplates.find((item) => item.id === form.templateId) || qcTemplates[0])

const flatCriteria = computed(() => {
  return selectedTemplate.value.categories.flatMap((category, categoryIndex) =>
    category.criteria.map((criterion, criterionIndex) => ({
      ...criterion,
      mode: criterion.mode === 'pass_fail' ? 'pass_fail' : 'point',
      maxScore: Number(criterion.maxScore || (criterion.mode === 'pass_fail' ? 1 : 0)),
      passScore: Number(criterion.passScore || criterion.maxScore || (criterion.mode === 'pass_fail' ? 1 : 0)),
      critical: Boolean(criterion.critical),
      frequency: criterion.frequency === 'weekly_once' ? 'weekly_once' : 'per_audit',
      categoryId: category.id,
      categoryName: category.name,
      categoryIndex: categoryIndex + 1,
      criterionIndex: criterionIndex + 1,
    }))
  )
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

const buildDraftCriteriaStates = ({ includeAttachments = false } = {}) => {
  return Object.entries(form.criteriaStates || {}).reduce((acc, [criterionId, state]) => {
    const attachments = Array.isArray(state?.attachments) ? state.attachments : []
    acc[String(criterionId)] = {
      status: String(state?.status || 'pending'),
      score: state?.score === null || state?.score === undefined || String(state?.score) === '' ? null : Number(state.score),
      note: String(state?.note || ''),
      // Avoid resending heavy base64 previews on every autosave tick.
      attachments: includeAttachments ? attachments.map((item) => ({ ...item })) : [],
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

const persistDraftNow = async ({ includeAttachments = false } = {}) => {
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

watch(
  () => form.templateId,
  () => {
    initializeCriteriaStates()
    refreshWeeklyCriteriaStates()
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

const attachmentInputId = (criterionId) => `criterion-attachment-${criterionId}`

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

const onCriterionFileChange = async (criterionId, event) => {
  const input = event?.target
  const selectedFiles = Array.from(input?.files || [])
  if (selectedFiles.length === 0) return

  errorMessage.value = ''
  const criterionState = ensureCriterionState(criterionId)
  const availableSlots = MAX_ATTACHMENTS_PER_CRITERION - criterionState.attachments.length

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
      })
    } catch (error) {
      issues.push(error?.message || `Không đọc được ảnh ${file.name}`)
    }
  }

  if (nextAttachments.length > 0) {
    criterionState.attachments = [...criterionState.attachments, ...nextAttachments]
  }

  if (selectedFiles.length > availableSlots) {
    issues.push(`Chỉ thêm ${availableSlots}/${selectedFiles.length} ảnh do giới hạn tối đa`)
  }

  if (issues.length > 0) {
    errorMessage.value = issues[0]
  }

  if (input) input.value = ''
}

const removeCriterionAttachment = (criterionId, attachmentId) => {
  const criterionState = ensureCriterionState(criterionId)
  criterionState.attachments = criterionState.attachments.filter((item) => item.id !== attachmentId)
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

const setPassFailResult = (criterion, status) => {
  errorMessage.value = ''
  const state = ensureCriterionState(criterion.id)
  if (state.status === 'skipped_weekly') return

  if (status === 'na') {
    if (state.status === 'na') {
      state.status = 'pending'
      state.score = null
      return
    }
    state.status = 'na'
    state.score = null
    return
  }

  state.status = status
  state.score = status === 'pass' ? 1 : 0
}

const setPointScore = (criterion, value) => {
  errorMessage.value = ''
  const state = ensureCriterionState(criterion.id)
  if (state.status === 'skipped_weekly') return

  const max = Number(criterion.maxScore || 0)
  if (value === '' || value === null || value === undefined) {
    state.score = null
    state.status = 'pending'
    return
  }

  const next = Number(value)
  if (!Number.isFinite(next)) {
    state.score = null
    state.status = 'pending'
    return
  }

  state.score = Math.min(Math.max(next, 0), max)
  state.status = 'pending'
}

const markPointNA = (criterion) => {
  errorMessage.value = ''
  const state = ensureCriterionState(criterion.id)
  if (state.status === 'skipped_weekly') return
  if (state.status === 'na') {
    state.status = 'pending'
    state.score = null
    return
  }
  state.status = 'na'
  state.score = null
}

const updateCriterionNote = (criterionId, value) => {
  ensureCriterionState(criterionId).note = String(value || '')
}

const criteriaPayload = computed(() => {
  return flatCriteria.value.map((criterion) => {
    const state = getCriterionState(criterion.id)
    const result = getCriterionResult(criterion)
    const isPoint = criterion.mode === 'point'

    return {
      id: criterion.id,
      name: criterion.name,
      category: criterion.categoryName,
      mode: criterion.mode,
      status: result,
      score: result === 'na' || result === 'skipped_weekly'
        ? null
        : (isPoint
          ? (state.score === null || state.score === undefined || String(state.score) === '' ? null : Number(state.score))
          : (result === 'pass' ? 1 : (result === 'fail' ? 0 : null))),
      maxScore: isPoint ? Number(criterion.maxScore || 0) : 1,
      passScore: isPoint ? Number(criterion.passScore || criterion.maxScore || 0) : 1,
      critical: Boolean(criterion.critical),
      applicable: result !== 'na',
      frequency: criterion.frequency,
      note: String(state.note || '').trim(),
      attachments: Array.isArray(state.attachments)
        ? state.attachments.map((attachment) => ({ ...attachment }))
        : [],
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

const categoryRows = computed(() => {
  return selectedTemplate.value.categories.map((category, categoryIndex) => {
    const criteria = category.criteria.map((criterion, criterionIndex) => {
      const normalizedCriterion = {
        ...criterion,
        id: criterion.id,
        mode: criterion.mode === 'pass_fail' ? 'pass_fail' : 'point',
        maxScore: Number(criterion.maxScore || (criterion.mode === 'pass_fail' ? 1 : 0)),
        passScore: Number(criterion.passScore || criterion.maxScore || (criterion.mode === 'pass_fail' ? 1 : 0)),
        critical: Boolean(criterion.critical),
        frequency: criterion.frequency === 'weekly_once' ? 'weekly_once' : 'per_audit',
        categoryIndex: categoryIndex + 1,
        criterionIndex: criterionIndex + 1,
      }

      const state = getCriterionState(criterion.id)
      const result = getCriterionResult(normalizedCriterion)

      return {
        ...normalizedCriterion,
        result,
        score: state.score,
        note: state.note,
        attachments: state.attachments,
      }
    })

    return {
      ...category,
      index: categoryIndex + 1,
      criteria,
      checked: criteria.filter((item) => item.result !== 'pending').length,
      passed: criteria.filter((item) => item.result === 'pass').length,
      failed: criteria.filter((item) => item.result === 'fail').length,
      excluded: criteria.filter((item) => item.result === 'na' || item.result === 'skipped_weekly').length,
      pending: criteria.filter((item) => item.result === 'pending').length,
    }
  })
})

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

const reasonLabels = {
  incomplete: 'Còn tiêu chí chưa chấm',
  failed: 'Có tiêu chí không đạt',
  critical: 'Có tiêu chí critical chưa đạt',
  threshold: 'Chưa đạt ngưỡng điểm',
}

const resultReasons = computed(() => {
  return (sessionEvaluation.value.reasons || []).map((item) => reasonLabels[item] || item)
})

const draftSavedLabel = computed(() => {
  if (!draftSavedAt.value) return ''
  return qcHelpers.toDateLabel(draftSavedAt.value)
})

const criterionBadgeClass = (status) => {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-700'
  if (status === 'fail') return 'bg-rose-100 text-rose-700'
  if (status === 'na') return 'bg-slate-200 text-slate-700'
  if (status === 'skipped_weekly') return 'bg-violet-100 text-violet-700'
  return 'bg-amber-100 text-amber-700'
}

const criterionBadgeLabel = (status) => {
  if (status === 'pass') return 'Đạt'
  if (status === 'fail') return 'Không đạt'
  if (status === 'na') return 'N/A'
  if (status === 'skipped_weekly') return 'Đã chấm tuần này'
  return 'Chưa chọn'
}

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

    if (activeDraftId.value) {
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
          <article
            v-for="category in categoryRows"
            :key="category.id"
            class="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs"
          >
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-sm font-semibold text-slate-800">
                  Hạng mục {{ String(category.index).padStart(2, '0') }} · {{ category.name }}
                </h3>
                <p class="text-xs text-slate-500">
                  Đã đánh giá {{ category.checked }}/{{ category.criteria.length }} • Đạt {{ category.passed }} • Không đạt {{ category.failed }} • Loại trừ {{ category.excluded }}
                </p>
              </div>
              <span class="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {{ category.checked }}/{{ category.criteria.length }}
              </span>
            </div>

            <div class="mt-2.5 space-y-2">
              <div
                v-for="criterion in category.criteria"
                :key="criterion.id"
                class="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {{ String(category.index).padStart(2, '0') }}.{{ String(criterion.criterionIndex).padStart(2, '0') }}
                  </span>
                  <p class="text-sm font-semibold text-slate-800">{{ criterion.name }}</p>
                  <span
                    class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    :class="criterionBadgeClass(criterion.result)"
                  >
                    {{ criterionBadgeLabel(criterion.result) }}
                  </span>
                  <span
                    v-if="criterion.frequency === 'weekly_once'"
                    class="inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                  >
                    1 lần / tuần
                  </span>
                  <span
                    v-if="criterion.mode === 'point'"
                    class="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                  >
                    Điểm đạt ≥ {{ criterion.passScore }}/{{ criterion.maxScore }}
                  </span>
                  <span
                    v-else
                    class="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                  >
                    Đạt / Không đạt
                  </span>
                </div>

                <div class="mt-2">
                  <div v-if="criterion.mode === 'pass_fail'" class="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      class="h-9 w-28 cursor-pointer rounded-lg border text-xs font-semibold transition-colors"
                      :disabled="criterion.result === 'skipped_weekly'"
                      :class="criterion.result === 'pass' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'"
                      @click="setPassFailResult(criterion, 'pass')"
                    >
                      Đạt
                    </button>
                    <button
                      type="button"
                      class="h-9 w-28 cursor-pointer rounded-lg border text-xs font-semibold transition-colors"
                      :disabled="criterion.result === 'skipped_weekly'"
                      :class="criterion.result === 'fail' ? 'border-rose-600 bg-rose-600 text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'"
                      @click="setPassFailResult(criterion, 'fail')"
                    >
                      Không đạt
                    </button>
                    <button
                      type="button"
                      class="h-9 w-24 cursor-pointer rounded-lg border text-xs font-semibold transition-colors"
                      :disabled="criterion.result === 'skipped_weekly'"
                      :class="criterion.result === 'na' ? 'border-slate-500 bg-slate-500 text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'"
                      @click="setPassFailResult(criterion, 'na')"
                    >
                      {{ criterion.result === 'na' ? 'Bỏ N/A' : 'N/A' }}
                    </button>
                  </div>

                  <div v-else class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <input
                      :value="criterion.score"
                      type="number"
                      min="0"
                      :max="criterion.maxScore"
                      class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      placeholder="Nhập điểm"
                      :disabled="criterion.result === 'skipped_weekly'"
                      @input="setPointScore(criterion, $event.target.value)"
                    />
                    <button
                      type="button"
                      class="h-9 w-24 cursor-pointer rounded-lg border text-xs font-semibold transition-colors"
                      :disabled="criterion.result === 'skipped_weekly'"
                      :class="criterion.result === 'na' ? 'border-slate-500 bg-slate-500 text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'"
                      @click="markPointNA(criterion)"
                    >
                      {{ criterion.result === 'na' ? 'Bỏ N/A' : 'N/A' }}
                    </button>
                  </div>
                </div>

                <label class="mt-2 block text-sm text-slate-700">
                  <span class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nội dung / nhận xét</span>
                  <textarea
                    :value="criterion.note"
                    rows="2"
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700"
                    placeholder="Nhập nội dung kiểm tra hoặc mô tả tình trạng..."
                    @input="updateCriterionNote(criterion.id, $event.target.value)"
                  ></textarea>
                </label>

                <div class="mt-2">
                  <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500" :for="attachmentInputId(criterion.id)">
                    Ảnh minh chứng
                  </label>
                  <input
                    :id="attachmentInputId(criterion.id)"
                    type="file"
                    accept="image/*"
                    multiple
                    class="block w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-600 file:me-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                    @change="onCriterionFileChange(criterion.id, $event)"
                  />
                  <p class="mt-1 text-[11px] text-slate-500">
                    Tối đa {{ MAX_ATTACHMENTS_PER_CRITERION }} ảnh, mỗi ảnh không quá {{ formatFileSize(MAX_ATTACHMENT_SIZE_BYTES) }}.
                  </p>

                  <div v-if="criterion.attachments.length > 0" class="mt-2 grid gap-1.5 sm:grid-cols-3">
                    <div
                      v-for="attachment in criterion.attachments"
                      :key="attachment.id"
                      class="rounded-lg border border-slate-200 bg-white p-2"
                    >
                      <img
                        :src="attachment.previewUrl"
                        :alt="attachment.name"
                        class="h-20 w-full rounded-md border border-slate-200 object-cover"
                      >
                      <div class="mt-1 flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate text-[11px] font-medium text-slate-700" :title="attachment.name">{{ attachment.name }}</p>
                          <p class="text-[11px] text-slate-500">{{ formatFileSize(attachment.size) }}</p>
                        </div>
                        <button
                          type="button"
                          class="cursor-pointer rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          @click="removeCriterionAttachment(criterion.id, attachment.id)"
                        >
                          Xoá
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
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
  </div>
</template>
