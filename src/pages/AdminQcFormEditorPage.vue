<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminQcCriterionBuilderItem from '@/components/AdminQcCriterionBuilderItem.vue'
import {
  createAdminQcForm,
  getAdminQcFormById,
  updateAdminQcForm,
} from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const savingMode = ref('')
const loadingForm = ref(false)
const loadError = ref('')
const activeStep = ref(1)
const showMetadataValidation = ref(false)
const showStructureValidation = ref(false)

let nodeSeed = 0

const FORM_STEPS = [
  {
    id: 1,
    title: 'Thiết lập',
    description: 'Chốt metadata biểu mẫu',
  },
  {
    id: 2,
    title: 'Cây tiêu chí',
    description: 'Dựng nhóm và tiêu chí lá',
  },
  {
    id: 3,
    title: 'Rà soát',
    description: 'Kiểm tra trước khi phát hành',
  },
]

const ORDERING_LABEL_PATTERN = /^[A-Z0-9]+$/

const normalizeOrderingLabel = (value) => String(value || '').trim().toUpperCase()

const extractOrderingSegment = (value) => {
  const parts = String(value || '')
    .split('.')
    .map((part) => String(part || '').trim())
    .filter(Boolean)

  return parts[parts.length - 1] || ''
}

const resolveGroupOrderingLabel = (overrides = {}) => {
  const rawValue = overrides.orderingLabel ?? overrides.orderingSegment ?? extractOrderingSegment(overrides.ordering)
  return normalizeOrderingLabel(rawValue)
}

const getNodeOrderingSegment = (node, index) => {
  const defaultSegment = String(index + 1)
  if (node?.nodeType !== 'group') return defaultSegment

  const customSegment = normalizeOrderingLabel(node.orderingLabel)
  return customSegment || defaultSegment
}

const createCriterionNode = (overrides = {}) => {
  nodeSeed += 1
  return {
    id: overrides.id || `criterion-node-${nodeSeed}`,
    nodeType: 'criterion',
    name: overrides.name || '',
    description: overrides.description || '',
    mode: overrides.mode || 'point',
    maxScore: overrides.maxScore ?? 10,
    children: [],
  }
}

const createGroupNode = (overrides = {}) => {
  nodeSeed += 1
  const children = Array.isArray(overrides.children) && overrides.children.length
    ? overrides.children.map((child) => createBuilderNode(child))
    : [createCriterionNode()]

  return {
    id: overrides.id || `group-node-${nodeSeed}`,
    nodeType: 'group',
    orderingLabel: resolveGroupOrderingLabel(overrides),
    name: overrides.name || '',
    description: overrides.description || '',
    mode: 'point',
    maxScore: 0,
    children,
  }
}

const createBuilderNode = (overrides = {}) => {
  if (overrides?.nodeType === 'group') return createGroupNode(overrides)
  return createCriterionNode(overrides)
}

const createStarterTree = () => ([createGroupNode()])

const qcForm = reactive({
  id: null,
  code: '',
  name: '',
  description: '',
  passThreshold: 40,
  isActive: true,
  criteriaTree: createStarterTree(),
})

const currentVersion = reactive({
  versionNo: 'v1.0',
  status: 'draft',
})

const isEditMode = computed(() => route.name === 'Admin QC Form Edit')
const isSaving = computed(() => Boolean(savingMode.value))
const isSavingDraft = computed(() => savingMode.value === 'draft')
const isPublishing = computed(() => savingMode.value === 'published')

const parseVersionNo = (value) => {
  const matched = String(value || '').trim().match(/^v(\d+)(?:\.(\d+))?$/i)
  if (!matched) return { major: 1, minor: 0 }

  return {
    major: Number(matched[1]) || 1,
    minor: Number(matched[2]) || 0,
  }
}

const nextMinorVersionNo = (value) => {
  const parsed = parseVersionNo(value)
  return `v${parsed.major}.${parsed.minor + 1}`
}

const currentWorkingVersion = computed(() => {
  if (!isEditMode.value) return 'v1.0'
  if (currentVersion.status === 'draft') return currentVersion.versionNo || 'v1.0'
  return nextMinorVersionNo(currentVersion.versionNo || 'v1.0')
})

