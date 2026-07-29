<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, Search, X } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmDialog } from '@/composables/useConfirmDialog'
import QcFormStructureNode from '@/components/QcFormStructureNode.vue'
import { applyAdminQcFormVersion, createAdminQcFormVersion, deleteAdminQcForm, deleteAdminQcFormVersion, getAdminQcFormById, getAdminQcFormVersion, listAdminQcFormVersions } from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const formDetail = ref(null)
const actionMenuOpen = ref(false)
const actionMenuDirection = ref('down')
const activeTab = ref('overview')
const structureSearchInput = ref('')
const structureSearchKeyword = ref('')
const structureFilter = ref('all')
const structureFilterOpen = ref(false)
const structureFilterDirection = ref('down')
const expandedStructureIds = ref(new Set())
const versions = ref([])
const versionActionId = ref(null)
const versionActionDirection = ref('down')
const creatingVersion = ref(false)
const applyingVersionId = ref(null)
const deletingVersionId = ref(null)
let structureSearchTimer = null

const formId = computed(() => Number(route.params.id || 0))
const existingDraftVersion = computed(() => {
  const detailDraft = formDetail.value?.draftVersion
  if (detailDraft?.id) return detailDraft
  return versions.value.find((version) => String(version?.status || '').toLowerCase() === 'draft') || null
})

const statusLabel = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'Đang áp dụng'
  if (normalized === 'archived') return 'Lưu trữ'
  return 'Bản nháp'
}

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'app-badge--success'
  if (normalized === 'archived') return 'app-badge--neutral'
  return 'app-badge--warning'
}

const formActiveLabel = computed(() => (formDetail.value?.isActive === false ? 'Ngưng dùng' : 'Đang dùng'))
const formActiveClass = computed(() => (formDetail.value?.isActive === false ? 'app-badge--neutral' : 'app-badge--success'))

const criteriaRows = computed(() => {
  return Array.isArray(formDetail.value?.latestVersion?.criteria)
    ? formDetail.value.latestVersion.criteria
    : []
})
const groupCount = computed(() => criteriaRows.value.filter((criterion) => criterion.nodeType === 'group').length)
const scoringCriteriaCount = computed(() => criteriaRows.value.filter((criterion) => criterion.nodeType !== 'group' && criterion.mode !== 'deduction').length)
const deductionCriteriaCount = computed(() => criteriaRows.value.filter((criterion) => criterion.nodeType !== 'group' && criterion.mode === 'deduction').length)
const totalMaxScore = computed(() => criteriaRows.value.reduce((total, criterion) => (
  criterion.nodeType === 'group' || criterion.mode === 'deduction'
    ? total
    : total + Number(criterion.maxScore || 0)
), 0))
const totalDeduction = computed(() => criteriaRows.value.reduce((total, criterion) => (
  criterion.mode === 'deduction'
    ? total + Number(criterion.deductionPercent || 0)
    : total
), 0))
const draftVersionsCount = computed(() => versions.value.filter((version) => String(version?.status || '').toLowerCase() === 'draft').length)
const structureFilterOptions = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'point', label: 'Chấm điểm' },
  { value: 'pass_fail', label: 'Đạt / Không đạt' },
  { value: 'deduction', label: 'Khấu trừ' },
]
const structureFilterLabel = computed(() => structureFilterOptions.find((option) => option.value === structureFilter.value)?.label || 'Tất cả loại')
const normalizeStructureSearch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .trim()
  .toLowerCase()

const structureTree = computed(() => {
  const nodes = criteriaRows.value.map((criterion) => ({ ...criterion, children: [] }))
  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]))
  const roots = []

  nodes.forEach((node) => {
    const parentId = node.parentId ? String(node.parentId) : ''
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
})

const collectStructureLeaves = (node) => {
  if (!node.children?.length) return node.nodeType === 'group' ? [] : [node]
  return node.children.flatMap((child) => collectStructureLeaves(child))
}

