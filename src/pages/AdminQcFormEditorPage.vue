<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminQcBuilderTreeNode from '@/components/AdminQcBuilderTreeNode.vue'
import AdminQcOutlineNode from '@/components/AdminQcOutlineNode.vue'
import {
  createAdminQcForm,
  getAdminQcFormById,
  updateAdminQcForm,
  getAdminQcFormVersion,
  updateAdminQcFormVersion,
  applyAdminQcFormVersion,
} from '@/services/admin_service'
import { confirmDialog } from '@/composables/useConfirmDialog'
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
    title: 'Thông tin biểu mẫu',
    description: 'Chốt metadata biểu mẫu',
  },
  {
    id: 2,
    title: 'Cấu trúc tiêu chí',
    description: 'Dựng nhóm và tiêu chí lá',
  },
]

const ORDERING_LABEL_PATTERN = /^[A-Z0-9]+$/
const MAX_FORM_CODE_LENGTH = 50

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
    minPassScore: overrides.minPassScore ?? overrides.min_pass_score ?? ((overrides.maxScore ?? 10) / 2),
    deductionPercent: overrides.deductionPercent ?? overrides.deduction_percent ?? (overrides.mode === 'deduction' ? overrides.maxScore : undefined) ?? 5,
    severity: overrides.severity || overrides.defaultSeverity || overrides.default_severity || 'normal',
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
  id: null,
  versionNo: 'v1.0',
  status: 'draft',
})

const isEditMode = computed(() => route.name === 'Admin QC Form Edit' || route.name === 'Admin QC Form Version Edit')
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
const publishLabel = computed(() => (isPublishing.value ? 'Đang phát hành...' : 'Phát hành và áp dụng'))
const customInputClass = 'h-11 px-3.5 block w-full border border-[var(--stroke)] rounded-lg bg-white text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/10 disabled:opacity-70 disabled:pointer-events-none disabled:bg-[var(--surface-muted)]'
const customTextareaClass = 'min-h-24 py-3 px-3.5 block w-full resize-none border border-[var(--stroke)] rounded-lg bg-white text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/10 disabled:opacity-70 disabled:pointer-events-none disabled:bg-[var(--surface-muted)]'
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
        ? (String(node.mode || 'point') === 'deduction' ? 0 : Number(node.maxScore || 0))
        : 0,
      minPassScore: node.nodeType === 'criterion' && String(node.mode || '') === 'point'
        ? Number(node.minPassScore ?? node.maxScore ?? 0)
        : 0,
      deductionPercent: node.nodeType === 'criterion' && String(node.mode || '') === 'deduction'
        ? Number(node.deductionPercent || 0)
        : 0,
      childCount: Array.isArray(node.children) ? node.children.length : 0,
    }

    const children = Array.isArray(node.children) ? flattenCriteriaTreeForReview(node.children, orderingParts) : []
    return [row, ...children]
  })
}

const reviewRows = computed(() => flattenCriteriaTreeForReview(qcForm.criteriaTree))
const totalMaxScoreComputed = computed(() => reviewRows.value.reduce((acc, row) => acc + (row.maxScore || 0), 0))
const totalDeductionComputed = computed(() => reviewRows.value.reduce((acc, row) => acc + (row.deductionPercent || 0), 0))
const selectedBuilderNodeId = ref('')
const outlineQuery = ref('')
const outlineCollapsed = ref(false)
const mobileBuilderPanel = ref('tree')
const detailDropdownOpen = ref('')
const detailDropdownDirection = ref('down')
const selectedBuilderLocation = computed(() => (
  selectedBuilderNodeId.value ? findNodeLocation(qcForm.criteriaTree, selectedBuilderNodeId.value) : null
))
const selectedBuilderNode = computed(() => selectedBuilderLocation.value?.node || null)

const toggleDetailDropdown = (name, event) => {
  if (detailDropdownOpen.value === name) {
    detailDropdownOpen.value = ''
    return
  }

  const rect = event?.currentTarget?.getBoundingClientRect?.()
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
  const spaceAbove = rect ? rect.top : 0
  detailDropdownDirection.value = spaceBelow < 180 && spaceAbove > spaceBelow ? 'up' : 'down'
  detailDropdownOpen.value = name
}

const selectBuilderMode = (value) => {
  if (!selectedBuilderNode.value) return
  selectedBuilderNode.value.mode = value
  detailDropdownOpen.value = ''
}

const selectBuilderSeverity = (value) => {
  if (!selectedBuilderNode.value) return
  selectedBuilderNode.value.severity = value
  detailDropdownOpen.value = ''
}