const pageTitle = computed(() => (isEditMode.value ? 'Chỉnh sửa biểu mẫu QC' : 'Tạo biểu mẫu QC'))
const pageDescription = computed(() => (
  isEditMode.value
    ? 'Chỉnh metadata, cập nhật cây tiêu chí và lưu version làm việc.'
    : 'Thiết lập biểu mẫu rồi dựng cây tiêu chí để lưu version đầu tiên.'
))

const saveDraftLabel = computed(() => (isSavingDraft.value ? 'Đang lưu nháp...' : 'Lưu nháp'))
const publishLabel = computed(() => (isPublishing.value ? 'Đang phát hành...' : 'Phát hành'))
const customInputClass = 'py-2.5 tablet:py-3 px-4 block w-full border border-gray-200 rounded-lg bg-white text-slate-700 tablet:text-sm focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-100'
const customTextareaClass = 'py-2 tablet:py-2.5 px-3 block w-full border border-gray-200 rounded-lg bg-white text-slate-700 tablet:text-sm focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-100'
const validationInputClass = 'app-input-invalid'
const validationMessageClass = 'app-field-error'

const flattenCriteriaTreeForReview = (nodes = [], path = []) => {
  return nodes.flatMap((node, index) => {
    const orderingParts = [...path, getNodeOrderingSegment(node, index)]
    const ordering = orderingParts.join('.')
    const row = {
      id: node.id,
      ordering,
      ancestorOrderings: orderingParts.slice(0, -1).map((_, ancestorIndex) => orderingParts.slice(0, ancestorIndex + 1).join('.')),
      depth: orderingParts.length,
      nodeType: node.nodeType,
      name: String(node.name || '').trim() || 'Chưa đặt tên',
      description: String(node.description || '').trim(),
      mode: String(node.mode || 'point'),
      maxScore: node.nodeType === 'criterion'
        ? (String(node.mode || 'point') === 'pass_fail' ? 1 : Number(node.maxScore || 0))
        : 0,
      childCount: Array.isArray(node.children) ? node.children.length : 0,
    }

    const children = Array.isArray(node.children) ? flattenCriteriaTreeForReview(node.children, orderingParts) : []
    return [row, ...children]
  })
}

const reviewRows = computed(() => flattenCriteriaTreeForReview(qcForm.criteriaTree))
const expandedReviewGroupOrderings = ref(new Set())

const isReviewGroupExpanded = (ordering) => expandedReviewGroupOrderings.value.has(String(ordering))

const toggleReviewGroup = (ordering) => {
  const next = new Set(expandedReviewGroupOrderings.value)
  const key = String(ordering)

  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }

  expandedReviewGroupOrderings.value = next
}

const visibleReviewRows = computed(() => {
  const rows = reviewRows.value
  const orderingMap = new Map(rows.map((row) => [row.ordering, row]))

  return rows.filter((row) => row.ancestorOrderings.every((ordering) => {
    const ancestor = orderingMap.get(ordering)
    if (!ancestor || ancestor.nodeType !== 'group') return true
    return isReviewGroupExpanded(ordering)
  }))
})

const getReviewCriterionSummary = (row) => (
  row.mode === 'pass_fail'
    ? 'Đạt / Không đạt'
    : `${Number(row.maxScore || 0)} điểm`
)

const getReviewRowIndent = (depth) => `${Math.max(depth - 1, 0) * 14}px`

const stepItems = computed(() => FORM_STEPS.map((step) => ({
  ...step,
  isActive: step.id === activeStep.value,
  isCompleted: step.id < activeStep.value,
})))

const getMetadataValidationErrors = () => {
  const errors = {}
  const formCode = String(qcForm.code || '').trim().toUpperCase()
  const formName = String(qcForm.name || '').trim()
  const formDescription = String(qcForm.description || '').trim()
  const rawThreshold = qcForm.passThreshold

  if (!formCode) {
    errors.code = 'Mã biểu mẫu là bắt buộc'
  } else if (!/^[A-Z0-9_-]+$/.test(formCode)) {
    errors.code = 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang'
  }

  if (!formName) {
    errors.name = 'Tên biểu mẫu là bắt buộc'
  }

  if (rawThreshold === '' || rawThreshold === null || rawThreshold === undefined) {
    errors.passThreshold = 'Ngưỡng đạt là bắt buộc'
  } else {
    const threshold = Number(rawThreshold)
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      errors.passThreshold = 'Ngưỡng đạt phải nằm trong khoảng từ 0 đến 100'
    }
  }

  if (!formDescription) {
    errors.description = 'Mô tả là bắt buộc'
  }

  return errors
}