const structureNodeSummary = (node) => {
  const leaves = collectStructureLeaves(node)
  return {
    criterionCount: leaves.length,
    maxScore: leaves.reduce((total, criterion) => criterion.mode === 'deduction' ? total : total + Number(criterion.maxScore || 0), 0),
    deductionCount: leaves.filter((criterion) => criterion.mode === 'deduction').length,
  }
}

const matchesStructureCriterion = (criterion) => {
  if (structureFilter.value !== 'all' && criterion.mode !== structureFilter.value) return false
  const keyword = normalizeStructureSearch(structureSearchKeyword.value)
  if (!keyword) return true
  return [criterion.name, criterion.description, criterion.ordering, criterion.code]
    .some((value) => normalizeStructureSearch(value).includes(keyword))
}

const filterStructureTree = (nodes = []) => nodes.reduce((result, node) => {
  const children = filterStructureTree(node.children || [])
  if (node.nodeType === 'group') {
    const keyword = normalizeStructureSearch(structureSearchKeyword.value)
    const groupMatches = keyword && [node.name, node.description, node.ordering]
      .some((value) => normalizeStructureSearch(value).includes(keyword))
    if (children.length || groupMatches || (!keyword && structureFilter.value === 'all')) {
      result.push({ ...node, children })
    }
  } else if (matchesStructureCriterion(node)) {
    result.push({ ...node, children: [] })
  }
  return result
}, [])

const visibleStructureTree = computed(() => filterStructureTree(structureTree.value))
const isStructureExpanded = (nodeId) => expandedStructureIds.value.has(String(nodeId))
const toggleStructureNode = (nodeId) => {
  const next = new Set(expandedStructureIds.value)
  const key = String(nodeId)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedStructureIds.value = next
}
const expandAllStructure = () => {
  expandedStructureIds.value = new Set(criteriaRows.value.filter((item) => item.nodeType === 'group').map((item) => String(item.id)))
}
const expandStructureFromDetail = (detail = {}) => {
  const criteria = Array.isArray(detail?.latestVersion?.criteria) ? detail.latestVersion.criteria : []
  expandedStructureIds.value = new Set(criteria.filter((item) => item.nodeType === 'group').map((item) => String(item.id)))
}
const collapseAllStructure = () => {
  expandedStructureIds.value = new Set()
}
const clearStructureSearch = () => {
  structureSearchInput.value = ''
  structureSearchKeyword.value = ''
  if (structureSearchTimer) window.clearTimeout(structureSearchTimer)
  structureSearchTimer = null
}
const selectStructureFilter = (value) => {
  structureFilter.value = value
  structureFilterOpen.value = false
}

const toggleStructureFilter = (event) => {
  if (!structureFilterOpen.value) {
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
    const spaceAbove = rect ? rect.top : 0
    structureFilterDirection.value = spaceBelow < 230 && spaceAbove > spaceBelow ? 'up' : 'down'
  }
  structureFilterOpen.value = !structureFilterOpen.value
}
const handleStructureSearchInput = (event) => {
  const value = String(event?.target?.value || '')
  structureSearchInput.value = value
  if (structureSearchTimer) window.clearTimeout(structureSearchTimer)
  structureSearchTimer = window.setTimeout(() => {
    structureSearchKeyword.value = value
    if (String(value || '').trim()) expandAllStructure()
    structureSearchTimer = null
  }, 300)
}