watch(selectedBuilderNodeId, () => {
  detailDropdownOpen.value = ''
})
const selectBuilderNode = (nodeId) => {
  selectedBuilderNodeId.value = nodeId
  mobileBuilderPanel.value = 'detail'
}

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
  } else if (formCode.length > MAX_FORM_CODE_LENGTH) {
    errors.code = `Mã biểu mẫu tối đa ${MAX_FORM_CODE_LENGTH} ký tự`
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
  qcForm.id = null
  qcForm.code = ''
  qcForm.name = ''
  qcForm.description = ''
  qcForm.passThreshold = 40
  qcForm.isActive = true
  qcForm.criteriaTree.splice(0, qcForm.criteriaTree.length, ...createStarterTree())
  currentVersion.versionNo = 'v1.0'
  currentVersion.id = null
  currentVersion.status = 'draft'
}

const applyFormDetail = (item = {}) => {
  activeStep.value = 1
  showMetadataValidation.value = false
  showStructureValidation.value = false
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
  currentVersion.id = Number(item?.latestVersion?.id || 0) || null
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
  const node = createGroupNode()
  qcForm.criteriaTree.push(node)
  selectedBuilderNodeId.value = node.id
  mobileBuilderPanel.value = 'detail'
}

const addTopLevelCriterion = () => {
  const node = createCriterionNode()
  qcForm.criteriaTree.push(node)
  selectedBuilderNodeId.value = node.id
  mobileBuilderPanel.value = 'detail'
}

const addChildNode = (parentId, nodeType) => {
  const location = findNodeLocation(qcForm.criteriaTree, parentId)
  if (!location?.node || location.node.nodeType !== 'group') return

  if (nodeType === 'group') {
    const node = createGroupNode()
    location.node.children.push(node)
    selectedBuilderNodeId.value = node.id
    mobileBuilderPanel.value = 'detail'
    return
  }

  const node = createCriterionNode()
  location.node.children.push(node)
  selectedBuilderNodeId.value = node.id
  mobileBuilderPanel.value = 'detail'
}

