<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import EvidenceGallery from '@/components/EvidenceGallery.vue'
import EvidenceViewer from '@/components/EvidenceViewer.vue'
import {
  listQcFindings,
  qcHelpers,
  resolveQcFinding,
  reviewQcFindingsBatch,
  uploadQcFindingEvidence,
} from '@/services/qc_service'

const MAX_EVIDENCE_IMAGES = 5
const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024

const emit = defineEmits(['action-state'])

const props = defineProps({
  storeId: {
    type: [String, Number],
    default: '',
  },
  sessionId: {
    type: [String, Number],
    required: true,
  },
})

const { state } = useApp()
const toast = useToast()
const loading = ref(false)
const actionLoading = ref(false)
const uploadTargetId = ref('')
const loadError = ref('')
const findings = ref([])
const selectedFindingId = ref('')
const detailPanelOpen = ref(false)
const evidenceViewerOpen = ref(false)
const evidenceViewerImages = ref([])
const evidenceViewerSource = ref('qc')
const evidenceViewerIndex = ref(0)
const forms = reactive({})

const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const canStoreSubmit = computed(() => ['admin', 'store'].includes(userRole.value))
const canReview = computed(() => ['admin', 'qc'].includes(userRole.value))
const actionableFindings = computed(() => (
  findings.value.filter((finding) => ['open', 'in_progress', 'rejected'].includes(finding.status))
))
const isFindingRemediationReady = (finding) => {
  const form = ensureForm(finding)
  return Boolean(
    ['open', 'in_progress', 'rejected'].includes(finding?.status)
    && String(form?.correctiveNote || '').trim()
  )
}
const remediationReady = computed(() => (
  actionableFindings.value.length > 0 && actionableFindings.value.every((finding) => isFindingRemediationReady(finding))
))
const resolvedFindings = computed(() => findings.value.filter((finding) => finding.status === 'resolved'))
const reviewReady = computed(() => (
  canReview.value &&
  resolvedFindings.value.length > 0 &&
  resolvedFindings.value.every((finding) => {
    const form = ensureForm(finding)
    if (!form?.reviewDecision) return false
    if (form.reviewDecision === 'rejected') return Boolean(String(form.rejectReason || '').trim())
    return true
  })
))
const verifiedCount = computed(() => findings.value.filter((finding) => finding.status === 'verified').length)
const completionLabel = computed(() => `${verifiedCount.value}/${findings.value.length}`)
const allFindingsVerified = computed(() => findings.value.length > 0 && findings.value.every((finding) => finding.status === 'verified'))
const selectedFinding = computed(() => (
  findings.value.find((finding) => String(finding.id) === String(selectedFindingId.value)) || null
))

const storeStatusMeta = {
  open: { label: 'Chờ khắc phục', class: 'app-badge--warning' },
  in_progress: { label: 'Đang khắc phục', class: 'app-badge--info' },
  resolved: { label: 'Chờ duyệt', class: 'app-badge--warning' },
  verified: { label: 'Đã đạt', class: 'app-badge--success' },
  rejected: { label: 'Chưa đạt', class: 'app-badge--danger' },
}

const reviewStatusMeta = {
  open: { label: 'Chờ cửa hàng', class: 'app-badge--warning' },
  in_progress: { label: 'Chờ cửa hàng', class: 'app-badge--info' },
  resolved: { label: 'Chờ duyệt', class: 'app-badge--warning' },
  verified: { label: 'Đã duyệt', class: 'app-badge--success' },
  rejected: { label: 'Đã trả lại', class: 'app-badge--danger' },
}

