<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommonModal from '@/components/CommonModal.vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import { getQcFindingById, listQcFindings, qcHelpers, rejectQcFinding, resolveQcFinding, startQcFinding, uploadQcFindingEvidence, verifyQcFinding } from '@/services/qc_service'

const MAX_EVIDENCE_IMAGES = 5
const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'open', label: 'Chờ khắc phục' },
  { id: 'in_progress', label: 'Đang khắc phục' },
  { id: 'resolved', label: 'Chờ QC xác nhận' },
  { id: 'rejected', label: 'Khắc phục chưa đạt' },
  { id: 'verified', label: 'Đã hoàn tất' },
]

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
  storeId: {
    type: [String, Number],
    default: '',
  },
  sessionId: {
    type: [String, Number],
    default: '',
  },
})

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const toast = useToast()
const loading = ref(false)
const loadError = ref('')
const findings = ref([])
const activeStatus = ref('all')
const searchInput = ref('')
const detailOpen = ref(false)
const selectedFinding = ref(null)
const actionLoading = ref(false)
const evidenceUploading = ref(false)
const previewImage = ref(null)
const remediationForm = reactive({
  correctiveNote: '',
  correctiveAction: '',
  evidence: [],
})
const rejectForm = reactive({
  reason: '',
})
const verifyForm = reactive({
  note: '',
})

const statusMeta = {
  open: { label: 'Chờ khắc phục', class: 'app-badge--warning' },
  in_progress: { label: 'Đang khắc phục', class: 'app-badge--info' },
  resolved: { label: 'Chờ QC xác nhận', class: 'app-badge--warning' },
  verified: { label: 'Đã hoàn tất', class: 'app-badge--success' },
  rejected: { label: 'Khắc phục chưa đạt', class: 'app-badge--danger' },
}

const isOverdue = (finding) => {
  if (!finding?.dueDate || finding.status === 'verified') return false
  const due = new Date(finding.dueDate).getTime()
  return Number.isFinite(due) && due < Date.now()
}

const daysOverdue = (finding) => {
  if (!isOverdue(finding)) return 0
  const due = new Date(finding.dueDate).getTime()
  return Math.max(Math.ceil((Date.now() - due) / 86400000), 1)
}

const getStoreName = (finding) => (
  finding?.store?.shortAddress ||
  finding?.store?.address ||
  finding?.store?.name ||
  finding?.store?.code ||
  (finding?.storeId ? `Cửa hàng #${finding.storeId}` : '--')
)

const getSessionCode = (finding) => finding?.metaInfo?.session_code || (finding?.sessionId ? `#${finding.sessionId}` : '--')
const statusLabel = (status) => statusMeta[status]?.label || status || '--'
const activeStatusLabel = computed(() => STATUS_TABS.find((tab) => tab.id === activeStatus.value)?.label || 'Tất cả')
const statusClass = (status) => statusMeta[status]?.class || 'app-badge--neutral'
const formatFileSize = (bytes) => `${Math.round(Number(bytes || 0) / 1024 / 1024)}MB`
const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const canStoreAct = computed(() => ['admin', 'store'].includes(userRole.value))
const canQcAct = computed(() => ['admin', 'qc'].includes(userRole.value))
const imageSource = (image) => image?.previewUrl || image?.url || image?.dataUrl || image?.preview || ''
const imageName = (image, index) => image?.name || `Ảnh ${index + 1}`
const normalizeTimelineType = (type) => {
  if (type === 'started') return 'Bắt đầu khắc phục'
  if (type === 'resolved') return 'Cửa hàng gửi khắc phục'
  if (type === 'verified') return 'QC xác nhận hoàn tất'
  if (type === 'rejected') return 'QC yêu cầu khắc phục lại'
  return 'Cập nhật khắc phục'
}

const propStoreId = computed(() => String(props.storeId || '').trim())
const propSessionId = computed(() => String(props.sessionId || '').trim())