const removeNode = (nodeId) => {
  const location = findNodeLocation(qcForm.criteriaTree, nodeId)
  if (!location) return
  location.list.splice(location.index, 1)
  if (selectedBuilderNodeId.value === nodeId) selectedBuilderNodeId.value = ''
  if (!selectedBuilderNodeId.value) mobileBuilderPanel.value = 'tree'
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
      severity: String(node.severity || 'normal'),
      ...(node.mode === 'deduction'
        ? { deductionPercent: Number(node.deductionPercent || 0) }
        : {
          maxScore: Number(node.maxScore || 0),
          ...(node.mode === 'point' ? { minPassScore: Number(node.minPassScore ?? (Number(node.maxScore || 0) / 2)) } : {}),
        }),
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

    if (mode === 'point' || mode === 'pass_fail') {
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
      if (mode === 'point') {
        const minPassScore = Number(node.minPassScore ?? (maxScore / 2))
        if (!Number.isFinite(minPassScore) || minPassScore < 0 || minPassScore > maxScore) {
          pushTreeValidationError(
            nodeErrors,
            messages,
            node.id,
            'minPassScore',
            `Tiêu chí "${nodeName || positionLabel}" cần ngưỡng đạt từ 0 đến điểm tối đa`,
          )
        }
      }
    } else if (mode === 'deduction') {
      const deductionPercent = Number(node.deductionPercent)
      if (!Number.isFinite(deductionPercent) || deductionPercent <= 0 || deductionPercent > 100) {
        pushTreeValidationError(
          nodeErrors,
          messages,
          node.id,
          'deductionPercent',
          `Tiêu chí "${nodeName || positionLabel}" cần mức khấu trừ lớn hơn 0 và không quá 100 điểm %`,
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
const getStructureValidationError = () => {
  if (criteriaValidation.value.messages[0]) return criteriaValidation.value.messages[0]
  const hasScoringCriterion = reviewRows.value.some((row) => row.nodeType === 'criterion' && row.mode !== 'deduction')
  return hasScoringCriterion ? '' : 'Biểu mẫu cần ít nhất một tiêu chí chấm điểm hoặc đạt/không đạt'
}
const visibleCriteriaValidationMap = computed(() => (showStructureValidation.value ? criteriaValidation.value.nodeErrors : {}))

const validateForm = () => getMetadataValidationError() || getStructureValidationError()

const focusFirstStructureError = () => {
  const firstErrorNodeId = Object.keys(criteriaValidation.value.nodeErrors || {})[0]
  activeStep.value = 2
  if (firstErrorNodeId) {
    selectedBuilderNodeId.value = firstErrorNodeId
    mobileBuilderPanel.value = 'detail'
    return
  }
  mobileBuilderPanel.value = 'tree'
}

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
    const versionId = Number(route.params.versionId || 0)
    const detail = versionId ? await getAdminQcFormVersion(formId, versionId) : await getAdminQcFormById(formId)
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
    if (!getMetadataValidationError()) focusFirstStructureError()
    return
  }

  if (targetStatus === 'published') {
    const confirmed = await confirmDialog({
      title: 'Phát hành và áp dụng biểu mẫu QC?',
      message: 'Version này sẽ trở thành bản đang dùng cho các phiếu QC tạo mới. Phiếu đã tạo trước đó vẫn giữ version cũ.',
      confirmText: 'Phát hành và áp dụng',
      cancelText: 'Huỷ',
    })
    if (!confirmed) return
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
      const versionId = Number(route.params.versionId || currentVersion.id || 0)
      if (versionId) {
        await updateAdminQcForm(qcForm.id, {
          name: payload.name,
          description: payload.description,
          isActive: payload.isActive,
        })
        detail = await updateAdminQcFormVersion(qcForm.id, versionId, {
          passThreshold: payload.passThreshold,
          criteria: payload.criteria,
        })
        if (targetStatus === 'published') {
          detail = await applyAdminQcFormVersion(qcForm.id, versionId)
        }
      } else {
        detail = await updateAdminQcForm(qcForm.id, payload)
      }
      toast.success(targetStatus === 'published' ? 'Đã phát hành và áp dụng biểu mẫu QC' : 'Lưu nháp biểu mẫu QC thành công')
    } else {
      detail = await createAdminQcForm(payload)
      toast.success(targetStatus === 'published' ? 'Tạo, phát hành và áp dụng biểu mẫu QC thành công' : 'Tạo biểu mẫu QC dạng nháp thành công')
    }

    applyFormDetail(detail)

    if (targetStatus === 'published') {
      router.replace(`/tools/qc-forms/${detail.id}`)
      return
    }

    if (!isEditMode.value) {
      router.replace(`/tools/qc-forms/${detail.id}/versions/${detail.latestVersion.id}/edit`)
    }
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể lưu biểu mẫu QC'
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
      focusFirstStructureError()
      return
    }
  }

  activeStep.value = Math.min(activeStep.value + 1, FORM_STEPS.length)
  if (activeStep.value === 2) mobileBuilderPanel.value = 'tree'
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

  activeStep.value = targetStep
  if (activeStep.value === 2) mobileBuilderPanel.value = 'tree'
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
  <div class="app-page flex w-full flex-col !pb-0">
    <section class="app-section app-section--padded hidden">
      <div class="app-page-header">
        <div class="flex min-w-0 items-start gap-3">
          <button
            type="button"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
            aria-label="Quay lại danh sách biểu mẫu QC"
            @click="goBack"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>

          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold text-[var(--text-primary)] tablet:text-xl">
              {{ isEditMode ? (qcForm.name || pageTitle) : pageTitle }}
            </h1>
            <p class="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{{ pageDescription }}</p>
          </div>
        </div>

        <div class="w-full tablet:w-auto tablet:shrink-0">
          <button
            type="button"
            class="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 tablet:w-auto"
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

    <section v-else class="flex flex-1 flex-col">
      <div class="flex flex-1 flex-col gap-5">
        <nav class="rounded-xl border border-[var(--stroke)] bg-white p-1.5 shadow-sm" aria-label="Tiến trình tạo biểu mẫu">
        <ol class="grid gap-1 tablet:grid-cols-2">
          <li
            v-for="step in stepItems"
            :key="step.id"
            class="step-item relative min-w-0"
            :class="{ 'is-completed': step.isCompleted, 'is-active': step.isActive }"
          >
            <button
              type="button"
              class="step-button group relative z-10 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-200"
              :class="step.isActive ? 'bg-[var(--primary-softer)] shadow-sm' : 'hover:bg-[var(--surface-muted)]'"
              :aria-current="step.isActive ? 'step' : undefined"
              @click="openStep(step.id)"
            >
              <span
                class="step-marker relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-all duration-200"
                :class="step.isActive ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm' : (step.isCompleted ? 'border-[var(--primary)] bg-white text-[var(--primary)]' : 'border-[var(--stroke)] bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:border-[var(--stroke-strong)]')"
              >
                <span v-if="step.isCompleted" class="material-symbols-outlined text-[16px]">check</span>
                <span v-else>{{ step.id }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-xs font-semibold" :class="step.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'">{{ step.title }}</span>
              </span>
            </button>
          </li>
        </ol>
        </nav>

        <div
          class="grid items-start gap-5"
          :class="activeStep === 2 ? '' : 'pc:grid-cols-[minmax(0,1fr)_360px]'"
        >
        <div>
          <section v-if="activeStep === 1" class="space-y-6">
            <section class="rounded-xl border border-[var(--stroke)] bg-white p-4 shadow-sm tablet:p-5">
              <h3 class="mb-5 text-base font-semibold text-[var(--text-primary)]"><span class="mr-2 text-[var(--primary)]">1.</span>Nhận diện biểu mẫu</h3>
            <div class="grid gap-5 tablet:grid-cols-2">
              <label class="space-y-2 tablet:col-span-1">
                <span class="text-sm font-semibold text-[var(--text-primary)]">Mã biểu mẫu <span class="text-red-500">*</span></span>
                <input
                  v-model="qcForm.code"
                  type="text"
                  :maxlength="MAX_FORM_CODE_LENGTH"
                  :disabled="isEditMode"
                  :class="[customInputClass, showMetadataValidation && metadataValidationErrors.code ? validationInputClass : '']"
                  placeholder="VD: STORE_AUDIT"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.code" :class="validationMessageClass">
                  {{ metadataValidationErrors.code }}
                </p>
                <p v-if="isEditMode" class="text-xs text-[var(--text-muted)]">
                  Mã biểu mẫu được khóa để giữ định danh ổn định cho các version đã có.
                </p>
              </label>

              <label class="space-y-2 tablet:col-span-1">
                <span class="text-sm font-semibold text-[var(--text-primary)]">Tên biểu mẫu <span class="text-red-500">*</span></span>
                <input
                  v-model="qcForm.name"
                  type="text"
                  :class="[customInputClass, showMetadataValidation && metadataValidationErrors.name ? validationInputClass : '']"
                  placeholder="Nhập tên biểu mẫu"
                />
                <p v-if="showMetadataValidation && metadataValidationErrors.name" :class="validationMessageClass">
                  {{ metadataValidationErrors.name }}
                </p>
              </label>

              <label class="space-y-2 tablet:col-span-2">
                <span class="text-sm font-semibold text-[var(--text-primary)]">Mô tả <span class="text-red-500">*</span></span>
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

            <section class="rounded-xl border border-[var(--stroke)] bg-white p-4 shadow-sm tablet:p-5">
              <h3 class="mb-5 text-base font-semibold text-[var(--text-primary)]"><span class="mr-2 text-[var(--primary)]">2.</span>Điều kiện đạt</h3>
              <label class="block max-w-md space-y-2">
                <span class="text-sm font-semibold text-[var(--text-primary)]">Ngưỡng đạt (%) <span class="text-red-500">*</span></span>
                <div class="relative">
                  <input v-model.number="qcForm.passThreshold" type="number" min="0" max="100" step="1" :class="[customInputClass, 'no-spin pr-10', showMetadataValidation && metadataValidationErrors.passThreshold ? validationInputClass : '']" />
                  <span class="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-[var(--text-secondary)]">%</span>
                </div>
                <p v-if="showMetadataValidation && metadataValidationErrors.passThreshold" :class="validationMessageClass">{{ metadataValidationErrors.passThreshold }}</p>
                <p class="text-xs text-[var(--text-muted)]">Tỷ lệ phần trăm tối thiểu để đạt</p>
              </label>
            </section>
          </section>

          <section v-else-if="activeStep === 2" class="space-y-4">
            <p v-if="showStructureValidation && getStructureValidationError()" class="app-state-banner">
              {{ getStructureValidationError() }}
            </p>

            <div class="grid grid-cols-3 gap-2 rounded-xl border border-[var(--stroke)] bg-white p-1.5 shadow-sm pc:hidden" role="tablist" aria-label="Bảng thao tác cấu trúc QC">
              <button
                type="button"
                class="flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors"
                :class="mobileBuilderPanel === 'tree' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :aria-selected="mobileBuilderPanel === 'tree'"
                @click="mobileBuilderPanel = 'tree'"
              >
                <span class="material-symbols-outlined text-[18px]">account_tree</span>
                Cây
              </button>
              <button
                type="button"
                class="flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors"
                :class="mobileBuilderPanel === 'detail' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :aria-selected="mobileBuilderPanel === 'detail'"
                @click="mobileBuilderPanel = 'detail'"
              >
                <span class="material-symbols-outlined text-[18px]">tune</span>
                Chi tiết
              </button>
              <button
                type="button"
                class="flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors"
                :class="mobileBuilderPanel === 'outline' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :aria-selected="mobileBuilderPanel === 'outline'"
                @click="mobileBuilderPanel = 'outline'"
              >
                <span class="material-symbols-outlined text-[18px]">list</span>
                Mục lục
              </button>
            </div>

            <div
              class="grid items-start gap-4"
              :class="outlineCollapsed ? 'pc:grid-cols-[52px_minmax(420px,1.9fr)_minmax(260px,0.95fr)]' : 'pc:grid-cols-[minmax(240px,0.85fr)_minmax(420px,1.8fr)_minmax(260px,0.95fr)]'"
            >
              <aside
                class="hidden min-h-0 flex-col rounded-xl border border-[var(--stroke)] bg-white p-3 shadow-sm transition-all pc:sticky pc:top-3 pc:flex pc:max-h-[calc(100dvh-11.5rem)]"
                :class="mobileBuilderPanel === 'outline' ? '!flex' : ''"
              >
                <div class="-mx-3 flex min-h-10 items-center justify-between gap-2 border-b border-[var(--stroke)] px-3 pb-3">
                  <h3 v-if="!outlineCollapsed" class="text-sm font-semibold text-[var(--text-primary)]">Cấu trúc</h3>
                  <button
                    type="button"
                    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    :class="outlineCollapsed ? 'mx-auto' : ''"
                    :aria-label="outlineCollapsed ? 'Mở mục lục cấu trúc' : 'Thu gọn mục lục cấu trúc'"
                    @click="outlineCollapsed = !outlineCollapsed"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ outlineCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left' }}</span>
                  </button>
                </div>
                <template v-if="!outlineCollapsed">
                <label class="relative mt-3 block">
                  <span class="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">search</span>
                  <input v-model="outlineQuery" type="search" class="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none" placeholder="Tìm nhóm, tiêu chí..." />
                </label>
                <ul class="qc-hidden-scrollbar mt-3 min-h-0 flex-1 scroll-pb-4 space-y-0.5 overflow-y-auto pb-4 pr-1">
                  <AdminQcOutlineNode
                    v-for="(node, index) in qcForm.criteriaTree"
                    :key="node.id"
                    :node="node"
                    :ordering="getNodeOrderingSegment(node, index)"
                    :selected-node-id="selectedBuilderNodeId"
                    :query="outlineQuery"
                    @select="selectBuilderNode"
                  />
                </ul>
                </template>
              </aside>

              <section
                class="min-w-0 rounded-xl border border-[var(--stroke)] bg-white shadow-sm"
                :class="mobileBuilderPanel === 'tree' ? 'block' : 'hidden pc:block'"
              >
                <div class="flex min-h-[52px] flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-[var(--stroke)] bg-white px-4 py-2.5 pc:sticky pc:top-0 pc:z-30 pc:shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
                  <h3 class="text-sm font-semibold text-[var(--text-primary)]">Xây dựng tiêu chí</h3>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--primary)] px-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-softer)] pc:min-h-7 pc:px-2 pc:text-[11px]" @click="addTopLevelGroup"><span class="material-symbols-outlined text-[16px]">add</span>Thêm nhóm</button>
                    <button type="button" class="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--primary)] px-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-softer)] pc:min-h-7 pc:px-2 pc:text-[11px]" @click="addTopLevelCriterion"><span class="material-symbols-outlined text-[16px]">add</span>Thêm tiêu chí</button>
                  </div>
                </div>

                <div v-if="qcForm.criteriaTree.length" class="space-y-3 p-3 tablet:p-4">
                  <AdminQcBuilderTreeNode
                    v-for="(node, index) in qcForm.criteriaTree"
                    :key="node.id"
                    :node="node"
                    :ordering="getNodeOrderingSegment(node, index)"
                    :validation-map="visibleCriteriaValidationMap"
                    :selected-node-id="selectedBuilderNodeId"
                    :can-move-up="index > 0"
                    :can-move-down="index < qcForm.criteriaTree.length - 1"
                    @select="selectBuilderNode"
                    @add-child="addChildNode($event, 'criterion')"
                    @move-up="moveNode($event, 'up')"
                    @move-down="moveNode($event, 'down')"
                    @remove="removeNode"
                  />
                </div>
                <div v-else class="p-8 text-center">
                  <span class="material-symbols-outlined text-3xl text-[var(--text-muted)]">account_tree</span>
                  <p class="mt-2 text-sm font-semibold text-[var(--text-primary)]">Cây tiêu chí đang trống</p>
                  <p class="mt-1 text-xs text-[var(--text-muted)]">Thêm nhóm hoặc tiêu chí để bắt đầu.</p>
                </div>
              </section>

              <aside
                class="qc-hidden-scrollbar rounded-xl border border-[var(--stroke)] bg-white p-4 shadow-sm pc:sticky pc:top-3 pc:max-h-[calc(100dvh-11.5rem)] pc:overflow-y-auto"
                :class="mobileBuilderPanel === 'detail' ? 'block' : 'hidden pc:block'"
              >
                <div class="-mx-4 flex min-h-9 items-center border-b border-[var(--stroke)] px-4 pb-3">
                  <h3 class="text-sm font-semibold text-[var(--text-primary)]">Chi tiết tiêu chí</h3>
                  <button type="button" class="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--stroke)] px-2 text-xs font-semibold text-[var(--text-secondary)] pc:hidden" @click="mobileBuilderPanel = 'tree'">
                    <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                    Cây
                  </button>
                </div>
                <template v-if="selectedBuilderNode">
                  <section class="pt-4">
                    <p class="mb-3 text-xs font-semibold text-[var(--text-primary)]">Thông tin chung</p>
                    <div class="space-y-3">
                      <label class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Tên {{ selectedBuilderNode.nodeType === 'group' ? 'nhóm' : 'tiêu chí' }} <span class="text-red-500">*</span></span>
                        <input v-model="selectedBuilderNode.name" type="text" :class="customInputClass" placeholder="Nhập tên" />
                      </label>
                      <label v-if="selectedBuilderNode.nodeType === 'group'" class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Nhãn thứ tự</span>
                        <input v-model="selectedBuilderNode.orderingLabel" type="text" :class="[customInputClass, 'uppercase']" placeholder="VD: A" />
                      </label>
                      <label class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Mô tả</span>
                        <textarea v-model="selectedBuilderNode.description" rows="3" :class="customTextareaClass" placeholder="Nhập mô tả"></textarea>
                      </label>
                    </div>
                  </section>

                  <section v-if="selectedBuilderNode.nodeType === 'criterion'" class="mt-5 border-t border-[var(--stroke)] pt-4">
                    <p class="mb-3 text-xs font-semibold text-[var(--text-primary)]">Cấu hình chấm điểm</p>
                    <div class="space-y-3">
                      <div class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Kiểu chấm <span class="text-red-500">*</span></span>
                        <div class="relative">
                          <button type="button" class="app-input flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold" aria-haspopup="menu" :aria-expanded="String(detailDropdownOpen === 'mode')" @click="toggleDetailDropdown('mode', $event)">
                            <span class="truncate">{{ ({ point: 'Chấm điểm', pass_fail: 'Đạt / Không đạt', deduction: 'Khấu trừ' })[selectedBuilderNode.mode] || 'Chấm điểm' }}</span>
                            <span class="material-symbols-outlined text-[18px] text-[var(--text-secondary)]">expand_more</span>
                          </button>
                          <div v-if="detailDropdownOpen === 'mode'" class="app-menu-panel absolute left-0 z-50 w-full min-w-44 p-1 shadow-lg" :class="detailDropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'" role="menu">
                            <button
                              v-for="modeOption in [
                                { value: 'point', label: 'Chấm điểm' },
                                { value: 'pass_fail', label: 'Đạt / Không đạt' },
                                { value: 'deduction', label: 'Khấu trừ' },
                              ]"
                              :key="modeOption.value"
                              type="button"
                              class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                              :class="selectedBuilderNode.mode === modeOption.value ? 'text-[var(--primary-strong)]' : 'text-[var(--text-secondary)]'"
                              role="menuitemradio"
                              :aria-checked="String(selectedBuilderNode.mode === modeOption.value)"
                              @click="selectBuilderMode(modeOption.value)"
                            >
                              <span>{{ modeOption.label }}</span>
                              <span v-if="selectedBuilderNode.mode === modeOption.value" class="material-symbols-outlined text-[16px]">check</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Mức độ</span>
                        <div class="relative">
                          <button type="button" class="app-input flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold" aria-haspopup="menu" :aria-expanded="String(detailDropdownOpen === 'severity')" @click="toggleDetailDropdown('severity', $event)">
                            <span class="truncate">{{ selectedBuilderNode.severity === 'critical' ? 'Nặng' : 'Nhẹ' }}</span>
                            <span class="material-symbols-outlined text-[18px] text-[var(--text-secondary)]">expand_more</span>
                          </button>
                          <div v-if="detailDropdownOpen === 'severity'" class="app-menu-panel absolute left-0 z-50 w-full min-w-44 p-1 shadow-lg" :class="detailDropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'" role="menu">
                            <button
                              v-for="severityOption in [
                                { value: 'normal', label: 'Nhẹ' },
                                { value: 'critical', label: 'Nặng' },
                              ]"
                              :key="severityOption.value"
                              type="button"
                              class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-muted)]"
                              :class="selectedBuilderNode.severity === severityOption.value ? 'text-[var(--primary-strong)]' : 'text-[var(--text-secondary)]'"
                              role="menuitemradio"
                              :aria-checked="String(selectedBuilderNode.severity === severityOption.value)"
                              @click="selectBuilderSeverity(severityOption.value)"
                            >
                              <span>{{ severityOption.label }}</span>
                              <span v-if="selectedBuilderNode.severity === severityOption.value" class="material-symbols-outlined text-[16px]">check</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <label v-if="selectedBuilderNode.mode !== 'deduction'" class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">{{ selectedBuilderNode.mode === 'pass_fail' ? 'Trọng số' : 'Điểm tối đa' }} <span class="text-red-500">*</span></span>
                        <input v-model.number="selectedBuilderNode.maxScore" type="number" min="1" :class="[customInputClass, 'no-spin']" />
                      </label>
                      <label v-if="selectedBuilderNode.mode === 'point'" class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Ngưỡng đạt tiêu chí <span class="text-red-500">*</span></span>
                        <input v-model.number="selectedBuilderNode.minPassScore" type="number" min="0" :max="selectedBuilderNode.maxScore" step="0.5" :class="[customInputClass, 'no-spin']" />
                        <p class="text-xs text-[var(--text-muted)]">Yêu cầu khắc phục sẽ được tạo khi điểm QC thấp hơn {{ Number(selectedBuilderNode.minPassScore ?? selectedBuilderNode.maxScore ?? 0) }}/{{ Number(selectedBuilderNode.maxScore || 0) }}.</p>
                      </label>
                      <label v-else-if="selectedBuilderNode.mode === 'deduction'" class="block space-y-1.5">
                        <span class="text-xs font-medium text-[var(--text-secondary)]">Mức khấu trừ (%) <span class="text-red-500">*</span></span>
                        <input v-model.number="selectedBuilderNode.deductionPercent" type="number" min="0.1" max="100" step="0.1" :class="[customInputClass, 'no-spin']" />
                      </label>
                    </div>
                  </section>

                  <div v-if="selectedBuilderNode.nodeType === 'group'" class="-mx-4 mt-5 border-t border-[var(--stroke)] px-4 pt-4">
                    <p class="mb-2 text-xs font-semibold text-[var(--text-primary)]">Thêm mục con</p>
                    <div class="grid grid-cols-2 gap-2">
                      <button type="button" class="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-softer)] hover:text-[var(--primary)]" @click="addChildNode(selectedBuilderNode.id, 'group')"><span class="material-symbols-outlined text-[17px]">account_tree</span>Nhóm con</button>
                      <button type="button" class="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-softer)] hover:text-[var(--primary)]" @click="addChildNode(selectedBuilderNode.id, 'criterion')"><span class="material-symbols-outlined text-[17px]">playlist_add</span>Tiêu chí</button>
                    </div>
                  </div>
                  <div class="-mx-4 mt-4 border-t border-[var(--stroke)] px-4 pt-4">
                    <button type="button" class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100" @click="removeNode(selectedBuilderNode.id)"><span class="material-symbols-outlined text-[17px]">delete_outline</span>Xóa {{ selectedBuilderNode.nodeType === 'group' ? 'nhóm' : 'tiêu chí' }}</button>
                  </div>
                </template>
                <div v-else class="py-10 text-center">
                  <span class="material-symbols-outlined text-3xl text-[var(--text-muted)]">ads_click</span>
                  <p class="mt-2 text-sm font-semibold text-[var(--text-primary)]">Chọn một node</p>
                  <p class="mt-1 text-xs leading-5 text-[var(--text-muted)]">Thông tin node được chọn sẽ hiển thị tại đây.</p>
                </div>
              </aside>
            </div>
          </section>

        </div>

        <aside v-if="activeStep !== 2" class="rounded-xl border border-[var(--stroke)] bg-white p-5 shadow-sm pc:sticky pc:top-4">
          <h3 class="text-base font-semibold text-[var(--text-primary)]">Tóm tắt biểu mẫu</h3>
          <dl class="mt-5 space-y-5 text-sm">
            <div class="flex items-center justify-between gap-4"><dt class="flex items-center gap-2 text-[var(--text-secondary)]"><span class="material-symbols-outlined text-[19px]">save</span>Trạng thái lưu</dt><dd class="font-medium text-[var(--text-primary)]">{{ qcForm.id ? 'Đã lưu' : 'Chưa lưu' }}</dd></div>
            <div class="flex items-center justify-between gap-4"><dt class="flex items-center gap-2 text-[var(--text-secondary)]"><span class="material-symbols-outlined text-[19px]">draft</span>Version dự kiến</dt><dd class="font-medium text-[var(--text-primary)]">{{ currentWorkingVersion }}</dd></div>
            <div class="flex items-center justify-between gap-4"><dt class="flex items-center gap-2 text-[var(--text-secondary)]"><span class="material-symbols-outlined text-[19px]">description</span>Trạng thái version</dt><dd class="rounded-md bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">Draft</dd></div>
          </dl>
          <div class="my-5 border-t border-[var(--stroke)]"></div>
          <dl class="space-y-5 text-sm">
            <div class="flex items-start justify-between gap-4"><dt><span class="flex items-center gap-2 text-[var(--text-secondary)]"><span class="material-symbols-outlined text-[19px]">settings</span>Số tiêu chí</span><span class="ml-7 mt-1 block text-xs text-[var(--text-muted)]">Tiêu chí lá trong biểu mẫu</span></dt><dd class="font-semibold text-[var(--text-primary)]">{{ reviewRows.filter((row) => row.nodeType === 'criterion').length }}</dd></div>
            <div class="flex items-start justify-between gap-4"><dt><span class="flex items-center gap-2 text-[var(--text-secondary)]"><span class="material-symbols-outlined text-[19px]">schedule</span>Tổng điểm tạm thời</span><span class="ml-7 mt-1 block text-xs text-[var(--text-muted)]">Không gồm tiêu chí khấu trừ</span></dt><dd class="font-semibold text-[var(--text-primary)]">{{ totalMaxScoreComputed }} điểm</dd></div>
          </dl>
          <div class="mt-6 rounded-lg border border-blue-200 bg-blue-50/70 p-4">
            <p class="flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><span class="material-symbols-outlined">checklist</span>Bước tiếp theo</p>
            <p class="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Ở bước 2, bạn sẽ xây dựng cấu trúc tiêu chí gồm nhóm tiêu chí, tiêu chí con, thang điểm và trọng số.</p>
          </div>
        </aside>
        </div>

        <div class="sticky bottom-0 z-40 -mx-3 mt-auto border-t border-[var(--stroke)] bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur tablet:flex tablet:items-center tablet:justify-end tablet:py-4">
          <div class="grid w-full grid-cols-2 gap-2 tablet:flex tablet:w-auto tablet:flex-wrap tablet:items-center tablet:justify-end">
            <button
              type="button"
              class="order-1 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--stroke-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] tablet:order-none tablet:min-h-11 tablet:w-auto tablet:px-5"
              @click="goBack"
            >
              Hủy
            </button>

            <button
              type="button"
              class="order-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--primary)] bg-white px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-softer)] disabled:opacity-60 tablet:order-none tablet:min-h-11 tablet:w-auto tablet:px-5 tablet:py-2.5"
              :disabled="isSaving"
              @click="submitForm('draft')"
            ><span class="material-symbols-outlined text-[18px]">save</span>{{ saveDraftLabel }}</button>

            <button
              v-if="activeStep > 1"
              type="button"
              class="order-3 col-span-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:order-none tablet:w-auto tablet:py-2.5"
              @click="goToPreviousStep"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Quay lại
            </button>

            <button
              v-if="activeStep < FORM_STEPS.length"
              type="button"
              class="order-4 col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] tablet:order-none tablet:w-auto"
              @click="goToNextStep"
            >
              Tiếp tục tạo tiêu chí
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>

            <button
              v-else
              type="button"
              class="order-4 col-span-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60 tablet:order-none tablet:w-auto"
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
.qc-hidden-scrollbar {
  scrollbar-width: none;
}

.qc-hidden-scrollbar::-webkit-scrollbar {
  display: none;
}

.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  z-index: 20;
  top: 22px;
  right: -3px;
  width: 6px;
  height: 2px;
  background: var(--stroke);
  transition: background-color 200ms ease;
}

.step-item.is-completed::after {
  background: var(--primary);
}

.step-item:not(:last-child)::before {
  content: 'chevron_right';
  position: absolute;
  z-index: 30;
  top: 15px;
  right: -8px;
  color: var(--stroke-strong);
  font-family: 'Material Symbols Outlined';
  font-size: 15px;
  line-height: 1;
  background: white;
}

.step-item.is-completed::before {
  color: var(--primary);
}

@media (max-width: 48rem) {
  .step-item:not(:last-child)::after,
  .step-item:not(:last-child)::before { display: none; }
}

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