const statusLabel = (status) => {
  const source = canReview.value ? reviewStatusMeta : storeStatusMeta
  return source[status]?.label || status || '--'
}
const statusClass = (status) => {
  const source = canReview.value ? reviewStatusMeta : storeStatusMeta
  return source[status]?.class || 'app-badge--neutral'
}
const reviewStatusLabel = (finding) => {
  const form = ensureForm(finding)
  if (!canReview.value && isFindingRemediationReady(finding)) return 'Đã khắc phục'
  if (finding?.status === 'resolved' && form?.reviewDecision === 'verified') return 'Đạt'
  if (finding?.status === 'resolved' && form?.reviewDecision === 'rejected') return 'Chưa đạt'
  return statusLabel(finding?.status)
}
const reviewStatusClass = (finding) => {
  const form = ensureForm(finding)
  if (!canReview.value && isFindingRemediationReady(finding)) return 'app-badge--success'
  if (finding?.status === 'resolved' && form?.reviewDecision === 'verified') return 'app-badge--success'
  if (finding?.status === 'resolved' && form?.reviewDecision === 'rejected') return 'app-badge--danger'
  return statusClass(finding?.status)
}
const imageSource = (image) => image?.previewUrl || image?.url || image?.dataUrl || image?.preview || ''
const imageName = (image, index) => image?.name || `Ảnh ${index + 1}`
const normalizeEvidenceImage = (image, source, index, context = {}) => {
  const url = imageSource(image)
  if (!url) return null
  return {
    ...image,
    id: String(image?.id || `${source}-${context.findingId || 'finding'}-${index}`),
    source,
    url,
    thumbnailUrl: image?.thumbnailUrl || image?.thumbUrl || url,
    name: imageName(image, index),
    createdAt: image?.createdAt || image?.created_at || context.createdAt || null,
    createdBy: image?.createdBy || image?.created_by || context.createdBy || null,
    note: String(image?.note || context.note || ''),
  }
}
const buildQcEvidenceImages = (finding) => {
  const images = finding?.metaInfo?.qc_attachments
  return (Array.isArray(images) ? images : [])
    .map((image, index) => normalizeEvidenceImage(image, 'qc', index, {
      findingId: finding?.id,
      createdAt: finding?.metaInfo?.detected_at || finding?.createdAt,
      createdBy: finding?.metaInfo?.auditor || null,
      note: finding?.metaInfo?.qc_note || '',
    }))
    .filter(Boolean)
}
const buildRemediationEvidenceImages = (finding) => {
  const form = ensureForm(finding)
  const images = form?.evidence || finding?.evidence || []
  return (Array.isArray(images) ? images : [])
    .map((image, index) => normalizeEvidenceImage(image, 'remediation', index, {
      findingId: finding?.id,
      createdAt: image?.createdAt || image?.created_at || null,
      note: form?.correctiveNote || finding?.correctiveNote || '',
    }))
    .filter(Boolean)
}
const buildFindingEvidenceImages = (finding) => ([
  ...buildQcEvidenceImages(finding),
  ...buildRemediationEvidenceImages(finding),
])
const openEvidenceViewer = (finding, source, index = 0) => {
  const images = buildFindingEvidenceImages(finding)
  if (!images.length) return
  evidenceViewerImages.value = images
  evidenceViewerSource.value = source === 'remediation' ? 'remediation' : 'qc'
  evidenceViewerIndex.value = Math.max(Number(index || 0), 0)
  evidenceViewerOpen.value = true
}
const closeEvidenceViewer = () => {
  evidenceViewerOpen.value = false
  evidenceViewerImages.value = []
  evidenceViewerIndex.value = 0
}
const formatFileSize = (bytes) => `${Math.round(Number(bytes || 0) / 1024 / 1024)}MB`
const findingDetectedLabel = (finding) => qcHelpers.toDateLabel(finding?.metaInfo?.detected_at || finding?.createdAt)
const latestRejectionReason = (finding) => {
  const timeline = Array.isArray(finding?.metaInfo?.timeline) ? finding.metaInfo.timeline : []
  const rejected = [...timeline].reverse().find((event) => event?.type === 'rejected' && event?.reason)
  return String(rejected?.reason || '').trim()
}