const filteredFindings = computed(() => {
  const keyword = searchInput.value.trim().toLowerCase()
  return findings.value.filter((finding) => {
    if (propStoreId.value && String(finding.storeId || '') !== propStoreId.value) return false
    if (propSessionId.value && String(finding.sessionId || '') !== propSessionId.value) return false
    if (activeStatus.value !== 'all' && finding.status !== activeStatus.value) return false
    if (!keyword) return true
    return [
      finding.findingCode,
      finding.criterionName,
      getStoreName(finding),
      getSessionCode(finding),
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword)
  })
})

const routeFindingId = computed(() => String(props.embedded ? route.query.findingId || '' : route.params.findingId || '').trim())

const selectedMeta = computed(() => selectedFinding.value?.metaInfo || {})
const selectedTimeline = computed(() => {
  const timeline = Array.isArray(selectedMeta.value?.timeline) ? selectedMeta.value.timeline : []
  const base = selectedFinding.value
    ? [{ type: 'created', label: 'QC tạo yêu cầu khắc phục', at: selectedFinding.value.createdAt, by: selectedMeta.value.auditor_id }]
    : []
  return [
    ...base,
    ...timeline.map((item) => ({
      ...item,
      label: normalizeTimelineType(item?.type),
    })),
  ]
})
const qcDetectionImages = computed(() => {
  const images = selectedMeta.value?.qc_attachments
  return Array.isArray(images) ? images.filter((image) => imageSource(image)) : []
})
const remediationImages = computed(() => {
  const images = selectedFinding.value?.evidence
  return Array.isArray(images) ? images.filter((image) => imageSource(image)) : []
})
const canStartSelected = computed(() => canStoreAct.value && ['open', 'rejected'].includes(selectedFinding.value?.status))
const canResolveSelected = computed(() => canStoreAct.value && ['open', 'in_progress', 'rejected'].includes(selectedFinding.value?.status))
const canReviewSelected = computed(() => canQcAct.value && selectedFinding.value?.status === 'resolved')

const kpis = computed(() => {
  const source = findings.value
  return [
    {
      label: 'Khắc phục đang mở',
      value: source.filter((item) => ['open', 'in_progress', 'rejected'].includes(item.status)).length,
      tone: 'text-[var(--warning-text)]',
    },
    {
      label: 'Chờ xác nhận',
      value: source.filter((item) => item.status === 'resolved').length,
      tone: 'text-[var(--primary)]',
    },
    {
      label: 'Quá hạn',
      value: source.filter(isOverdue).length,
      tone: 'text-[var(--danger-text)]',
    },
    {
      label: 'Đã hoàn tất',
      value: source.filter((item) => item.status === 'verified').length,
      tone: 'text-[var(--success-text)]',
    },
  ]
})

const replaceFinding = (finding) => {
  if (!finding) return
  const index = findings.value.findIndex((item) => String(item.id) === String(finding.id))
  if (index >= 0) findings.value.splice(index, 1, finding)
  else findings.value.unshift(finding)
  selectedFinding.value = finding
}

const openFindingDetail = (finding) => {
  selectedFinding.value = finding
  remediationForm.correctiveNote = finding?.correctiveNote || ''
  remediationForm.correctiveAction = finding?.correctiveAction || ''
  remediationForm.evidence = Array.isArray(finding?.evidence) ? finding.evidence.map((item) => ({ ...item })) : []
  rejectForm.reason = ''
  verifyForm.note = ''
  detailOpen.value = true
}

const openImagePreview = (image, index = 0) => {
  const source = imageSource(image)
  if (!source) return
  previewImage.value = { ...image, source, name: imageName(image, index) }
}

const closeImagePreview = () => {
  previewImage.value = null
}

const closeFindingDetail = () => {
  if (actionLoading.value) return
  detailOpen.value = false
  previewImage.value = null
  if (props.embedded && route.query.findingId) {
    const nextQuery = { ...route.query }
    delete nextQuery.findingId
    router.replace({ query: nextQuery })
  } else if (route.params.findingId) {
    router.push('/QC?view=findings')
  }
}

