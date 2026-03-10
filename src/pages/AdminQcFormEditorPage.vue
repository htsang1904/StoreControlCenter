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
    weight: overrides.weight ?? 1,
    frequency: overrides.frequency || 'per_audit',
    isCritical: overrides.isCritical === true,
    required: overrides.required !== false,
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
    weight: 0,
    frequency: 'per_audit',
    isCritical: false,
    required: false,
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
      weight: Number(node.weight || 0),
      frequency: String(node.frequency || 'per_audit'),
      isCritical: node.isCritical === true,
      required: node.required !== false,
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

const stepItems = computed(() => FORM_STEPS.map((step) => ({
  ...step,
  isActive: step.id === activeStep.value,
  isCompleted: step.id < activeStep.value,
})))

const getMetadataValidationError = () => {
  const formCode = String(qcForm.code || '').trim().toUpperCase()
  const formName = String(qcForm.name || '').trim()

  if (!formCode || !formName) return 'Mã biểu mẫu và tên biểu mẫu là bắt buộc'
  if (!/^[A-Z0-9_-]+$/.test(formCode)) return 'Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang'

  const threshold = Number(qcForm.passThreshold || 0)
  if (threshold < 0 || threshold > 100) {
    return 'Ngưỡng đạt phải nằm trong khoảng từ 0 đến 100'
  }

  return ''
}

const getStructureValidationError = () => validateTree(qcForm.criteriaTree, 'Biểu mẫu')

const canSaveDraft = computed(() => !getMetadataValidationError() && !getStructureValidationError())

const resetFormState = () => {
  activeStep.value = 1
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
      weight: Number(node.weight || 1),
      frequency: String(node.frequency || 'per_audit'),
      isCritical: Boolean(node.isCritical),
      required: Boolean(node.required),
    }
  })
)

const validateTree = (nodes = [], parentLabel = 'Mục gốc') => {
  if (!nodes.length) {
    return `${parentLabel} cần ít nhất một nhóm hoặc tiêu chí`
  }

  const siblingSegments = new Set()

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const positionSegment = getNodeOrderingSegment(node, index)
    const positionLabel = `${parentLabel}.${positionSegment}`
    const nodeName = String(node.name || '').trim()
    const orderingLabel = node.nodeType === 'group' ? normalizeOrderingLabel(node.orderingLabel) : ''

    if (orderingLabel && !ORDERING_LABEL_PATTERN.test(orderingLabel)) {
      return `Mã thứ tự của nhóm ở ${positionLabel} chỉ được chứa chữ và số`
    }

    if (siblingSegments.has(positionSegment)) {
      return `Mã thứ tự "${positionSegment}" đang bị trùng trong ${parentLabel}`
    }
    siblingSegments.add(positionSegment)

    if (!nodeName) {
      return `${node.nodeType === 'group' ? 'Nhóm' : 'Tiêu chí'} ở ${positionLabel} cần có tên`
    }

    if (node.nodeType === 'group') {
      if (!Array.isArray(node.children) || !node.children.length) {
        return `Nhóm "${nodeName}" cần ít nhất một mục con`
      }

      const nestedError = validateTree(node.children, nodeName)
      if (nestedError) return nestedError
      continue
    }

    if (String(node.mode || 'point') === 'point' && Number(node.maxScore || 0) <= 0) {
      return `Tiêu chí "${nodeName}" cần điểm tối đa lớn hơn 0`
    }
  }

  return ''
}