const ensureForm = (finding) => {
  const key = String(finding?.id || '')
  if (!key) return null
  if (!forms[key]) {
    forms[key] = {
      correctiveNote: finding?.correctiveNote || '',
      correctiveAction: finding?.correctiveAction || '',
      evidence: Array.isArray(finding?.evidence) ? finding.evidence.map((item) => ({ ...item })) : [],
      rejectReason: '',
      reviewDecision: '',
    }
  }
  return forms[key]
}

const syncForms = () => {
  findings.value.forEach((finding) => {
    const form = ensureForm(finding)
    if (!form) return
    if (!form.correctiveNote && finding.correctiveNote) form.correctiveNote = finding.correctiveNote
    if (!form.correctiveAction && finding.correctiveAction) form.correctiveAction = finding.correctiveAction
    if (!form.evidence.length && Array.isArray(finding.evidence)) {
      form.evidence = finding.evidence.map((item) => ({ ...item }))
    }
  })
}

const replaceFinding = (updated) => {
  if (!updated?.id) return
  const index = findings.value.findIndex((item) => String(item.id) === String(updated.id))
  if (index >= 0) findings.value.splice(index, 1, updated)
  else findings.value.unshift(updated)
  selectedFindingId.value = String(updated.id)
  ensureForm(updated)
}

const loadFindings = async () => {
  if (!props.sessionId) return
  loading.value = true
  loadError.value = ''
  try {
    const params = { limit: 500, session_id: props.sessionId }
    if (props.storeId) params.store_id = props.storeId
    findings.value = await listQcFindings(params)
    syncForms()
    if (selectedFindingId.value && !findings.value.some((finding) => String(finding.id) === String(selectedFindingId.value))) {
      selectedFindingId.value = ''
      detailPanelOpen.value = false
    }
  } catch (error) {
    findings.value = []
    loadError.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không tải được danh sách khắc phục.'
  } finally {
    loading.value = false
  }
}

const handleEvidenceUpload = async (finding, event) => {
  const form = ensureForm(finding)
  const input = event?.target
  const selectedFiles = Array.from(input?.files || [])
  if (!form || !selectedFiles.length) return

  const availableSlots = MAX_EVIDENCE_IMAGES - form.evidence.length
  if (availableSlots <= 0) {
    toast.error(`Mỗi tiêu chí tối đa ${MAX_EVIDENCE_IMAGES} ảnh.`)
    if (input) input.value = ''
    return
  }

  const filesToUpload = []
  for (const file of selectedFiles.slice(0, availableSlots)) {
    if (!String(file.type || '').startsWith('image/')) {
      toast.error(`${file.name}: không phải định dạng ảnh`)
      continue
    }
    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      toast.error(`${file.name}: vượt quá ${formatFileSize(MAX_EVIDENCE_SIZE_BYTES)}`)
      continue
    }
    filesToUpload.push(file)
  }

  if (!filesToUpload.length) {
    if (input) input.value = ''
    return
  }

  uploadTargetId.value = String(finding.id)
  try {
    const formData = new FormData()
    filesToUpload.forEach((file) => formData.append('files', file))
    const uploadedFiles = await uploadQcFindingEvidence(formData)
    form.evidence = [...form.evidence, ...uploadedFiles]
    toast.success(`Đã upload ${uploadedFiles.length} ảnh.`)
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không upload được ảnh.')
  } finally {
    uploadTargetId.value = ''
    if (input) input.value = ''
  }
}

const removeEvidence = (finding, index) => {
  const form = ensureForm(finding)
  if (!form) return
  form.evidence.splice(index, 1)
}