const runFindingAction = async (action, successMessage) => {
  if (!selectedFinding.value?.id) return
  actionLoading.value = true
  try {
    const updated = await action()
    replaceFinding(updated)
    toast.success(successMessage)
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không xử lý được yêu cầu khắc phục.')
  } finally {
    actionLoading.value = false
  }
}

const handleEvidenceUpload = async (event) => {
  const input = event?.target
  const selectedFiles = Array.from(input?.files || [])
  if (!selectedFiles.length) return

  const availableSlots = MAX_EVIDENCE_IMAGES - remediationForm.evidence.length
  if (availableSlots <= 0) {
    toast.error(`Mỗi lần khắc phục tối đa ${MAX_EVIDENCE_IMAGES} ảnh.`)
    if (input) input.value = ''
    return
  }

  const filesToUpload = []
  const issues = []
  for (const file of selectedFiles.slice(0, availableSlots)) {
    if (!String(file.type || '').startsWith('image/')) {
      issues.push(`${file.name}: không phải định dạng ảnh`)
      continue
    }
    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      issues.push(`${file.name}: vượt quá ${formatFileSize(MAX_EVIDENCE_SIZE_BYTES)}`)
      continue
    }
    filesToUpload.push(file)
  }

  if (selectedFiles.length > availableSlots) {
    issues.push(`Chỉ thêm ${availableSlots}/${selectedFiles.length} ảnh do giới hạn tối đa`)
  }
  if (!filesToUpload.length) {
    if (issues.length) toast.error(issues[0])
    if (input) input.value = ''
    return
  }

  evidenceUploading.value = true
  try {
    const formData = new FormData()
    filesToUpload.forEach((file) => formData.append('files', file))
    const uploadedFiles = await uploadQcFindingEvidence(formData)
    remediationForm.evidence = [...remediationForm.evidence, ...uploadedFiles]
    toast.success(`Đã upload ${uploadedFiles.length} ảnh minh chứng.`)
    if (issues.length) toast.error(issues[0])
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không upload được ảnh minh chứng.')
  } finally {
    evidenceUploading.value = false
    if (input) input.value = ''
  }
}

const removeEvidence = (index) => {
  remediationForm.evidence.splice(index, 1)
}

const handleStartFinding = () => runFindingAction(
  () => startQcFinding(selectedFinding.value.id),
  'Đã bắt đầu khắc phục'
)

const handleResolveFinding = () => {
  const correctiveNote = remediationForm.correctiveNote.trim()
  if (!correctiveNote) {
    toast.error('Vui lòng nhập nội dung khắc phục.')
    return
  }

  return runFindingAction(
    () => resolveQcFinding(selectedFinding.value.id, {
      corrective_note: correctiveNote,
      corrective_action: remediationForm.correctiveAction.trim() || undefined,
      evidence: remediationForm.evidence,
    }),
    'Đã gửi khắc phục'
  )
}

const handleVerifyFinding = () => runFindingAction(
  () => verifyQcFinding(selectedFinding.value.id, { verify_note: verifyForm.note.trim() || undefined }),
  'Đã xác nhận hoàn tất khắc phục'
)

const handleRejectFinding = () => {
  const rejectionReason = rejectForm.reason.trim()
  if (!rejectionReason) {
    toast.error('Vui lòng nhập lý do yêu cầu khắc phục lại.')
    return
  }

  return runFindingAction(
    () => rejectQcFinding(selectedFinding.value.id, { rejection_reason: rejectionReason }),
    'Đã yêu cầu khắc phục lại'
  )
}

const openFindingFromRoute = async () => {
  const findingId = routeFindingId.value
  if (!findingId) return

  const localFinding = findings.value.find((item) => String(item.id) === findingId || String(item.findingCode) === findingId)
  if (localFinding) {
    openFindingDetail(localFinding)
    return
  }

  try {
    const remoteFinding = await getQcFindingById(findingId)
    if (remoteFinding) {
      replaceFinding(remoteFinding)
      openFindingDetail(remoteFinding)
    }
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được chi tiết khắc phục.')
  }
}