const metadataValidationErrors = computed(() => getMetadataValidationErrors())

const getMetadataValidationError = () => (
  metadataValidationErrors.value.code
  || metadataValidationErrors.value.name
  || metadataValidationErrors.value.passThreshold
  || metadataValidationErrors.value.description
  || ''
)

const resetFormState = () => {
  activeStep.value = 1
  showMetadataValidation.value = false
  showStructureValidation.value = false
  expandedReviewGroupOrderings.value = new Set()
  qcForm.id = null
  qcForm.code = ''
  qcForm.name = ''
  qcForm.description = ''
  qcForm.passThreshold = 40
  qcForm.isActive = true
  qcForm.criteriaTree.splice(0, qcForm.criteriaTree.length, ...createStarterTree())
  currentVersion.versionNo = 'v1.0'
  currentVersion.status = 'draft'
}

const applyFormDetail = (item = {}) => {
  activeStep.value = 1
  showMetadataValidation.value = false
  showStructureValidation.value = false
  expandedReviewGroupOrderings.value = new Set()
  qcForm.id = Number(item?.id || 0) || null
  qcForm.code = String(item?.code || '')
  qcForm.name = String(item?.name || '')
  qcForm.description = String(item?.description || '')
  qcForm.passThreshold = Number(item?.latestVersion?.passThreshold ?? 40)
  qcForm.isActive = item?.isActive !== false

  const criteriaTree = Array.isArray(item?.latestVersion?.criteriaTree) && item.latestVersion.criteriaTree.length
    ? item.latestVersion.criteriaTree.map((node) => createBuilderNode(node))
    : createStarterTree()

  qcForm.criteriaTree.splice(0, qcForm.criteriaTree.length, ...criteriaTree)
  currentVersion.versionNo = String(item?.latestVersion?.versionNo || 'v1.0')
  currentVersion.status = String(item?.latestVersion?.status || 'draft')
}

const findNodeLocation = (nodes, nodeId) => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node.id === nodeId) {
      return { list: nodes, index, node }
    }

    if (node.nodeType === 'group' && node.children.length) {
      const nestedLocation = findNodeLocation(node.children, nodeId)
      if (nestedLocation) return nestedLocation
    }
  }

  return null
}

const addTopLevelGroup = () => {
  qcForm.criteriaTree.push(createGroupNode())
}

const addTopLevelCriterion = () => {
  qcForm.criteriaTree.push(createCriterionNode())
}

const addChildNode = (parentId, nodeType) => {
  const location = findNodeLocation(qcForm.criteriaTree, parentId)
  if (!location?.node || location.node.nodeType !== 'group') return

  if (nodeType === 'group') {
    location.node.children.push(createGroupNode())
    return
  }

  location.node.children.push(createCriterionNode())
}

const removeNode = (nodeId) => {
  const location = findNodeLocation(qcForm.criteriaTree, nodeId)
  if (!location) return
  location.list.splice(location.index, 1)
}

const moveNode = (nodeId, direction) => {
  const location = findNodeLocation(qcForm.criteriaTree, nodeId)
  if (!location) return

  const targetIndex = direction === 'up' ? location.index - 1 : location.index + 1
  if (targetIndex < 0 || targetIndex >= location.list.length) return

  const [movedNode] = location.list.splice(location.index, 1)
  location.list.splice(targetIndex, 0, movedNode)
}