const submitAllRemediation = async () => {
  const targets = actionableFindings.value
  if (!targets.length) return

  const missing = targets.find((finding) => !String(ensureForm(finding)?.correctiveNote || '').trim())
  if (missing) {
    toast.error(`Vui lòng nhập nội dung khắc phục cho ${missing.findingCode || missing.criterionName || 'tiêu chí lỗi'}.`)
    return
  }

  actionLoading.value = true
  try {
    for (const finding of targets) {
      const form = ensureForm(finding)
      const updated = await resolveQcFinding(finding.id, {
        corrective_note: form.correctiveNote.trim(),
        corrective_action: form.correctiveAction.trim() || undefined,
        evidence: form.evidence,
      })
      replaceFinding(updated)
    }
    toast.success('Đã gửi khắc phục cho toàn bộ tiêu chí lỗi.')
    await loadFindings()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không gửi được khắc phục.')
  } finally {
    actionLoading.value = false
  }
}

const markReviewDecision = (finding, decision) => {
  const form = ensureForm(finding)
  if (!form || finding?.status !== 'resolved') return
  form.reviewDecision = decision
}

const submitReviewDecisions = async () => {
  const targets = resolvedFindings.value
  if (!targets.length) return

  const missingDecision = targets.find((finding) => !ensureForm(finding)?.reviewDecision)
  if (missingDecision) {
    toast.error(`Vui lòng chọn Đạt/Chưa đạt cho ${missingDecision.findingCode || missingDecision.criterionName || 'tiêu chí'}.`)
    selectFinding(missingDecision)
    return
  }

  const missingReason = targets.find((finding) => {
    const form = ensureForm(finding)
    return form?.reviewDecision === 'rejected' && !String(form.rejectReason || '').trim()
  })
  if (missingReason) {
    toast.error(`Vui lòng nhập lý do chưa đạt cho ${missingReason.findingCode || missingReason.criterionName || 'tiêu chí'}.`)
    selectFinding(missingReason)
    return
  }

  actionLoading.value = true
  try {
    const result = await reviewQcFindingsBatch(targets.map((finding) => {
      const form = ensureForm(finding)
      return {
        id: Number(finding.id),
        decision: form.reviewDecision,
        note: String(form.rejectReason || '').trim() || undefined,
      }
    }))

    const updatedFindings = Array.isArray(result?.data) ? result.data : []
    updatedFindings.forEach(replaceFinding)
    toast.success('Đã gửi kết quả xác nhận khắc phục.')
    await loadFindings()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không gửi được kết quả xác nhận.')
  } finally {
    actionLoading.value = false
  }
}

const submitPrimaryAction = () => {
  if (canReview.value && resolvedFindings.value.length > 0) return submitReviewDecisions()
  return submitAllRemediation()
}

defineExpose({
  submitAllRemediation: submitPrimaryAction,
})

watch(
  () => [
    canStoreSubmit.value,
    canReview.value,
    actionableFindings.value.length,
    resolvedFindings.value.length,
    reviewReady.value,
    remediationReady.value,
    actionLoading.value,
    uploadTargetId.value,
  ],
  () => {
    const reviewMode = canReview.value && resolvedFindings.value.length > 0
    emit('action-state', {
      canSubmit: reviewMode ? true : canStoreSubmit.value && actionableFindings.value.length > 0,
      disabled: reviewMode ? actionLoading.value || !reviewReady.value : actionLoading.value || Boolean(uploadTargetId.value) || !remediationReady.value,
      loading: actionLoading.value,
      count: reviewMode ? resolvedFindings.value.length : actionableFindings.value.length,
    })
  },
  { immediate: true }
)

const selectFinding = (finding) => {
  if (!finding?.id) return
  selectedFindingId.value = String(finding.id)
  detailPanelOpen.value = true
  ensureForm(finding)
}

const closeDetailPanel = () => {
  detailPanelOpen.value = false
}

watch(
  () => [props.storeId, props.sessionId],
  () => {
    void loadFindings()
  }
)