const tabs = [
  { id: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan' },
  { id: 'structure', label: 'Cấu trúc biểu mẫu', shortLabel: 'Cấu trúc' },
  { id: 'versions', label: 'Lịch sử version', shortLabel: 'Lịch sử' },
]

const selectTab = (tabId) => {
  activeTab.value = tabId
}

const toggleVersionActionMenu = (version, event) => {
  if (versionActionId.value === version.id) {
    versionActionId.value = null
    return
  }

  const buttonRect = event?.currentTarget?.getBoundingClientRect?.()
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  const spaceBelow = buttonRect ? viewportHeight - buttonRect.bottom : 0
  const spaceAbove = buttonRect ? buttonRect.top : 0
  versionActionDirection.value = spaceBelow < 240 && spaceAbove > spaceBelow ? 'up' : 'down'
  versionActionId.value = version.id
}

const latestVersionNote = computed(() => {
  const status = String(formDetail.value?.latestVersion?.status || '').toLowerCase()
  if (status === 'published') {
    return 'Đây là version đang áp dụng cho các phiếu QC tạo mới.'
  }

  if (status === 'archived') {
    return 'Version này đã được lưu trữ và không còn là bản làm việc hiện tại.'
  }

  return 'Đây là bản nháp đang mở để tiếp tục chỉnh sửa trước khi phát hành và áp dụng.'
})

const loadFormDetail = async () => {
  if (!formId.value) {
    errorMessage.value = 'Mã biểu mẫu không hợp lệ'
    return
  }

  loading.value = true
  errorMessage.value = ''
  formDetail.value = null

  try {
    formDetail.value = await getAdminQcFormById(formId.value)
    expandStructureFromDetail(formDetail.value)
    versions.value = await listAdminQcFormVersions(formId.value)
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không tải được chi tiết biểu mẫu QC'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/tools/qc-forms')
}

const openEditPage = () => {
  if (!formId.value || !existingDraftVersion.value?.id) {
    toast.error('Version đang áp dụng không thể sửa trực tiếp. Hãy tạo version mới trước.')
    actionMenuOpen.value = false
    return
  }
  actionMenuOpen.value = false
  router.push(`/tools/qc-forms/${formId.value}/versions/${existingDraftVersion.value.id}/edit`)
}

const createNewVersion = () => {
  if (existingDraftVersion.value?.id) {
    router.push(`/tools/qc-forms/${formId.value}/versions/${existingDraftVersion.value.id}/edit`)
    return
  }
  void createVersionFrom(formDetail.value?.activeVersion?.id || formDetail.value?.latestVersion?.id)
}

const createVersionFrom = async (sourceVersionId) => {
  if (!sourceVersionId || creatingVersion.value) return
  creatingVersion.value = true
  versionActionId.value = null
  try {
    const detail = await createAdminQcFormVersion(formId.value, sourceVersionId)
    toast.success(`Đã tạo ${detail.latestVersion?.versionNo || 'version mới'}`)
    router.push(`/tools/qc-forms/${formId.value}/versions/${detail.latestVersion.id}/edit`)
  } catch (error) {
    if ([404, 409].includes(Number(error?.response?.status || 0))) {
      await loadFormDetail()
      if (existingDraftVersion.value?.id) {
        toast.info(`Biểu mẫu đã có ${existingDraftVersion.value.versionNo || 'bản nháp'}, mình mở tiếp bản đó.`)
        router.push(`/tools/qc-forms/${formId.value}/versions/${existingDraftVersion.value.id}/edit`)
        return
      }
    }
    toast.error(error?.response?.data?.detail || error?.message || 'Không thể tạo version mới')
  } finally {
    creatingVersion.value = false
  }
}

const openVersion = async (versionId) => {
  versionActionId.value = null
  formDetail.value = await getAdminQcFormVersion(formId.value, versionId)
  activeTab.value = 'structure'
  expandStructureFromDetail(formDetail.value)
}

const editVersion = (version) => {
  versionActionId.value = null
  router.push(`/tools/qc-forms/${formId.value}/versions/${version.id}/edit`)
}

const applyVersion = async (version) => {
  const confirmed = await confirmDialog({ title: `Áp dụng ${version.versionNo}?`, message: 'Các phiếu QC tạo mới sẽ sử dụng version này. Phiếu đã tạo vẫn giữ version cũ.', confirmText: 'Áp dụng version', cancelText: 'Huỷ' })
  if (!confirmed) return
  applyingVersionId.value = version.id
  versionActionId.value = null
  try {
    await applyAdminQcFormVersion(formId.value, version.id)
    toast.success(`Đã áp dụng ${version.versionNo}`)
    await loadFormDetail()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.message || 'Không thể áp dụng version')
  } finally {
    applyingVersionId.value = null
  }
}