const validateForm = () => {
  return getMetadataValidationError() || getStructureValidationError()
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
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }
  }

  if (activeStep.value === 2) {
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
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }
  }

  if (targetStep === 3) {
    const metadataError = getMetadataValidationError()
    if (metadataError) {
      toast.error(metadataError)
      return
    }

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
  <div class="mx-auto max-w-6xl space-y-6">
    <section class="flex flex-wrap items-start justify-between gap-3">
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
          <h1 class="truncate text-lg font-semibold text-slate-900 sm:text-xl">
            {{ isEditMode ? (qcForm.name || pageTitle) : pageTitle }}
          </h1>
          <p class="mt-1 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
        </div>
      </div>

      <div class="shrink-0">
        <button
          type="button"
          class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSaving || !canSaveDraft"
          @click="submitForm('draft')"
        >
          <span class="material-symbols-outlined text-[18px]" :class="isSavingDraft ? 'animate-spin' : ''">
            {{ isSavingDraft ? 'autorenew' : 'save' }}
          </span>
          {{ saveDraftLabel }}
        </button>
      </div>
    </section>

    <p v-if="loadError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ loadError }}
    </p>

    <div v-else-if="loadingForm" class="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500">
      Đang tải biểu mẫu...
    </div>

    <section v-else class="rounded-3xl border border-slate-200 bg-white">
      <div class="space-y-6 px-6 py-6">
        <ol class="grid gap-3 md:grid-cols-3">
          <li v-for="step in stepItems" :key="step.id">
            <button
              type="button"
              class="flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition"
              :class="step.isActive ? 'border-blue-200 bg-blue-50/70' : (step.isCompleted ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50')"
              @click="openStep(step.id)"
            >
              <span
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                :class="step.isActive || step.isCompleted ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'"
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
          <section v-if="activeStep === 1" class="max-w-3xl space-y-6">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Bước 1</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Thiết lập biểu mẫu</h3>
              <p class="mt-2 text-sm leading-6 text-slate-500">
                Chốt định danh và thông tin nền trước khi đi sang bước dựng cây tiêu chí.
              </p>
            </div>

            <div class="grid gap-5 md:grid-cols-2">
              <label class="space-y-2 md:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Mã biểu mẫu</span>
                <input
                  v-model="qcForm.code"
                  type="text"
                  :disabled="isEditMode"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="VD: QC_STORE_STANDARD"
                />
                <p class="text-xs text-slate-400">
                  {{ isEditMode ? 'Mã biểu mẫu được khóa để giữ định danh ổn định cho các version đã có.' : 'Dùng chữ in hoa, số, gạch dưới hoặc gạch ngang.' }}
                </p>
              </label>

              <label class="space-y-2 md:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Tên biểu mẫu</span>
                <input
                  v-model="qcForm.name"
                  type="text"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="VD: QC cửa hàng chuẩn"
                />
              </label>

              <label class="space-y-2 md:col-span-1">
                <span class="text-sm font-semibold text-slate-700">Ngưỡng đạt (%)</span>
                <input
                  v-model.number="qcForm.passThreshold"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label class="flex items-center gap-3 md:col-span-1 md:pt-8">
                <input v-model="qcForm.isActive" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span class="text-sm font-medium text-slate-700">Kích hoạt biểu mẫu sau khi lưu</span>
              </label>

              <label class="space-y-2 md:col-span-2">
                <span class="text-sm font-semibold text-slate-700">Mô tả</span>
                <textarea
                  v-model="qcForm.description"
                  rows="4"
                  class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Mô tả phạm vi áp dụng và mục tiêu của biểu mẫu"
                />
              </label>
            </div>
          </section>

          <section v-else-if="activeStep === 2" class="space-y-5">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Bước 2</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Dựng cây tiêu chí</h3>
              <p class="mt-2 text-sm leading-6 text-slate-500">
                Tạo nhóm trước rồi thêm các tiêu chí chấm điểm bên trong. Chỉ node lá mới xuất hiện ở màn chấm QC.
              </p>
            </div>

            <section class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-200 px-4 py-4 sm:px-5">
                <p class="text-base font-semibold text-slate-900">Cấu trúc biểu mẫu</p>
              </div>

              <div v-if="qcForm.criteriaTree.length" class="px-4 py-4 sm:px-5">
                <div class="space-y-4">
                  <AdminQcCriterionBuilderItem
                    v-for="(node, index) in qcForm.criteriaTree"
                    :key="node.id"
                    :node="node"
                    :depth="1"
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
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm font-semibold text-slate-900">Thêm ở cấp gốc</p>
                      <p class="mt-1 text-sm text-slate-500">Không cần quay lại đầu danh sách để thêm mục mới.</p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        @click="addTopLevelGroup"
                      >
                        <span class="material-symbols-outlined text-[18px]">account_tree</span>
                        Thêm nhóm gốc
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                        @click="addTopLevelCriterion"
                      >
                        <span class="material-symbols-outlined text-[18px]">playlist_add</span>
                        Thêm tiêu chí độc lập
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="px-6 py-10 text-center">
                <p class="text-sm font-semibold text-slate-700">Cây tiêu chí đang trống.</p>
                <p class="mt-1 text-sm text-slate-500">
                  Bắt đầu bằng một nhóm lớn, sau đó thêm các tiêu chí chấm điểm bên trong.
                </p>

                <div class="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    @click="addTopLevelGroup"
                  >
                    <span class="material-symbols-outlined text-[18px]">account_tree</span>
                    Thêm nhóm gốc
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                    @click="addTopLevelCriterion"
                  >
                    <span class="material-symbols-outlined text-[18px]">playlist_add</span>
                    Thêm tiêu chí độc lập
                  </button>
                </div>
              </div>
            </section>
          </section>

          <section v-else class="space-y-6">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Bước 3</p>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">Rà soát và phát hành</h3>
              <p class="mt-2 text-sm leading-6 text-slate-500">
                Kiểm tra nhanh metadata và cấu trúc cây trước khi phát hành version làm việc hiện tại.
              </p>
            </div>

            <section class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-200 px-4 py-4 sm:px-5">
                <h4 class="text-base font-semibold text-slate-900">Thông tin chuẩn bị phát hành</h4>
              </div>

              <dl class="grid gap-x-8 gap-y-5 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3 sm:px-5">
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

            <section class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-200 px-4 py-4 sm:px-5">
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

              <div class="px-4 py-4 sm:px-5">
                <div class="space-y-3">
                  <article
                    v-for="row in visibleReviewRows"
                    :key="row.id"
                    :class="row.nodeType === 'group' ? 'rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4' : 'rounded-2xl border border-slate-200 bg-white px-4 py-4'"
                    :style="{ marginLeft: `${Math.max(row.depth - 1, 0) * 18}px` }"
                  >
                    <template v-if="row.nodeType === 'group'">
                      <button
                        type="button"
                        class="flex w-full cursor-pointer flex-wrap items-start gap-3 text-left"
                        :aria-expanded="String(isReviewGroupExpanded(row.ordering))"
                        @click="toggleReviewGroup(row.ordering)"
                      >
                        <span class="inline-flex min-w-[52px] items-center justify-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {{ row.ordering }}
                        </span>

                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              Nhóm
                            </span>
                          </div>

                          <p class="mt-2 text-sm font-semibold text-slate-900">{{ row.name }}</p>
                          <p v-if="row.description" class="mt-1 text-sm leading-6 text-slate-500">{{ row.description }}</p>
                          <p class="mt-1 text-xs text-slate-500">
                            {{ isReviewGroupExpanded(row.ordering) ? 'Thu gọn danh sách tiêu chí con' : 'Bấm để xem các tiêu chí con' }}
                          </p>
                        </div>

                        <div class="flex max-w-full flex-wrap justify-end gap-2">
                          <span class="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {{ row.childCount }} mục con
                          </span>
                          <span class="inline-flex size-8 items-center justify-center rounded-full bg-white text-slate-500">
                            <span class="material-symbols-outlined text-[18px]">
                              {{ isReviewGroupExpanded(row.ordering) ? 'expand_less' : 'expand_more' }}
                            </span>
                          </span>
                        </div>
                      </button>
                    </template>

                    <template v-else>
                      <div class="flex flex-wrap items-start gap-3">
                        <span class="inline-flex min-w-[52px] items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {{ row.ordering }}
                        </span>

                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                              Tiêu chí
                            </span>
                            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {{ row.mode === 'pass_fail' ? 'Đạt / Không đạt' : `Tối đa ${Number(row.maxScore || 0)} điểm` }}
                            </span>
                          </div>

                          <p class="mt-2 text-sm font-semibold text-slate-900">{{ row.name }}</p>
                          <p v-if="row.description" class="mt-1 text-sm leading-6 text-slate-500">{{ row.description }}</p>
                        </div>

                        <div class="flex max-w-full flex-wrap justify-end gap-2">
                          <span
                            v-if="row.required"
                            class="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
                          >
                            Bắt buộc
                          </span>
                          <span
                            v-if="row.isCritical"
                            class="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700"
                          >
                            Trọng yếu
                          </span>
                          <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            Trọng số {{ row.weight }}
                          </span>
                          <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {{ row.frequency === 'weekly_once' ? 'Mỗi tuần một lần' : 'Mỗi lần kiểm' }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </article>
                </div>
              </div>
            </section>
          </section>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <p class="text-sm text-slate-500">
            {{ activeStep === 1 ? 'Hoàn tất metadata trước khi dựng cây tiêu chí.' : (activeStep === 2 ? 'Chỉ node lá mới là tiêu chí chấm điểm trong phiên QC.' : 'Nếu mọi thứ đã ổn, anh có thể phát hành ngay version làm việc này.') }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="activeStep > 1"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              @click="goToPreviousStep"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Quay lại
            </button>

            <button
              v-if="activeStep < 3"
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              @click="goToNextStep"
            >
              {{ activeStep === 1 ? 'Tạo cây tiêu chí' : 'Rà soát' }}
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>

            <button
              v-else
              type="button"
              class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