onMounted(loadFindings)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-transparent">
    <div v-if="loadError" class="m-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm font-medium text-[var(--danger-text)]">
      {{ loadError }}
    </div>

    <div v-if="loading" class="m-4 rounded-lg border border-[var(--stroke)] bg-white p-8 text-center text-sm font-semibold text-[var(--text-secondary)]">Đang tải danh sách khắc phục...</div>

    <div v-else-if="findings.length === 0" class="m-4 rounded-lg border border-[var(--stroke)] bg-white p-8 text-center">
      <p class="text-sm font-bold text-[var(--text-primary)]">Phiếu này chưa có tiêu chí cần khắc phục.</p>
      <p class="mt-1 text-sm text-[var(--text-secondary)]">Các tiêu chí không đạt sẽ xuất hiện ở đây sau khi hoàn tất QC.</p>
    </div>

    <div
      v-else
      :class="['qc-remediation-layout', detailPanelOpen && selectedFinding ? 'qc-remediation-layout--detail-open' : '']"
    >
      <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--stroke)] bg-white">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-4 py-3">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-bold text-[var(--text-primary)]">Danh sách lỗi</h2>
            <p class="mt-0.5 truncate text-xs font-medium text-[var(--text-secondary)]">Đã xác nhận {{ completionLabel }} lỗi</p>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <span
              class="app-badge inline-flex h-8 items-center rounded-lg px-2 text-xs font-bold"
              :class="allFindingsVerified ? 'app-badge--success' : resolvedFindings.length > 0 ? 'app-badge--warning' : 'app-badge--neutral'"
            >
              {{ allFindingsVerified ? 'Hoàn tất' : `${resolvedFindings.length} chờ duyệt` }}
            </span>
            <button type="button" class="app-button-secondary inline-flex size-8 items-center justify-center rounded-lg p-0 tablet:h-8 tablet:w-auto tablet:gap-1.5 tablet:px-2.5 tablet:text-xs tablet:font-bold" title="Tải lại" aria-label="Tải lại" :disabled="loading || actionLoading" @click="loadFindings">
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              <span class="hidden tablet:inline">Tải lại</span>
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div class="space-y-2">
          <article
            v-for="finding in findings"
            :key="finding.id"
            class="grid cursor-pointer grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-all hover:border-[var(--primary)] hover:shadow-sm"
            :class="String(selectedFindingId) === String(finding.id) ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-[var(--stroke)]'"
            role="button"
            tabindex="0"
            @click="selectFinding(finding)"
            @keydown.enter.prevent="selectFinding(finding)"
          >
            <span class="material-symbols-outlined text-[26px] text-[var(--warning-text)]">flag</span>
            <div class="min-w-0">
              <p class="truncate text-[11px] font-bold uppercase text-[var(--text-secondary)]">{{ finding.findingCode || `FD-${finding.id}` }}</p>
              <h3 class="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{{ finding.criterionName || finding.metaInfo?.criterion_name || 'Tiêu chí QC không đạt' }}</h3>
              <p class="mt-1 truncate text-xs font-medium text-[var(--text-secondary)]">{{ finding.metaInfo?.criterion_code || 'QC' }} • {{ finding.metaInfo?.qc_note || 'Chưa có ghi chú QC' }}</p>
            </div>
            <div class="flex flex-col items-end gap-1 text-right">
              <span class="app-badge inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" :class="reviewStatusClass(finding)">{{ reviewStatusLabel(finding) }}</span>
              <span class="material-symbols-outlined text-[20px] text-[var(--text-primary)]">chevron_right</span>
            </div>
          </article>
          </div>
        </div>
      </section>

      <aside class="qc-remediation-detail-panel hidden min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--stroke)] bg-white pc:flex" :aria-hidden="String(!detailPanelOpen || !selectedFinding)">
      <template v-if="selectedFinding">
      <div class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--stroke)] bg-white px-4">
        <h3 class="text-base font-bold text-[var(--text-primary)]">Chi tiết lỗi</h3>
        <div class="flex items-center gap-2">
          <span class="app-badge inline-flex rounded-full px-2.5 py-1 text-xs font-bold" :class="reviewStatusClass(selectedFinding)">{{ reviewStatusLabel(selectedFinding) }}</span>
          <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-muted)]" aria-label="Đóng chi tiết" @click="closeDetailPanel">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-sm font-bold text-[var(--text-primary)]">QC ghi nhận</h4>
              <span class="text-xs font-semibold text-[var(--text-secondary)]">{{ findingDetectedLabel(selectedFinding) }}</span>
            </div>
            <dl class="mt-3 space-y-3 text-sm">
              <div>
                <dt class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung ghi nhận</dt>
                <dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedFinding.metaInfo?.qc_note || 'Không' }}</dd>
              </div>
            </dl>
            <div class="mt-3">
              <EvidenceGallery
                :images="buildQcEvidenceImages(selectedFinding)"
                source="qc"
                title="Ảnh QC ghi nhận"
                empty-text="Chưa có ảnh minh chứng từ QC."
                :max-preview="5"
                @open="({ index }) => openEvidenceViewer(selectedFinding, 'qc', index)"
              />
            </div>
          </section>

          <section v-if="selectedFinding.status === 'rejected' && latestRejectionReason(selectedFinding)" class="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
            <h4 class="text-sm font-bold text-[var(--danger-text)]">Lý do chưa đạt</h4>
            <p class="mt-2 whitespace-pre-wrap text-sm font-medium text-[var(--danger-text)]">{{ latestRejectionReason(selectedFinding) }}</p>
          </section>

          <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">Cửa hàng khắc phục</h4>
            <div class="mt-3 space-y-3">
              <label class="block">
                <span class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung khắc phục *</span>
                <textarea
                  v-model="ensureForm(selectedFinding).correctiveNote"
                  rows="4"
                  class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                  :readonly="!canStoreSubmit || !['open', 'in_progress', 'rejected'].includes(selectedFinding.status)"
                  placeholder="Nhập nội dung cửa hàng đã khắc phục..."
                ></textarea>
              </label>
              <div class="rounded-lg border border-dashed border-[var(--stroke)] p-3">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-[var(--text-secondary)]">Ảnh minh chứng</p>
                  <label
                    v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status) && ensureForm(selectedFinding).evidence.length < MAX_EVIDENCE_IMAGES"
                    class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    <span class="material-symbols-outlined text-[15px]">add</span>
                    {{ uploadTargetId === String(selectedFinding.id) ? 'Đang tải...' : 'Thêm ảnh' }}
                    <input type="file" accept="image/*" multiple class="hidden" :disabled="Boolean(uploadTargetId)" @change="handleEvidenceUpload(selectedFinding, $event)" />
                  </label>
                </div>
                <div v-if="ensureForm(selectedFinding).evidence.length" class="mt-2">
                  <EvidenceGallery
                    :images="buildRemediationEvidenceImages(selectedFinding)"
                    source="remediation"
                    title="Minh chứng sau khắc phục"
                    empty-text="Cửa hàng chưa gửi minh chứng khắc phục."
                    :max-preview="5"
                    @open="({ index }) => openEvidenceViewer(selectedFinding, 'remediation', index)"
                  />
                  <div v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status)" class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="(image, index) in ensureForm(selectedFinding).evidence"
                      :key="image.id || `${image.name}-${index}`"
                      type="button"
                      class="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-[11px] font-bold text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                      @click.stop="removeEvidence(selectedFinding, index)"
                    >
                      <span class="material-symbols-outlined text-[13px]">close</span>
                      Xóa ảnh {{ index + 1 }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="canReview && selectedFinding.status === 'resolved'" class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">QC xác nhận</h4>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
                :class="ensureForm(selectedFinding).reviewDecision === 'rejected' ? 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]' : 'border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :disabled="actionLoading"
                @click="markReviewDecision(selectedFinding, 'rejected')"
              >
                Chưa đạt
              </button>
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
                :class="ensureForm(selectedFinding).reviewDecision === 'verified' ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]' : 'border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :disabled="actionLoading"
                @click="markReviewDecision(selectedFinding, 'verified')"
              >
                Đạt
              </button>
            </div>
            <label v-if="ensureForm(selectedFinding).reviewDecision === 'rejected'" class="mt-3 block">
              <span class="text-xs font-semibold text-[var(--danger-text)]">Lý do chưa đạt *</span>
              <textarea
                v-model="ensureForm(selectedFinding).rejectReason"
                rows="3"
                class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                :class="!String(ensureForm(selectedFinding).rejectReason || '').trim() ? 'border-[var(--danger-border)]' : ''"
                placeholder="Nhập lý do để cửa hàng khắc phục lại..."
              ></textarea>
            </label>
          </section>
      </div>
                </template>
          </aside>


      <Teleport to="body">
        <div
          v-if="detailPanelOpen && selectedFinding"
          class="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/35 p-0 tablet:items-center tablet:p-4 pc:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết lỗi"
          @click.self="closeDetailPanel"
        >
          <aside class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--stroke)] bg-white shadow-2xl tablet:rounded-2xl">
      <div class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--stroke)] bg-white px-4">
        <h3 class="min-w-0 flex-1 truncate text-base font-bold text-[var(--text-primary)]" :title="selectedFinding.criterionName || selectedFinding.metaInfo?.criterion_name || 'Chi tiết lỗi'">{{ selectedFinding.criterionName || selectedFinding.metaInfo?.criterion_name || 'Chi tiết lỗi' }}</h3>
        <div class="flex items-center gap-2">
          <span class="app-badge inline-flex rounded-full px-2.5 py-1 text-xs font-bold" :class="reviewStatusClass(selectedFinding)">{{ reviewStatusLabel(selectedFinding) }}</span>
          <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-muted)]" aria-label="Đóng chi tiết" @click="closeDetailPanel">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-sm font-bold text-[var(--text-primary)]">QC ghi nhận</h4>
              <span class="text-xs font-semibold text-[var(--text-secondary)]">{{ findingDetectedLabel(selectedFinding) }}</span>
            </div>
            <dl class="mt-3 space-y-3 text-sm">
              <div>
                <dt class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung ghi nhận</dt>
                <dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedFinding.metaInfo?.qc_note || 'Không' }}</dd>
              </div>
            </dl>
            <div class="mt-3">
              <EvidenceGallery
                :images="buildQcEvidenceImages(selectedFinding)"
                source="qc"
                title="Ảnh QC ghi nhận"
                empty-text="Chưa có ảnh minh chứng từ QC."
                :max-preview="5"
                @open="({ index }) => openEvidenceViewer(selectedFinding, 'qc', index)"
              />
            </div>
          </section>

          <section v-if="selectedFinding.status === 'rejected' && latestRejectionReason(selectedFinding)" class="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
            <h4 class="text-sm font-bold text-[var(--danger-text)]">Lý do chưa đạt</h4>
            <p class="mt-2 whitespace-pre-wrap text-sm font-medium text-[var(--danger-text)]">{{ latestRejectionReason(selectedFinding) }}</p>
          </section>

          <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">Cửa hàng khắc phục</h4>
            <div class="mt-3 space-y-3">
              <label class="block">
                <span class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung khắc phục *</span>
                <textarea
                  v-model="ensureForm(selectedFinding).correctiveNote"
                  rows="4"
                  class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                  :readonly="!canStoreSubmit || !['open', 'in_progress', 'rejected'].includes(selectedFinding.status)"
                  placeholder="Nhập nội dung cửa hàng đã khắc phục..."
                ></textarea>
              </label>
              <div class="rounded-lg border border-dashed border-[var(--stroke)] p-3">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-[var(--text-secondary)]">Ảnh minh chứng</p>
                  <label
                    v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status) && ensureForm(selectedFinding).evidence.length < MAX_EVIDENCE_IMAGES"
                    class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    <span class="material-symbols-outlined text-[15px]">add</span>
                    {{ uploadTargetId === String(selectedFinding.id) ? 'Đang tải...' : 'Thêm ảnh' }}
                    <input type="file" accept="image/*" multiple class="hidden" :disabled="Boolean(uploadTargetId)" @change="handleEvidenceUpload(selectedFinding, $event)" />
                  </label>
                </div>
                <div v-if="ensureForm(selectedFinding).evidence.length" class="mt-2">
                  <EvidenceGallery
                    :images="buildRemediationEvidenceImages(selectedFinding)"
                    source="remediation"
                    title="Minh chứng sau khắc phục"
                    empty-text="Cửa hàng chưa gửi minh chứng khắc phục."
                    :max-preview="5"
                    @open="({ index }) => openEvidenceViewer(selectedFinding, 'remediation', index)"
                  />
                  <div v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status)" class="mt-2 flex flex-wrap gap-2">
                    <button
                      v-for="(image, index) in ensureForm(selectedFinding).evidence"
                      :key="image.id || `${image.name}-${index}`"
                      type="button"
                      class="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-[11px] font-bold text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                      @click.stop="removeEvidence(selectedFinding, index)"
                    >
                      <span class="material-symbols-outlined text-[13px]">close</span>
                      Xóa ảnh {{ index + 1 }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="canReview && selectedFinding.status === 'resolved'" class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <h4 class="text-sm font-bold text-[var(--text-primary)]">QC xác nhận</h4>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
                :class="ensureForm(selectedFinding).reviewDecision === 'rejected' ? 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]' : 'border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :disabled="actionLoading"
                @click="markReviewDecision(selectedFinding, 'rejected')"
              >
                Chưa đạt
              </button>
              <button
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
                :class="ensureForm(selectedFinding).reviewDecision === 'verified' ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]' : 'border-[var(--stroke)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'"
                :disabled="actionLoading"
                @click="markReviewDecision(selectedFinding, 'verified')"
              >
                Đạt
              </button>
            </div>
            <label v-if="ensureForm(selectedFinding).reviewDecision === 'rejected'" class="mt-3 block">
              <span class="text-xs font-semibold text-[var(--danger-text)]">Lý do chưa đạt *</span>
              <textarea
                v-model="ensureForm(selectedFinding).rejectReason"
                rows="3"
                class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                :class="!String(ensureForm(selectedFinding).rejectReason || '').trim() ? 'border-[var(--danger-border)]' : ''"
                placeholder="Nhập lý do để cửa hàng khắc phục lại..."
              ></textarea>
            </label>
          </section>
      </div>
          </aside>
        </div>
      </Teleport>
    </div>

    <EvidenceViewer
      v-model="evidenceViewerOpen"
      :images="evidenceViewerImages"
      :initial-source="evidenceViewerSource"
      :initial-index="evidenceViewerIndex"
      title="Minh chứng khắc phục"
      enable-compare
      @close="closeEvidenceViewer"
    />
  </div>
</template>

<style scoped>
.qc-remediation-layout {
  display: grid;
  min-height: 0;
  flex: 1 1 0%;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
}

.qc-remediation-detail-panel {
  pointer-events: none;
}

@media (min-width: 64rem) {
  .qc-remediation-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0fr);
    gap: 0;
    transition: grid-template-columns 0.24s ease, gap 0.24s ease;
  }

  .qc-remediation-layout--detail-open {
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    gap: 0.75rem;
  }

  .qc-remediation-detail-panel {
    min-width: 0;
    opacity: 0;
    transform: translateX(18px) scaleX(0.98);
    transform-origin: right center;
    transition: opacity 0.18s ease, transform 0.24s ease;
  }

  .qc-remediation-layout--detail-open .qc-remediation-detail-panel {
    pointer-events: auto;
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .qc-remediation-layout,
  .qc-remediation-detail-panel {
    transition: none;
  }
}
</style>