const serializeCriteriaTree = (nodes = []) => (
  nodes.map((node) => {
    if (node.nodeType === 'group') {
      const orderingLabel = normalizeOrderingLabel(node.orderingLabel)
      return {
        nodeType: 'group',
        ...(orderingLabel ? { orderingLabel } : {}),
        name: String(node.name || '').trim(),
        description: String(node.description || '').trim(),
        children: serializeCriteriaTree(node.children),
      }
    }

    return {
      nodeType: 'criterion',
      name: String(node.name || '').trim(),
      description: String(node.description || '').trim(),
      mode: String(node.mode || 'point'),
      maxScore: node.mode === 'pass_fail' ? 1 : Number(node.maxScore || 0),
    }
  })
)

const pushTreeValidationError = (bucket, messages, nodeId, field, message) => {
  if (!bucket[nodeId]) {
    bucket[nodeId] = {}
  }

  if (!bucket[nodeId][field]) {
    bucket[nodeId][field] = message
    messages.push(message)
  }
}

const collectTreeValidation = (nodes = [], parentLabel = 'Mục gốc') => {
  const nodeErrors = {}
  const messages = []

  if (!nodes.length) {
    return {
      nodeErrors,
      messages: [`${parentLabel} cần ít nhất một nhóm hoặc tiêu chí`],
    }
  }

  const siblingSegments = new Set()

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const positionSegment = getNodeOrderingSegment(node, index)
    const positionLabel = `${parentLabel}.${positionSegment}`
    const nodeName = String(node.name || '').trim()
    const orderingLabel = node.nodeType === 'group' ? normalizeOrderingLabel(node.orderingLabel) : ''

    if (orderingLabel && !ORDERING_LABEL_PATTERN.test(orderingLabel)) {
      pushTreeValidationError(
        nodeErrors,
        messages,
        node.id,
        'orderingLabel',
        `Mã thứ tự của nhóm ở ${positionLabel} chỉ được chứa chữ và số`,
      )
    }

    if (siblingSegments.has(positionSegment)) {
      pushTreeValidationError(
        nodeErrors,
        messages,
        node.id,
        'orderingLabel',
        `Mã thứ tự "${positionSegment}" đang bị trùng trong ${parentLabel}`,
      )
    } else {
      siblingSegments.add(positionSegment)
    }

    if (!nodeName) {
      pushTreeValidationError(
        nodeErrors,
        messages,
        node.id,
        'name',
        `${node.nodeType === 'group' ? 'Tên nhóm' : 'Tên tiêu chí'} ở ${positionLabel} là bắt buộc`,
      )
    }

    if (node.nodeType === 'group') {
      if (!Array.isArray(node.children) || !node.children.length) {
        pushTreeValidationError(
          nodeErrors,
          messages,
          node.id,
          'children',
          `Nhóm "${nodeName || positionLabel}" cần ít nhất một mục con`,
        )
        continue
      }

      const nestedValidation = collectTreeValidation(node.children, nodeName || positionLabel)
      Object.entries(nestedValidation.nodeErrors).forEach(([childId, errors]) => {
        nodeErrors[childId] = errors
      })
      messages.push(...nestedValidation.messages)
      continue
    }

    const mode = String(node.mode || '').trim()
    if (!mode) {
      pushTreeValidationError(
        nodeErrors,
        messages,
        node.id,
        'mode',
        `Tiêu chí "${nodeName || positionLabel}" cần chọn kiểu chấm`,
      )
    }

    if (mode === 'point') {
      const maxScore = Number(node.maxScore)
      if (!Number.isFinite(maxScore) || maxScore <= 0) {
        pushTreeValidationError(
          nodeErrors,
          messages,
          node.id,
          'maxScore',
          `Tiêu chí "${nodeName || positionLabel}" cần điểm tối đa lớn hơn 0`,
        )
      }
    }
  }

  return {
    nodeErrors,
    messages,
  }
}

const criteriaValidation = computed(() => collectTreeValidation(qcForm.criteriaTree, 'Biểu mẫu'))
const getStructureValidationError = () => criteriaValidation.value.messages[0] || ''
const visibleCriteriaValidationMap = computed(() => (showStructureValidation.value ? criteriaValidation.value.nodeErrors : {}))

const validateForm = () => getMetadataValidationError() || getStructureValidationError()

const revealMetadataValidation = () => {
  showMetadataValidation.value = true
}

const revealStructureValidation = () => {
  showStructureValidation.value = true
}