const deleteVersion = async (version) => {
  const confirmed = await confirmDialog({ title: `Xóa ${version.versionNo}?`, message: 'Version này sẽ bị xóa khỏi lịch sử biểu mẫu. Thao tác không thể hoàn tác.', confirmText: 'Xóa version', cancelText: 'Huỷ', tone: 'danger' })
  if (!confirmed) return
  deletingVersionId.value = version.id
  versionActionId.value = null
  try {
    await deleteAdminQcFormVersion(formId.value, version.id)
    toast.success(`Đã xóa ${version.versionNo}`)
    await loadFormDetail()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.message || 'Không thể xóa version')
  } finally {
    deletingVersionId.value = null
  }
}

const toggleActionMenu = (event) => {
  if (!actionMenuOpen.value) {
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
    const spaceAbove = rect ? rect.top : 0
    actionMenuDirection.value = spaceBelow < 110 && spaceAbove > spaceBelow ? 'up' : 'down'
  }
  actionMenuOpen.value = !actionMenuOpen.value
}

const closeActionMenu = (event) => {
  if (event?.target?.closest?.('[data-qc-form-action-menu]')) return
  actionMenuOpen.value = false
  if (!event?.target?.closest?.('[data-structure-filter]')) structureFilterOpen.value = false
}

const deleteForm = async () => {
  if (!formId.value || deleting.value) return
  actionMenuOpen.value = false

  const formName = formDetail.value?.name || 'biểu mẫu QC này'
  const confirmed = await confirmDialog({
    title: 'Xóa biểu mẫu QC?',
    message: `Bạn có chắc muốn xóa ${formName}? Thao tác này chỉ thành công khi biểu mẫu chưa có phiếu QC liên quan.`,
    confirmText: 'Xóa biểu mẫu',
    cancelText: 'Huỷ',
    tone: 'danger',
  })
  if (!confirmed) return

  deleting.value = true
  errorMessage.value = ''

  try {
    await deleteAdminQcForm(formId.value)
    toast.success('Đã xóa biểu mẫu QC')
    router.push('/tools/qc-forms')
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể xóa biểu mẫu QC'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  window.addEventListener('click', closeActionMenu)
  await loadFormDetail()
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeActionMenu)
  if (structureSearchTimer) window.clearTimeout(structureSearchTimer)
})
</script>