const loadFindings = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const params = { limit: 500 }
    if (propStoreId.value) params.store_id = propStoreId.value
    if (propSessionId.value) params.session_id = propSessionId.value
    findings.value = await listQcFindings(params)
    await openFindingFromRoute()
  } catch (error) {
    findings.value = []
    loadError.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được danh sách khắc phục QC.'
  } finally {
    loading.value = false
  }
}

watch(activeStatus, () => {
  searchInput.value = searchInput.value.trimStart()
})

watch(
  () => [propStoreId.value, propSessionId.value],
  () => {
    void loadFindings()
  }
)

watch(
  () => routeFindingId.value,
  () => {
    if (routeFindingId.value) openFindingFromRoute()
    else if (detailOpen.value) detailOpen.value = false
  }
)

onMounted(loadFindings)
</script>

<template>
  <div :class="props.embedded ? 'space-y-4' : 'app-page space-y-4'">
    <template v-if="!props.embedded">
      <section class="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">QC cửa hàng</p>
          <h2 class="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">Khắc phục</h2>
        </div>
        <button type="button" class="app-button-secondary inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" @click="loadFindings">
          <span class="material-symbols-outlined text-[18px]">refresh</span>
          Làm mới
        </button>
      </section>

      <section class="grid grid-cols-2 gap-3 pc:grid-cols-4">
        <div v-for="item in kpis" :key="item.label" class="rounded-lg border border-[var(--stroke)] bg-white p-4">
          <p class="text-xs font-medium text-[var(--text-secondary)]">{{ item.label }}</p>
          <p class="mt-2 text-2xl font-bold" :class="item.tone">{{ item.value }}</p>
        </div>
      </section>
    </template>

    <section class="rounded-lg border border-[var(--stroke)] bg-white">
      <div class="border-b border-[var(--stroke)] p-3">
        <div class="flex flex-col gap-2 tablet:flex-row tablet:items-center">
          <label class="relative block tablet:w-56">
            <select
              v-model="activeStatus"
              class="h-9 w-full appearance-none rounded-lg border border-[var(--stroke)] bg-white px-3 pr-9 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-0"
              :aria-label="`Lọc khắc phục: ${activeStatusLabel}`"
            >
              <option v-for="tab in STATUS_TABS" :key="tab.id" :value="tab.id">{{ tab.label }}</option>
            </select>
            <span class="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-secondary)]">expand_more</span>
          </label>

          <label class="relative block min-w-0 flex-1">
            <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-secondary)]">search</span>
            <input v-model="searchInput" type="search" class="h-9 w-full rounded-lg border border-[var(--stroke)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none" placeholder="Tìm mã, tiêu chí, cửa hàng..." />
          </label>

          <button v-if="props.embedded" type="button" class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:w-auto" @click="loadFindings">
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            Tải lại
          </button>
        </div>
      </div>

      <div v-if="loadError" class="m-3 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm font-medium text-[var(--danger-text)]">
        {{ loadError }}
      </div>

      <div v-if="loading" class="p-8 text-center text-sm text-[var(--text-secondary)]">Đang tải danh sách khắc phục...</div>

      <div v-else-if="filteredFindings.length === 0" class="p-8 text-center">
        <p class="text-sm font-semibold text-[var(--text-primary)]">Chưa có yêu cầu khắc phục phù hợp.</p>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">Thử đổi bộ lọc hoặc làm mới dữ liệu.</p>
      </div>

      <div v-else class="divide-y divide-[var(--stroke)]">
        <article
          v-for="finding in filteredFindings"
          :key="finding.id"
          class="mx-3 my-2 grid cursor-pointer gap-3 rounded-lg border border-[var(--stroke)] bg-white px-4 py-3 transition-all hover:border-[var(--primary)] hover:shadow-sm tablet:grid-cols-[34px_minmax(0,1fr)_118px_128px_40px] tablet:items-center"
          :class="selectedFinding?.id === finding.id && detailOpen ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : ''"
          role="button"
          tabindex="0"
          @click="props.embedded ? router.replace({ query: { ...route.query, view: 'findings', findingId: finding.id } }) : router.push(`/QC/findings/${finding.id}`)"
          @keydown.enter.prevent="props.embedded ? router.replace({ query: { ...route.query, view: 'findings', findingId: finding.id } }) : router.push(`/QC/findings/${finding.id}`)"
        >
          <span class="material-symbols-outlined text-[26px] text-[var(--warning-text)]">flag</span>

          <div class="min-w-0">
            <p class="truncate text-[11px] font-bold uppercase text-[var(--text-secondary)]">{{ finding.findingCode || `FD-${finding.id}` }}</p>
            <h3 class="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{{ finding.criterionName || finding.metaInfo?.criterion_name || 'Tiêu chí QC không đạt' }}</h3>
            <p class="mt-1 truncate text-xs font-medium text-[var(--text-secondary)]">{{ getSessionCode(finding) }} • {{ getStoreName(finding) }}</p>
          </div>

          <div class="text-xs">
            <p class="font-semibold text-[var(--text-secondary)]">{{ finding.status === 'verified' ? 'Hoàn tất lúc' : 'Hạn khắc phục' }}</p>
            <p class="mt-1 font-bold" :class="isOverdue(finding) ? 'text-[var(--danger-text)]' : finding.status === 'verified' ? 'text-[var(--text-primary)]' : 'text-[var(--danger-text)]'">
              {{ finding.status === 'verified' && finding.verifiedAt ? qcHelpers.toDateLabel(finding.verifiedAt) : finding.dueDate ? qcHelpers.toDateLabel(finding.dueDate) : '--' }}
            </p>
          </div>

          <div class="text-xs tablet:text-center">
            <p class="font-semibold text-[var(--text-secondary)]">Trạng thái</p>
            <span class="app-badge mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" :class="statusClass(finding.status)">{{ statusLabel(finding.status) }}</span>
          </div>

          <span class="material-symbols-outlined justify-self-end text-[22px] text-[var(--text-primary)]">chevron_right</span>
        </article>
      </div>
    </section>

    <div v-if="detailOpen" class="fixed inset-0 z-[110] bg-blue-950/20" @click="closeFindingDetail"></div>
    <aside
      v-if="detailOpen"
      class="fixed inset-y-0 right-0 z-[111] flex w-full max-w-[420px] flex-col border-l border-[var(--stroke)] bg-white shadow-2xl"
      aria-label="Chi tiết khắc phục"
    >
      <div class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--stroke)] px-4">
        <h3 class="text-base font-bold text-[var(--text-primary)]">Chi tiết lỗi</h3>
        <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-muted)]" :disabled="actionLoading" aria-label="Đóng chi tiết" @click="closeFindingDetail">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div v-if="selectedFinding" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section class="grid gap-3 border-b border-[var(--stroke)] pb-4">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{{ selectedFinding.findingCode || `FD-${selectedFinding.id}` }}</p>
            <h3 class="mt-1 text-lg font-bold text-[var(--text-primary)]">{{ selectedFinding.criterionName || selectedMeta?.criterion_name || 'Tiêu chí QC không đạt' }}</h3>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ getStoreName(selectedFinding) }} · Phiên QC {{ getSessionCode(selectedFinding) }}</p>
          </div>
          <div class="flex flex-wrap items-start justify-end gap-2">
            <span class="app-badge inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide" :class="statusClass(selectedFinding.status)">{{ statusLabel(selectedFinding.status) }}</span>
            <span v-if="isOverdue(selectedFinding)" class="inline-flex rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--danger-text)]">Quá hạn {{ daysOverdue(selectedFinding) }} ngày</span>
          </div>
        </section>

        <section class="grid gap-4">
          <div class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">QC phát hiện</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Tiêu chí</dt><dd class="mt-1 text-[var(--text-primary)]">{{ selectedMeta?.criterion_name || selectedFinding.criterionName || '--' }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ghi chú QC</dt><dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedMeta?.qc_note || '--' }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ngày phát hiện</dt><dd class="mt-1 text-[var(--text-primary)]">{{ qcHelpers.toDateLabel(selectedMeta?.detected_at || selectedFinding.createdAt) }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Hạn xử lý</dt><dd class="mt-1 text-[var(--text-primary)]">{{ selectedFinding.dueDate ? qcHelpers.toDateLabel(selectedFinding.dueDate) : '--' }}</dd></div>
            </dl>
            <div class="mt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ảnh QC phát hiện</p>
              <div v-if="qcDetectionImages.length" class="mt-2 grid grid-cols-3 gap-2">
                <button v-for="(image, index) in qcDetectionImages" :key="image.id || `${imageName(image, index)}-${index}`" type="button" class="overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]" @click="openImagePreview(image, index)">
                  <img :src="imageSource(image)" :alt="imageName(image, index)" class="aspect-square w-full object-cover" />
                </button>
              </div>
              <p v-else class="mt-2 text-xs text-[var(--text-secondary)]">Chưa có ảnh.</p>
            </div>
          </div>

          <div class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">Cửa hàng đã khắc phục</h4>
            <dl class="mt-3 space-y-2 text-sm">
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Nội dung</dt><dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedFinding.correctiveNote || '--' }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Thao tác</dt><dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedFinding.correctiveAction || '--' }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ngày gửi</dt><dd class="mt-1 text-[var(--text-primary)]">{{ selectedFinding.resolvedAt ? qcHelpers.toDateLabel(selectedFinding.resolvedAt) : '--' }}</dd></div>
              <div><dt class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Minh chứng</dt><dd class="mt-1 text-[var(--text-primary)]">{{ remediationImages.length }} ảnh</dd></div>
            </dl>
            <div class="mt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ảnh minh chứng</p>
              <div v-if="remediationImages.length" class="mt-2 grid grid-cols-3 gap-2">
                <button v-for="(image, index) in remediationImages" :key="image.id || `${imageName(image, index)}-${index}`" type="button" class="overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]" @click="openImagePreview(image, index)">
                  <img :src="imageSource(image)" :alt="imageName(image, index)" class="aspect-square w-full object-cover" />
                </button>
              </div>
              <p v-else class="mt-2 text-xs text-[var(--text-secondary)]">Chưa có ảnh.</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
          <h4 class="text-sm font-bold text-[var(--text-primary)]">Timeline xử lý</h4>
          <ol class="mt-3 space-y-3">
            <li v-for="(event, index) in selectedTimeline" :key="`${event.type}-${event.at}-${index}`" class="flex gap-3 text-sm">
              <span class="mt-1 size-2 rounded-full bg-[var(--primary)]"></span>
              <div>
                <p class="font-semibold text-[var(--text-primary)]">{{ event.label }}</p>
                <p class="text-xs text-[var(--text-secondary)]">{{ event.at ? qcHelpers.toDateLabel(event.at) : '--' }}</p>
                <p v-if="event.reason" class="mt-1 text-xs text-[var(--danger-text)]">{{ event.reason }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="canResolveSelected" class="rounded-lg border border-[var(--stroke)] bg-white p-4">
          <h4 class="text-sm font-bold text-[var(--text-primary)]">Gửi khắc phục</h4>
          <div class="mt-3 grid gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung khắc phục *</span>
              <textarea v-model="remediationForm.correctiveNote" rows="3" class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"></textarea>
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-[var(--text-secondary)]">Thao tác bổ sung</span>
              <input v-model="remediationForm.correctiveAction" type="text" class="mt-1 h-10 w-full rounded-lg border border-[var(--stroke)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none" />
            </label>
            <div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-semibold text-[var(--text-secondary)]">Ảnh minh chứng</span>
                <label class="app-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold">
                  <span class="material-symbols-outlined text-[16px]">upload</span>
                  {{ evidenceUploading ? 'Đang upload...' : 'Upload ảnh' }}
                  <input type="file" accept="image/*" multiple class="hidden" :disabled="evidenceUploading" @change="handleEvidenceUpload" />
                </label>
              </div>
              <div v-if="remediationForm.evidence.length" class="mt-2 grid gap-2 tablet:grid-cols-2">
                <div v-for="(image, index) in remediationForm.evidence" :key="image.id || `${image.name}-${index}`" class="flex items-center gap-2 rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] p-2">
                  <button type="button" class="shrink-0" @click="openImagePreview(image, index)">
                    <img :src="imageSource(image)" alt="Ảnh minh chứng" class="size-12 rounded-md object-cover" />
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-semibold text-[var(--text-primary)]">{{ image.name || `Ảnh ${index + 1}` }}</p>
                    <p class="text-[11px] text-[var(--text-secondary)]">{{ image.size ? formatFileSize(image.size) : '--' }}</p>
                  </div>
                  <button type="button" class="inline-flex size-7 items-center justify-center rounded-md text-[var(--danger-text)] hover:bg-white" @click="removeEvidence(index)">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="canReviewSelected" class="grid gap-4">
          <div class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">Xác nhận hoàn tất</h4>
            <textarea v-model="verifyForm.note" rows="3" class="mt-3 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none" placeholder="Ghi chú xác nhận..."></textarea>
          </div>
          <div class="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
            <h4 class="text-sm font-bold text-[var(--danger-text)]">Yêu cầu khắc phục lại</h4>
            <textarea v-model="rejectForm.reason" rows="3" class="mt-3 w-full rounded-lg border border-[var(--danger-border)] px-3 py-2 text-sm focus:border-[var(--danger-text)] focus:outline-none" placeholder="Lý do *"></textarea>
          </div>
        </section>

        <div class="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-[var(--stroke)] bg-white px-4 py-3">
          <button type="button" class="app-button-secondary rounded-lg px-3 py-2 text-sm font-semibold" :disabled="actionLoading || evidenceUploading" @click="closeFindingDetail">Đóng</button>
          <button v-if="canStartSelected" type="button" class="app-button-secondary rounded-lg px-3 py-2 text-sm font-semibold" :disabled="actionLoading || evidenceUploading" @click="handleStartFinding">Bắt đầu khắc phục</button>
          <button v-if="canResolveSelected" type="button" class="app-button-primary rounded-lg px-3 py-2 text-sm font-semibold" :disabled="actionLoading || evidenceUploading" @click="handleResolveFinding">Gửi khắc phục</button>
          <button v-if="canReviewSelected" type="button" class="app-button-danger rounded-lg px-3 py-2 text-sm font-semibold" :disabled="actionLoading || evidenceUploading" @click="handleRejectFinding">Yêu cầu khắc phục lại</button>
          <button v-if="canReviewSelected" type="button" class="app-button-primary rounded-lg px-3 py-2 text-sm font-semibold" :disabled="actionLoading || evidenceUploading" @click="handleVerifyFinding">Xác nhận hoàn tất</button>
        </div>
      </div>
    </aside>

    <CommonModal
      :model-value="Boolean(previewImage)"
      title="Xem ảnh"
      max-width-class="max-w-4xl"
      @close="closeImagePreview"
      @update:model-value="(value) => { if (!value) closeImagePreview() }"
    >
      <div v-if="previewImage" class="space-y-3">
        <img :src="previewImage.source" :alt="previewImage.name" class="max-h-[72vh] w-full rounded-lg object-contain" />
        <p class="text-sm font-medium text-[var(--text-secondary)]">{{ previewImage.name }}</p>
      </div>
    </CommonModal>
  </div>
</template>