const revealAllValidation = () => {
  revealMetadataValidation()
  revealStructureValidation()
}

const loadFormDetail = async () => {
  if (!isEditMode.value) {
    resetFormState()
    return
  }

  const formId = Number(route.params.id || 0)
  if (!formId) {
    loadError.value = 'Mã biểu mẫu không hợp lệ'
    return
  }

  loadingForm.value = true
  loadError.value = ''

  try {
    const detail = await getAdminQcFormById(formId)
    applyFormDetail(detail)
  } catch (error) {
    loadError.value = error?.response?.data?.message || error?.message || 'Không tải được biểu mẫu để chỉnh sửa'
  } finally {
    loadingForm.value = false
  }
}

const submitForm = async (targetStatus) => {
  if (isSaving.value) return

  revealAllValidation()
  const validationError = validateForm()
  if (validationError) {
    toast.error(validationError)
    return
  }

  savingMode.value = targetStatus
  try {
    const payload = {
      code: String(qcForm.code || '').trim().toUpperCase(),
      name: String(qcForm.name || '').trim(),
      description: String(qcForm.description || '').trim(),
      passThreshold: Number(qcForm.passThreshold || 0),
      isActive: qcForm.isActive,
      status: targetStatus,
      criteria: serializeCriteriaTree(qcForm.criteriaTree),
    }

    let detail
    if (isEditMode.value && qcForm.id) {
      detail = await updateAdminQcForm(qcForm.id, payload)
      toast.success(targetStatus === 'published' ? 'Phát hành biểu mẫu QC thành công' : 'Lưu nháp biểu mẫu QC thành công')
    } else {
      detail = await createAdminQcForm(payload)
      toast.success(targetStatus === 'published' ? 'Tạo và phát hành biểu mẫu QC thành công' : 'Tạo biểu mẫu QC dạng nháp thành công')
    }

    applyFormDetail(detail)

    if (targetStatus === 'published') {
      router.replace(`/tools/qc-forms/${detail.id}`)
      return
    }

    if (!isEditMode.value) {
      router.replace(`/tools/qc-forms/${detail.id}/edit`)
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể lưu biểu mẫu QC'
    toast.error(message)
  } finally {
    savingMode.value = ''
  }
}

const goToPreviousStep = () => {
  activeStep.value = Math.max(activeStep.value - 1, 1)
}

const goToNextStep = () => {
  if (activeStep.value === 1) {
    revealMetadataValidation()
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }
  }

  if (activeStep.value === 2) {
    revealStructureValidation()
    const structureError = getStructureValidationError()
    if (structureError) {
      toast.error(structureError)
      return
    }
  }

  activeStep.value = Math.min(activeStep.value + 1, FORM_STEPS.length)
}

const openStep = (targetStep) => {
  if (targetStep <= activeStep.value) {
    activeStep.value = targetStep
    return
  }

  if (targetStep === 2) {
    revealMetadataValidation()
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }
  }

  if (targetStep === 3) {
    revealMetadataValidation()
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }

    revealStructureValidation()
    const structureError = getStructureValidationError()
    if (structureError) {
      toast.error(structureError)
      return
    }
  }

  activeStep.value = targetStep
}

const goBack = () => {
  if (isEditMode.value && qcForm.id) {
    router.push(`/tools/qc-forms/${qcForm.id}`)
    return
  }

  router.push('/tools/qc-forms')
}

onMounted(async () => {
  await loadFormDetail()
})
</script>

