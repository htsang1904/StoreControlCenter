<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import {
  createQcSession,
  deleteQcDraftSession,
  getQcDraftSessionById,
  getQcTemplateById,
  qcHelpers,
  updateQcDraftSession,
} from '@/services/qc_service'
import QCCriterionTreeItem from '@/components/QCCriterionTreeItem.vue'

const route = useRoute()
const router = useRouter()
const { state } = useApp()

const saving = ref(false)
const errorMessage = ref('')
const MAX_ATTACHMENTS_PER_CRITERION = 3
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024
const AUTOSAVE_DEBOUNCE_MS = 1200
const CRITERION_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chưa chấm' },
  { id: 'fail', label: 'Không đạt' },
]
let autosaveTimer = null

const draftId = computed(() => String(route.query.draftId || '').trim())
const hasDraftContext = computed(() => Boolean(draftId.value))
const activeDraftId = ref('')
const draftCreatedAt = ref('')
const hydratingDraft = ref(false)
const templateData = ref(null)
const activeCriterionFilter = ref('all')

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
    return score >= Number(criterion?.passScore ?? criterion?.maxScore ?? 0) ? 'pass' : 'fail'
  }

  return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
}

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

const initializeCriteriaStates = () => {
  const nextStates = {}
  scorableCriteria.value.forEach((criterion) => {
    nextStates[criterion.id] = {
      status: 'pending',
      score: null,
      note: '',
      attachments: [],
    }
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
  if (!activeDraftId.value || hydratingDraft.value) return

  try {
    await updateQcDraftSession(activeDraftId.value, {
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
}

const scheduleDraftAutosave = async () => {
  if (hydratingDraft.value) return
  if (!activeDraftId.value) return

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
    draftCreatedAt.value = ''
    templateData.value = null
    form.templateId = ''
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
      form.criteriaStates = {}
      errorMessage.value = 'Không tìm thấy phiếu nháp hoặc nháp đã bị xóa.'
      return
    }

    if (Number(draft.storeId) !== Number(storeId.value)) {
      activeDraftId.value = ''
      draftCreatedAt.value = ''
      templateData.value = null
      form.criteriaStates = {}
      errorMessage.value = 'Phiếu nháp không thuộc cửa hàng hiện tại.'
      return
    }

    const nextTemplateId = String(draft.templateId || '')
    if (!nextTemplateId) {
      activeDraftId.value = draft.id
      draftCreatedAt.value = draft.createdAt || draft.updatedAt || ''
      templateData.value = null
      form.criteriaStates = {}
      errorMessage.value = 'Phiếu nháp chưa có biểu mẫu QC hợp lệ.'
      return
    }

    activeDraftId.value = draft.id
    draftCreatedAt.value = draft.createdAt || draft.updatedAt || ''
    form.templateId = nextTemplateId
    form.auditedAt = toLocalDateTimeInput(draft.auditedAt || draft.updatedAt || draft.createdAt)
    form.note = String(draft.note || '')

    const template = await getQcTemplateById(nextTemplateId)
    if (!template) {
      templateData.value = null
      form.criteriaStates = {}
      errorMessage.value = 'Không tải được cấu trúc biểu mẫu QC cho phiếu nháp này.'
      return
    }

    templateData.value = template
    initializeCriteriaStates()

    const incomingStates = draft.criteriaStates && typeof draft.criteriaStates === 'object'
      ? draft.criteriaStates
      : {}
    const nextStates = {}

    scorableCriteria.value.forEach((criterion) => {
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
    errorMessage.value = ''
  } catch (error) {
    activeDraftId.value = ''
    draftCreatedAt.value = ''
    templateData.value = null
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
  await restoreDraftSession()
})

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
  || !activeDraftId.value
  || scorableCriteria.value.length === 0
  || remainingCriteria.value > 0
  || !selectedTemplate.value.activeVersionId
))

const draftStatusLabel = computed(() => (
  activeDraftId.value ? 'Phiếu nháp' : 'Chưa tải nháp'
))

const draftCreatedLabel = computed(() => {
  if (!draftCreatedAt.value) return 'Chưa có ngày tạo'
  return `Tạo ngày ${qcHelpers.toDateLabel(draftCreatedAt.value)}`
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

const matchesCriterionFilter = (criterion) => {
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

const filterCriteriaTree = (nodes = []) => (
  nodes.reduce((acc, node) => {
    const children = Array.isArray(node?.children) ? filterCriteriaTree(node.children) : []
    const hasChildren = Array.isArray(node?.children) && node.children.length > 0

    if (hasChildren) {
      if (children.length > 0) {
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

const visibleCriteriaTree = computed(() => (
  activeCriterionFilter.value === 'all'
    ? selectedTemplate.value.criteriaTree
    : filterCriteriaTree(selectedTemplate.value.criteriaTree)
))

const failedCriteria = computed(() => (
  criterionSnapshots.value.filter((criterion) => criterion.status === 'fail')
))

const progressBarStyle = computed(() => ({
  width: `${completionRate.value}%`,
}))

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

const jumpToFirstFailed = async () => {
  if (!failedCriteria.value.length) return
  activeCriterionFilter.value = 'fail'
  await focusCriterion(failedCriteria.value[0].id)
}



const goBack = () => {
  router.push(`/QC/store/${storeId.value}`)
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

  if (!selectedTemplate.value.activeVersionId) {
    errorMessage.value = 'Biểu mẫu QC chưa có phiên bản phát hành hợp lệ.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  await persistDraftNow({ includeAttachments: true })

  try {
    await createQcSession({
      storeId: storeId.value,
      formVersionId: selectedTemplate.value.activeVersionId,
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
  void persistDraftNow({ includeAttachments: true })
})
</script>

<template>
  <div>
    <div class="page-stack space-y-3 pb-24 xl:pb-0">
      <div class="flex min-w-0 items-center gap-3">
        <button
          @click="goBack"
          type="button"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Quay lại chi tiết QC cửa hàng"
        >
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-semibold text-slate-900 sm:text-xl" :title="storeTitle">
            {{ storeTitle }}
          </h1>
        </div>
      </div>

      <p
        v-if="errorMessage"
        class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600"
      >
        {{ errorMessage }}
      </p>

      <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-4">
          <section class="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-200 px-4 py-3">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <p class="truncate text-base font-semibold text-slate-900">{{ qcFormTitle }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                      :class="activeDraftId ? 'bg-blue-50 text-guta-blue' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ draftStatusLabel }}
                    </span>
                    <span class="text-xs text-slate-500">{{ draftCreatedLabel }}</span>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="filter in CRITERION_FILTERS"
                    :key="filter.id"
                    type="button"
                    class="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    :class="activeCriterionFilter === filter.id ? 'border-guta-blue bg-guta-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'"
                    @click="setCriterionFilter(filter.id)"
                  >
                    {{ filter.label }}
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="!hasDraftContext || !activeDraftId || scorableCriteria.length === 0"
              class="px-6 py-10 text-center"
            >
              <p class="text-sm font-semibold text-slate-700">
                {{ hasDraftContext ? 'Chưa tải được tiêu chí cho phiếu nháp này.' : 'Chưa có phiếu nháp để tiếp tục.' }}
              </p>
            </div>

            <div
              v-else-if="visibleCriteriaTree.length === 0"
              class="px-6 py-10 text-center"
            >
              <p class="text-sm font-semibold text-slate-700">{{ filteredEmptyMessage }}</p>
            </div>

            <div v-else class="px-4 py-2 pb-4 sm:px-5">
              <QCCriterionTreeItem
                v-for="criterion in visibleCriteriaTree"
                :key="criterion.id"
                :criterion="criterion"
                :criteria-states="form.criteriaStates"
                :max-attachments="MAX_ATTACHMENTS_PER_CRITERION"
                @update-state="onCriterionUpdate"
                @upload-attachment="onAttachmentUpload"
                @remove-attachment="onAttachmentRemove"
              />
            </div>
          </section>
        </div>

        <aside>
          <section class="sticky top-16 rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-200 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-slate-900">Tóm tắt</p>
                <p class="text-[11px] font-medium text-slate-500">{{ completedCriteria }}/{{ scorableCriteria.length }} đã chấm</p>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div class="h-full rounded-full bg-guta-blue transition-all duration-300" :style="progressBarStyle"></div>
              </div>
              <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{{ remainingCriteria }} mục còn lại</span>
                <span>{{ completionRate }}%</span>
              </div>
            </div>

            <div class="space-y-4 px-4 py-4">
              <div class="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p class="text-lg font-semibold text-slate-900">{{ sessionEvaluation.passedCount }}</p>
                  <p class="text-[11px] text-slate-500">Đạt</p>
                </div>
                <div>
                  <p class="text-lg font-semibold text-slate-900">{{ sessionEvaluation.failedCount }}</p>
                  <p class="text-[11px] text-slate-500">Lỗi</p>
                </div>
                <div>
                  <p class="text-lg font-semibold text-slate-900">{{ sessionEvaluation.totalScore }}/{{ sessionEvaluation.maxScore }}</p>
                  <p class="text-[11px] text-slate-500">Điểm</p>
                </div>
              </div>

              <button
                v-if="failedCriteria.length > 0"
                type="button"
                class="cursor-pointer w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                @click="jumpToFirstFailed"
              >
                Xem {{ failedCriteria.length }} tiêu chí không đạt
              </button>

              <label class="block text-sm text-slate-700 border-t border-slate-200 pt-4">
                <span class="mb-1.5 block text-xs font-medium text-slate-500">Ghi chú tổng</span>
                <textarea
                  v-model="form.note"
                  rows="4"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  placeholder="Ghi chú thêm"
                ></textarea>
              </label>

              <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  class="cursor-pointer rounded-2xl border border-gray-200 px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  @click="goBack"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-2xl bg-guta-blue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-guta-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="submitDisabled"
                  @click="submitSession"
                >
                  {{ saving ? 'Đang lưu...' : 'Lưu phiếu QC' }}
                </button>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>

    <div class="fixed inset-x-4 bottom-4 z-20 lg:hidden">
      <div class="rounded-[24px] border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-medium text-slate-500">Tiến độ</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">{{ completedCriteria }}/{{ scorableCriteria.length }} tiêu chí • {{ completionRate }}%</p>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-2xl bg-guta-blue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-guta-dark-blue disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitDisabled"
            @click="submitSession"
          >
            {{ saving ? 'Đang lưu...' : 'Lưu phiếu QC' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