<template>
  <div class="app-page page-stack">
    <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
      <div class="flex min-w-0 gap-3">
        <button
          type="button"
          class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--text-primary)]"
          aria-label="Quay lại danh sách biểu mẫu QC"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>

        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 class="min-w-0 max-w-full truncate text-xl font-bold tracking-tight text-[var(--text-primary)] tablet:text-2xl">
            {{ formDetail?.code || formDetail?.name || 'Chi tiết biểu mẫu QC' }}
          </h1>
          <div v-if="formDetail" class="flex shrink-0 flex-wrap items-center gap-1.5">
            <span class="app-badge inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="formActiveClass">
              {{ formActiveLabel }}
            </span>
            <span class="app-badge inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(formDetail.latestVersion?.status)">
              {{ statusLabel(formDetail.latestVersion?.status) }} {{ formDetail.latestVersion?.versionNo || '' }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex w-full items-center justify-end gap-2 tablet:w-auto">
        <button
          type="button"
          class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] tablet:flex-none"
          @click="createNewVersion"
        >
          <span class="material-symbols-outlined text-[18px]">add</span>
          {{ existingDraftVersion?.id ? `Tiếp tục ${existingDraftVersion.versionNo}` : (creatingVersion ? 'Đang tạo...' : 'Tạo version mới') }}
        </button>

        <div class="relative" data-qc-form-action-menu>
          <button
            type="button"
            class="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="Mở menu thao tác biểu mẫu"
            :aria-expanded="actionMenuOpen"
            @click.stop="toggleActionMenu"
          >
            <span class="material-symbols-outlined text-[21px]">more_horiz</span>
          </button>

          <div
            v-if="actionMenuOpen"
            class="absolute right-0 z-30 w-44 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white py-1 shadow-xl"
            :class="actionMenuDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
          >
            <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" @click="openEditPage">
              <span class="material-symbols-outlined text-[18px]">edit</span>
              Chỉnh sửa
            </button>
            <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-bg)] disabled:cursor-not-allowed disabled:opacity-60" :disabled="deleting" @click="deleteForm">
              <span class="material-symbols-outlined text-[18px]">delete</span>
              {{ deleting ? 'Đang xóa...' : 'Xóa' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="app-state-banner">
      {{ errorMessage }}
    </p>

    <div v-else-if="loading" class="app-state-panel app-state-panel--center">
      <div class="app-state-stack">
        <div class="app-state-icon mx-auto">
          <span class="material-symbols-outlined text-[24px]">description</span>
        </div>
        <p class="app-state-title">Đang tải chi tiết biểu mẫu...</p>
        <p class="app-state-body">Thông tin biểu mẫu và cấu trúc tiêu chí sẽ xuất hiện sau khi tải xong.</p>
      </div>
    </div>

    <template v-else-if="formDetail">
      <nav class="rounded-xl border border-[var(--stroke)] bg-white p-1.5 shadow-sm tablet:rounded-none tablet:border-x-0 tablet:border-t-0 tablet:bg-transparent tablet:p-0 tablet:shadow-none" role="tablist" aria-label="Chi tiết biểu mẫu QC">
        <div class="grid grid-cols-3 gap-1 tablet:flex tablet:items-center tablet:gap-7 tablet:px-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="relative min-h-10 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] tablet:min-h-0 tablet:rounded-none tablet:px-1 tablet:pb-3 tablet:pt-1"
            :class="activeTab === tab.id ? 'bg-[var(--primary-softer)] text-[var(--primary)] tablet:bg-transparent' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] tablet:hover:bg-transparent'"
            :aria-selected="activeTab === tab.id"
            @click="selectTab(tab.id)"
          >
            <span class="inline-flex min-w-0 items-center justify-center gap-1.5">
              <span class="truncate tablet:hidden">{{ tab.shortLabel }}</span>
              <span class="hidden tablet:inline">{{ tab.label }}</span>
              <span
                v-if="tab.id === 'versions' && draftVersionsCount > 0"
                class="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold leading-none text-amber-700"
              >
                {{ draftVersionsCount }}
              </span>
            </span>
            <span v-if="activeTab === tab.id" class="hidden tablet:absolute tablet:inset-x-0 tablet:-bottom-px tablet:block tablet:h-0.5 tablet:rounded-full tablet:bg-[var(--primary)]"></span>
          </button>
        </div>
      </nav>

      <div v-if="activeTab === 'overview'" class="space-y-4" role="tabpanel">
        <section class="app-section p-3 tablet:p-5">
          <div class="grid gap-3 tablet:grid-cols-2 pc:grid-cols-4">
            <div class="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 tablet:rounded-xl tablet:p-4"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 tablet:size-11 tablet:rounded-xl"><span class="material-symbols-outlined">folder_copy</span></span><div class="min-w-0"><p class="truncate text-xs text-[var(--text-secondary)]">Tổng số nhóm</p><p class="mt-0.5 text-xl font-bold text-[var(--text-primary)] tablet:mt-1 tablet:text-2xl">{{ groupCount }}</p></div></div>
            <div class="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 tablet:rounded-xl tablet:p-4"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 tablet:size-11 tablet:rounded-xl"><span class="material-symbols-outlined">checklist</span></span><div class="min-w-0"><p class="truncate text-xs text-[var(--text-secondary)]">Tiêu chí tính điểm</p><p class="mt-0.5 text-xl font-bold text-[var(--text-primary)] tablet:mt-1 tablet:text-2xl">{{ scoringCriteriaCount }}</p></div></div>
            <div class="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 tablet:rounded-xl tablet:p-4"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 tablet:size-11 tablet:rounded-xl"><span class="material-symbols-outlined">trending_down</span></span><div class="min-w-0"><p class="truncate text-xs text-[var(--text-secondary)]">Tiêu chí khấu trừ</p><p class="mt-0.5 text-xl font-bold text-[var(--text-primary)] tablet:mt-1 tablet:text-2xl">{{ deductionCriteriaCount }}</p></div></div>
            <div class="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/60 p-3 tablet:rounded-xl tablet:p-4"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 tablet:size-11 tablet:rounded-xl"><span class="material-symbols-outlined">calculate</span></span><div class="min-w-0"><p class="truncate text-xs text-[var(--text-secondary)]">Tổng điểm tối đa</p><p class="mt-0.5 text-xl font-bold text-[var(--text-primary)] tablet:mt-1 tablet:text-2xl">{{ totalMaxScore }}</p></div></div>
          </div>
        </section>

        <div class="grid gap-4 pc:grid-cols-2">
          <section class="app-section p-4 tablet:p-5">
            <div class="flex items-center gap-2">
              <span class="inline-flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <span class="material-symbols-outlined text-[20px]">description</span>
              </span>
              <h3 class="text-base font-semibold text-[var(--text-primary)]">Thông tin biểu mẫu</h3>
            </div>
            <dl class="mt-5 space-y-4 text-sm">
              <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 tablet:grid-cols-[110px_minmax(0,1fr)]"><dt class="text-[var(--text-muted)]">Mã biểu mẫu</dt><dd class="break-words font-semibold text-[var(--text-primary)]">{{ formDetail.code }}</dd></div>
              <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 tablet:grid-cols-[110px_minmax(0,1fr)]"><dt class="text-[var(--text-muted)]">Tên biểu mẫu</dt><dd class="break-words font-semibold text-[var(--text-primary)]">{{ formDetail.name }}</dd></div>
              <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 tablet:grid-cols-[110px_minmax(0,1fr)]"><dt class="text-[var(--text-muted)]">Trạng thái form</dt><dd><span class="app-badge inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold" :class="formActiveClass">{{ formActiveLabel }}</span></dd></div>
              <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 tablet:grid-cols-[110px_minmax(0,1fr)]"><dt class="text-[var(--text-muted)]">Mô tả</dt><dd class="break-words leading-6 text-[var(--text-secondary)]">{{ formDetail.description || 'Chưa có mô tả.' }}</dd></div>
            </dl>
          </section>

          <section class="app-section p-4 tablet:p-5">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="inline-flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><span class="material-symbols-outlined text-[20px]">rule</span></span>
                <h3 class="text-base font-semibold text-[var(--text-primary)]">Quy tắc đánh giá</h3>
              </div>
              <span class="app-badge app-badge--success inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold">{{ formDetail.latestVersion?.versionNo || '--' }}</span>
            </div>
            <dl class="mt-5 space-y-4 text-sm">
              <div class="flex items-center justify-between gap-4"><dt class="text-[var(--text-muted)]">Ngưỡng đạt</dt><dd class="text-lg font-bold text-teal-600">{{ Number(formDetail.latestVersion?.passThreshold || 0) }}%</dd></div>
              <div class="flex items-center justify-between gap-4"><dt class="text-[var(--text-muted)]">Tổng điểm tối đa</dt><dd class="font-semibold text-[var(--text-primary)]">{{ totalMaxScore }} điểm</dd></div>
              <div class="flex items-center justify-between gap-4"><dt class="text-[var(--text-muted)]">Khấu trừ tối đa</dt><dd class="font-semibold text-rose-600">{{ totalDeduction }} điểm %</dd></div>
            </dl>
            <button type="button" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--primary)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-softer)]" @click="selectTab('structure')">
              <span class="material-symbols-outlined text-[18px]">account_tree</span>
              Xem cấu trúc
            </button>
          </section>

        </div>
      </div>

      <div v-else-if="activeTab === 'structure'" class="grid gap-4 pc:grid-cols-[minmax(0,1fr)_300px]" role="tabpanel">
        <section class="app-section overflow-hidden">

          <div class="grid gap-2 border-b border-[var(--stroke)] p-3 tablet:grid-cols-[minmax(0,1fr)_180px_auto] tablet:p-4">
            <label class="relative block">
              <Search :size="17" :stroke-width="2" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input :value="structureSearchInput" type="text" class="app-input h-10 w-full rounded-lg bg-white pl-10 pr-9 text-sm" placeholder="Tìm nhóm hoặc tiêu chí..." autocomplete="off" @input="handleStructureSearchInput" />
              <button v-if="structureSearchInput" type="button" class="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" aria-label="Xóa tìm kiếm" @click="clearStructureSearch"><X :size="14" /></button>
            </label>
            <div class="relative" data-structure-filter>
              <button type="button" class="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)]" :aria-expanded="structureFilterOpen" @click.stop="toggleStructureFilter($event)">
                <span class="truncate">{{ structureFilterLabel }}</span>
                <ChevronDown :size="16" :stroke-width="2" class="shrink-0 transition-transform" :class="structureFilterOpen ? 'rotate-180' : ''" />
              </button>
              <div v-if="structureFilterOpen" class="absolute left-0 z-30 w-full min-w-48 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white p-1 shadow-xl" :class="structureFilterDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'">
                <button v-for="option in structureFilterOptions" :key="option.value" type="button" class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors" :class="structureFilter === option.value ? 'bg-[var(--primary-softer)] font-semibold text-[var(--primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'" @click="selectStructureFilter(option.value)">
                  {{ option.label }}
                  <Check v-if="structureFilter === option.value" :size="15" :stroke-width="2.5" />
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 tablet:flex tablet:items-center">
              <button type="button" class="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" @click="expandAllStructure"><ChevronsUpDown :size="16" :stroke-width="2" />Mở rộng</button>
              <button type="button" class="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--stroke-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" @click="collapseAllStructure"><ChevronsDownUp :size="16" :stroke-width="2" />Thu gọn</button>
            </div>
          </div>

          <div v-if="visibleStructureTree.length" class="border-t-0">
            <QcFormStructureNode v-for="node in visibleStructureTree" :key="node.id" :node="node" :expanded-ids="expandedStructureIds" @toggle="toggleStructureNode" />
          </div>
          <div v-else class="p-8 text-center">
            <span class="material-symbols-outlined text-3xl text-[var(--text-muted)]">search_off</span>
            <p class="mt-2 text-sm font-semibold text-[var(--text-primary)]">Không tìm thấy nội dung phù hợp</p>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">Thử thay đổi từ khóa hoặc loại tiêu chí.</p>
          </div>
        </section>

        <aside class="space-y-4">
          <section class="app-section app-section--padded">
            <h3 class="text-base font-semibold text-[var(--text-primary)]">Tóm tắt cấu trúc</h3>
            <div class="mt-4 space-y-3">
              <div class="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><span class="inline-flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><span class="material-symbols-outlined">folder_copy</span></span><div><p class="text-xs text-[var(--text-secondary)]">Tổng số nhóm</p><p class="text-xl font-bold text-[var(--text-primary)]">{{ groupCount }}</p></div></div>
              <div class="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><span class="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><span class="material-symbols-outlined">checklist</span></span><div><p class="text-xs text-[var(--text-secondary)]">Tiêu chí tính điểm</p><p class="text-xl font-bold text-[var(--text-primary)]">{{ scoringCriteriaCount }}</p></div></div>
              <div class="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><span class="inline-flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><span class="material-symbols-outlined">trending_down</span></span><div><p class="text-xs text-[var(--text-secondary)]">Tiêu chí khấu trừ</p><p class="text-xl font-bold text-[var(--text-primary)]">{{ deductionCriteriaCount }}</p></div></div>
              <div class="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3"><span class="inline-flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><span class="material-symbols-outlined">calculate</span></span><div><p class="text-xs text-[var(--text-secondary)]">Tổng điểm tối đa</p><p class="text-xl font-bold text-[var(--text-primary)]">{{ totalMaxScore }} điểm</p></div></div>
            </div>
          </section>

          <section class="app-section app-section--padded">
            <div class="flex items-center justify-between gap-3"><h3 class="text-base font-semibold text-[var(--text-primary)]">Thông tin version</h3><span class="app-badge app-badge--success rounded-lg px-2.5 py-1 text-xs font-semibold">{{ formDetail.latestVersion?.versionNo || '--' }}</span></div>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-3"><dt class="text-[var(--text-muted)]">Trạng thái</dt><dd class="font-semibold text-[var(--text-primary)]">{{ statusLabel(formDetail.latestVersion?.status) }}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-[var(--text-muted)]">Ngưỡng đạt</dt><dd class="font-semibold text-teal-600">{{ Number(formDetail.latestVersion?.passThreshold || 0) }}%</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-[var(--text-muted)]">Khấu trừ tối đa</dt><dd class="font-semibold text-rose-600">{{ totalDeduction }} điểm %</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <div v-else class="space-y-4" role="tabpanel">
        <section class="app-section overflow-hidden">
          <div class="divide-y divide-[var(--stroke)]">
            <article v-for="version in versions" :key="version.id" class="flex flex-col gap-3 px-4 py-4 tablet:flex-row tablet:items-center tablet:justify-between tablet:px-5">
              <div class="flex min-w-0 items-center gap-3">
                <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" :class="version.isActive ? 'bg-emerald-50 text-emerald-600' : version.status === 'draft' ? 'bg-amber-50 text-amber-600' : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'"><span class="material-symbols-outlined text-[20px]">history</span></span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2"><h4 class="font-semibold text-[var(--text-primary)]">{{ version.versionNo }}</h4><span v-if="version.isActive" class="app-badge app-badge--success rounded-lg px-2 py-0.5 text-[11px] font-semibold">Đang áp dụng</span><span v-else class="app-badge rounded-lg px-2 py-0.5 text-[11px] font-semibold" :class="statusClass(version.status)">{{ statusLabel(version.status) }}</span></div>
                  <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ version.criteriaCount }} tiêu chí · Ngưỡng {{ Number(version.passThreshold || 0) }}%</p>
                  <p class="mt-1 text-xs text-[var(--text-muted)]">Cập nhật {{ version.updatedAt ? new Date(version.updatedAt).toLocaleString('vi-VN') : '--' }}</p>
                </div>
              </div>
              <div class="flex w-full items-center justify-end gap-2 tablet:w-auto">
                <button v-if="version.status === 'draft'" type="button" class="app-button-primary min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-semibold tablet:flex-none" @click="editVersion(version)">Tiếp tục chỉnh sửa</button>
                <div class="relative">
                  <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" aria-label="Mở thao tác version" @click="toggleVersionActionMenu(version, $event)"><span class="material-symbols-outlined text-[18px]">more_horiz</span></button>
                  <div v-if="versionActionId === version.id" class="absolute right-0 z-30 w-56 overflow-hidden rounded-xl border border-[var(--stroke)] bg-white p-1 shadow-xl" :class="versionActionDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'">
                    <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" @click="openVersion(version.id)"><span class="material-symbols-outlined text-[17px]">visibility</span>Xem cấu trúc</button>
                    <button v-if="version.status !== 'draft' && !version.isActive" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-60" :disabled="applyingVersionId === version.id" @click="applyVersion(version)"><span class="material-symbols-outlined text-[17px]">publish</span>{{ applyingVersionId === version.id ? 'Đang áp dụng...' : 'Áp dụng lại version' }}</button>
                    <button v-if="!existingDraftVersion && version.status !== 'draft'" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" @click="createVersionFrom(version.id)"><span class="material-symbols-outlined text-[17px]">content_copy</span>Tạo version mới từ đây</button>
                    <button v-if="!version.isActive" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--danger-text)] hover:bg-[var(--danger-bg)]" :disabled="deletingVersionId === version.id" @click="deleteVersion(version)"><span class="material-symbols-outlined text-[17px]">delete</span>{{ deletingVersionId === version.id ? 'Đang xóa...' : 'Xóa version' }}</button>
                  </div>
                </div>
              </div>
            </article>
            <div v-if="!versions.length" class="p-8 text-center text-sm text-[var(--text-secondary)]">Chưa có dữ liệu version.</div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