<template>
  <div class="page-stack mx-auto max-w-6xl space-y-4">
    <section class="rounded-xl border border-slate-200 bg-white px-5 py-5 tablet:px-6">
      <div class="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <button
            type="button"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Quay lại danh sách biểu mẫu QC"
            @click="goBack"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>

          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold text-slate-900 tablet:text-xl">
              {{ isEditMode ? (qcForm.name || pageTitle) : pageTitle }}
            </h1>
            <p class="mt-1 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
          </div>
        </div>

        <div class="w-full tablet:w-auto tablet:shrink-0">
          <button
            type="button"
            class="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 tablet:w-auto"
            :disabled="isSaving"
            @click="submitForm('draft')"
          >
            <span class="material-symbols-outlined text-[18px]" :class="isSavingDraft ? 'animate-spin' : ''">
              {{ isSavingDraft ? 'autorenew' : 'save' }}
            </span>
            {{ saveDraftLabel }}
          </button>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="app-state-banner">
      {{ loadError }}
    </p>

    <div v-else-if="loadingForm" class="app-state-panel app-state-panel--center">
      <div class="app-state-stack">
        <div class="app-state-icon mx-auto">
          <span class="material-symbols-outlined text-[24px]">edit_note</span>
        </div>
        <p class="app-state-title">Đang tải biểu mẫu...</p>
        <p class="app-state-body">Metadata và cây tiêu chí sẽ xuất hiện sau khi hệ thống hoàn tất đồng bộ dữ liệu.</p>
      </div>
    </div>

    <section v-else class="rounded-xl border border-slate-200 bg-white">
      <div class="space-y-6 px-6 py-6">
        <ol class="grid gap-3 tablet:grid-cols-3">
          <li v-for="step in stepItems" :key="step.id">
            <button
              type="button"
              class="flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition"
              :class="step.isActive ? 'border-slate-300 bg-slate-50' : (step.isCompleted ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50')"
              @click="openStep(step.id)"
            >
              <span
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                :class="step.isActive || step.isCompleted ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'"
              >
                {{ step.id }}
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-900">{{ step.title }}</span>
                <span class="mt-1 block text-xs leading-5 text-slate-500">{{ step.description }}</span>
              </span>
            </button>
          </li>
        </ol>

        <div class="border-t border-slate-200 pt-6">
          <section v-if="activeStep === 1" class="space-y-6">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bước 1</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Thiết lập biểu mẫu</h3>
              <p class="mt-2 text-sm leading-6 text-slate-500">
                Chốt định danh và thông tin nền trước khi đi sang bước dựng cây tiêu chí.
              </p>
            </div>

            <div class="grid gap-5 tablet:grid-cols-2">
              <label class="space-y-2 tablet:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Mã biểu mẫu</span>
                <input
                  v-model="qcForm.code"
                  type="text"
                  :disabled="isEditMode"
                  :class="[customInputClass, showMetadataValidation && metadataValidationErrors.code ? validationInputClass : '']"
                  placeholder="VD: QC_STORE_STANDARD"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.code" :class="validationMessageClass">
                  {{ metadataValidationErrors.code }}
                </p>
                <p class="text-xs text-slate-400">
                  {{ isEditMode ? 'Mã biểu mẫu được khóa để giữ định danh ổn định cho các version đã có.' : 'Dùng chữ in hoa, số, gạch dưới hoặc gạch ngang.' }}
                </p>
              </label>

              <label class="space-y-2 tablet:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Tên biểu mẫu</span>
                <input
                  v-model="qcForm.name"
                  type="text"
                  :class="[customInputClass, showMetadataValidation && metadataValidationErrors.name ? validationInputClass : '']"
                  placeholder="VD: QC cửa hàng chuẩn"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.name" :class="validationMessageClass">
                  {{ metadataValidationErrors.name }}
                </p>
              </label>

              <label class="space-y-2 tablet:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Ngưỡng đạt (%)</span>
                <input
                  v-model.number="qcForm.passThreshold"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  :class="[customInputClass, 'no-spin', showMetadataValidation && metadataValidationErrors.passThreshold ? validationInputClass : '']"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.passThreshold" :class="validationMessageClass">
                  {{ metadataValidationErrors.passThreshold }}
                </p>
              </label>

              <label class="flex items-center gap-3 tablet:col-span-1 tablet:pt-8">
                <input v-model="qcForm.isActive" type="checkbox" class="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300" />
                <span class="text-sm font-medium text-slate-700">Kích hoạt biểu mẫu sau khi lưu</span>
              </label>

              <label class="space-y-2 tablet:col-span-2">
                <span class="text-sm font-semibold text-slate-700">Mô tả</span>
                <textarea
                  v-model="qcForm.description"
                  rows="4"
                  :class="[customTextareaClass, showMetadataValidation && metadataValidationErrors.description ? validationInputClass : '']"
                  placeholder="Mô tả phạm vi áp dụng và mục tiêu của biểu mẫu"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.description" :class="validationMessageClass">
                  {{ metadataValidationErrors.description }}
                </p>
              </label>
            </div>
          </section>

          <section v-else-if="activeStep === 2" class="space-y-5">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bước 2</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Dựng cây tiêu chí</h3>
            </div>

            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
                <p class="text-base font-semibold text-slate-900">Cấu trúc biểu mẫu</p>
              </div>

              <div v-if="qcForm.criteriaTree.length" class="px-4 py-4 tablet:px-5">
                <p
                  v-if="showStructureValidation && getStructureValidationError()"
                  class="app-state-banner mb-4"
                >
                  {{ getStructureValidationError() }}
                </p>

                <div class="space-y-4">
                  <AdminQcCriterionBuilderItem
                    v-for="(node, index) in qcForm.criteriaTree"
                    :key="node.id"
                    :node="node"
                    :depth="1"
                    :display-ordering="getNodeOrderingSegment(node, index)"
                    :validation-map="visibleCriteriaValidationMap"
                    :can-move-up="index > 0"
                    :can-move-down="index < qcForm.criteriaTree.length - 1"
                    @add-child-group="addChildNode($event, 'group')"
                    @add-child-criterion="addChildNode($event, 'criterion')"
                    @move-up="moveNode($event, 'up')"
                    @move-down="moveNode($event, 'down')"
                    @remove="removeNode"
                  />
                </div>

                <div class="mt-5 border-t border-slate-200 pt-4">
                  <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
                    <div>
                      <p class="text-sm font-semibold text-slate-900">Thêm ở cấp gốc</p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        @click="addTopLevelGroup"
                      >
                        <span class="material-symbols-outlined text-[18px]">account_tree</span>
                        Thêm nhóm
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        @click="addTopLevelCriterion"
                      >
                        <span class="material-symbols-outlined text-[18px]">playlist_add</span>
                        Thêm tiêu chí
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="px-6 py-10">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">account_tree</span>
                    </div>
                    <p class="app-state-title">Cây tiêu chí đang trống.</p>
                    <p class="app-state-body">Bắt đầu bằng một nhóm lớn, sau đó thêm các tiêu chí chấm điểm bên trong.</p>
                  </div>
                </div>
                <p
                  v-if="showStructureValidation && getStructureValidationError()"
                  class="app-state-banner mx-auto mt-4 max-w-xl"
                >
                  {{ getStructureValidationError() }}
                </p>

                <div class="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    @click="addTopLevelGroup"
                  >
                    <span class="material-symbols-outlined text-[18px]">account_tree</span>
                    Thêm nhóm
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    @click="addTopLevelCriterion"
                  >
                    <span class="material-symbols-outlined text-[18px]">playlist_add</span>
                    Thêm tiêu chí
                  </button>
                </div>
              </div>
            </section>
          </section>

          <section v-else class="space-y-6">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bước 3</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Rà soát và phát hành</h3>
              <p class="mt-2 text-sm leading-6 text-slate-500">
                Kiểm tra nhanh metadata và cấu trúc cây trước khi phát hành version làm việc hiện tại.
              </p>
            </div>

            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
                <h4 class="text-base font-semibold text-slate-900">Thông tin chuẩn bị phát hành</h4>
              </div>

              <dl class="grid gap-x-8 gap-y-5 px-4 py-4 tablet:grid-cols-2 pc:grid-cols-3 tablet:px-5">
                <div class="min-w-0">
                  <dt class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Mã biểu mẫu</dt>
                  <dd class="mt-2 break-words text-sm font-semibold text-slate-900">{{ String(qcForm.code || '').trim() || '--' }}</dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tên biểu mẫu</dt>
                  <dd class="mt-2 break-words text-sm font-semibold text-slate-900">{{ String(qcForm.name || '').trim() || '--' }}</dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Phiên bản làm việc</dt>
                  <dd class="mt-2 break-words text-sm font-semibold text-slate-900">{{ currentWorkingVersion }}</dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ngưỡng đạt</dt>
                  <dd class="mt-2 break-words text-sm font-semibold text-slate-900">{{ Number(qcForm.passThreshold || 0) }}%</dd>
                </div>
              </dl>
            </section>

            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 class="text-base font-semibold text-slate-900">Preview cây tiêu chí</h4>
                    <p class="mt-1 text-sm leading-6 text-slate-500">
                      Xem lại thứ tự hiển thị, nhóm cha và các tiêu chí lá sẽ xuất hiện ở màn chấm QC.
                    </p>
                  </div>

                  <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {{ reviewRows.length }} mục
                  </span>
                </div>
              </div>

              <div class="px-4 py-4 tablet:px-5">
                <div class="space-y-2.5">
                  <article
                    v-for="row in visibleReviewRows"
                    :key="row.id"
                    :class="row.nodeType === 'group' ? 'rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3' : 'rounded-xl border border-slate-200 bg-white px-3.5 py-3'"
                    :style="{ marginLeft: getReviewRowIndent(row.depth) }"
                  >
                    <template v-if="row.nodeType === 'group'">
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-start gap-3 text-left"
                        :aria-expanded="String(isReviewGroupExpanded(row.ordering))"
                        @click="toggleReviewGroup(row.ordering)"
                      >
                        <span class="inline-flex min-w-[54px] items-center justify-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {{ row.ordering }}
                        </span>

                        <div class="min-w-0 flex-1 space-y-1.5">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              Nhóm
                            </span>
                            <span class="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {{ row.childCount }} mục con
                            </span>
                          </div>

                          <p class="text-sm font-semibold text-slate-900">{{ row.name }}</p>
                          <p v-if="row.description" class="text-xs leading-5 text-slate-500">{{ row.description }}</p>
                        </div>

                        <div class="ml-auto inline-flex items-center gap-1.5 self-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                          <span>
                            {{ isReviewGroupExpanded(row.ordering) ? 'Thu gọn' : 'Mở rộng' }}
                          </span>
                          <span class="inline-flex size-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <span class="material-symbols-outlined text-[16px]">{{ isReviewGroupExpanded(row.ordering) ? 'expand_less' : 'expand_more' }}</span>
                          </span>
                        </div>
                      </button>
                    </template>

                    <template v-else>
                      <div class="flex items-start gap-3">
                        <span class="inline-flex min-w-[54px] items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {{ row.ordering }}
                        </span>

                        <div class="min-w-0 flex-1 space-y-1.5">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              Tiêu chí
                            </span>
                            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {{ getReviewCriterionSummary(row) }}
                            </span>
                          </div>

                          <p class="text-sm font-semibold text-slate-900">{{ row.name }}</p>
                          <p v-if="row.description" class="text-xs leading-5 text-slate-500">{{ row.description }}</p>
                        </div>
                      </div>
                    </template>
                  </article>
                </div>
              </div>
            </section>
          </section>
        </div>

        <div class="flex flex-col gap-3 border-t border-slate-200 pt-6 tablet:flex-row tablet:items-center tablet:justify-between">
          <p class="text-sm text-slate-500">
            {{ activeStep === 1 ? 'Hoàn tất metadata trước khi dựng cây tiêu chí.' : (activeStep === 2 ? 'Chỉ node lá mới là tiêu chí chấm điểm trong phiên QC.' : 'Nếu mọi thứ đã ổn, anh có thể phát hành ngay version làm việc này.') }}
          </p>

          <div class="flex w-full flex-col gap-2 tablet:w-auto tablet:flex-row tablet:flex-wrap tablet:items-center tablet:justify-end">
            <button
              v-if="activeStep > 1"
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 tablet:w-auto"
              @click="goToPreviousStep"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Quay lại
            </button>

            <button
              v-if="activeStep < 3"
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 tablet:w-auto"
              @click="goToNextStep"
            >
              {{ activeStep === 1 ? 'Tạo cây tiêu chí' : 'Rà soát' }}
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>

            <button
              v-else
              type="button"
              class="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
              :disabled="isSaving"
              @click="submitForm('published')"
            >
              {{ publishLabel }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.no-spin::-webkit-outer-spin-button,
.no-spin::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.no-spin[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
