<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import {
  listQcFindings,
  qcHelpers,
  rejectQcFinding,
  resolveQcFinding,
  uploadQcFindingEvidence,
  verifyQcFinding,
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
const forms = reactive({})

const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
const canStoreSubmit = computed(() => ['admin', 'store'].includes(userRole.value))
const canReview = computed(() => ['admin', 'qc'].includes(userRole.value))
const actionableFindings = computed(() => (
  findings.value.filter((finding) => ['open', 'in_progress', 'rejected'].includes(finding.status))
))
const resolvedFindings = computed(() => findings.value.filter((finding) => finding.status === 'resolved'))
const verifiedCount = computed(() => findings.value.filter((finding) => finding.status === 'verified').length)
const completionLabel = computed(() => `${verifiedCount.value}/${findings.value.length}`)
const selectedFinding = computed(() => (
  findings.value.find((finding) => String(finding.id) === String(selectedFindingId.value)) || null
))

const statusMeta = {
  open: { label: 'Chờ khắc phục', class: 'app-badge--warning' },
  in_progress: { label: 'Đang khắc phục', class: 'app-badge--info' },
  resolved: { label: 'Chờ admin duyệt', class: 'app-badge--warning' },
  verified: { label: 'Đã đạt', class: 'app-badge--success' },
  rejected: { label: 'Chưa đạt', class: 'app-badge--danger' },
}

const statusLabel = (status) => statusMeta[status]?.label || status || '--'
const statusClass = (status) => statusMeta[status]?.class || 'app-badge--neutral'
const imageSource = (image) => image?.previewUrl || image?.url || image?.dataUrl || image?.preview || ''
const imageName = (image, index) => image?.name || `Anh ${index + 1}`
const formatFileSize = (bytes) => `${Math.round(Number(bytes || 0) / 1024 / 1024)}MB`
const qcFindingImages = (finding) => {
  const images = finding?.metaInfo?.qc_attachments
  return Array.isArray(images) ? images.filter((image) => imageSource(image)) : []
}
const findingDetectedLabel = (finding) => qcHelpers.toDateLabel(finding?.metaInfo?.detected_at || finding?.createdAt)

const ensureForm = (finding) => {
  const key = String(finding?.id || '')
  if (!key) return null
  if (!forms[key]) {
    forms[key] = {
      correctiveNote: finding?.correctiveNote || '',
      correctiveAction: finding?.correctiveAction || '',
      evidence: Array.isArray(finding?.evidence) ? finding.evidence.map((item) => ({ ...item })) : [],
      rejectReason: '',
      verifyNote: '',
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

defineExpose({
  submitAllRemediation,
})

watch(
  () => [canStoreSubmit.value, actionableFindings.value.length, actionLoading.value, uploadTargetId.value],
  () => {
    emit('action-state', {
      canSubmit: canStoreSubmit.value && actionableFindings.value.length > 0,
      disabled: actionLoading.value || Boolean(uploadTargetId.value),
      loading: actionLoading.value,
      count: actionableFindings.value.length,
    })
  },
  { immediate: true }
)

const verifyFinding = async (finding) => {
  const form = ensureForm(finding)
  actionLoading.value = true
  try {
    const updated = await verifyQcFinding(finding.id, { verify_note: form?.verifyNote?.trim() || undefined })
    replaceFinding(updated)
    toast.success('Đã duyệt đạt tiêu chí khắc phục.')
    await loadFindings()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không duyệt được tiêu chí.')
  } finally {
    actionLoading.value = false
  }
}

const rejectFinding = async (finding) => {
  const form = ensureForm(finding)
  const reason = String(form?.rejectReason || '').trim()
  if (!reason) {
    toast.error('Vui lòng nhập lý do chưa đạt.')
    return
  }

  actionLoading.value = true
  try {
    const updated = await rejectQcFinding(finding.id, { rejection_reason: reason })
    replaceFinding(updated)
    toast.success('Đã yêu cầu cửa hàng khắc phục lại.')
    await loadFindings()
  } catch (error) {
    toast.error(error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không trả lại được tiêu chí.')
  } finally {
    actionLoading.value = false
  }
}

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
      class="grid min-h-0 flex-1 gap-4 overflow-hidden"
      :class="detailPanelOpen && selectedFinding ? 'pc:grid-cols-[minmax(360px,1fr)_420px]' : 'grid-cols-1'"
    >
      <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--stroke)] bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke)] px-4 py-3">
          <div>
            <h2 class="text-sm font-bold text-[var(--text-primary)]">Khắc phục lỗi theo phiếu</h2>
            <p class="mt-1 text-xs font-medium text-[var(--text-secondary)]">Hoàn tất {{ completionLabel }} tiêu chí</p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <span class="app-badge app-badge--warning inline-flex rounded-lg px-2 py-1 text-xs font-bold">{{ resolvedFindings.length }} chờ duyệt</span>
            <button type="button" class="app-button-secondary inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold" :disabled="loading || actionLoading" @click="loadFindings">
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              Tải lại
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div class="space-y-2">
          <article
            v-for="finding in findings"
            :key="finding.id"
            class="grid cursor-pointer grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-all hover:border-[var(--primary)] hover:shadow-sm"
            :class="detailPanelOpen && String(selectedFindingId) === String(finding.id) ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-[var(--stroke)]'"
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
              <span class="app-badge inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" :class="statusClass(finding.status)">{{ statusLabel(finding.status) }}</span>
              <span class="material-symbols-outlined text-[20px] text-[var(--text-primary)]">chevron_right</span>
            </div>
          </article>
          </div>
        </div>
      </section>

      <aside
        v-if="detailPanelOpen && selectedFinding"
        class="min-h-0 overflow-hidden rounded-lg border border-[var(--stroke)] bg-white"
        aria-label="Chi tiết lỗi"
      >
      <div class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--stroke)] bg-white px-4">
        <h3 class="text-base font-bold text-[var(--text-primary)]">Chi tiết lỗi</h3>
        <div class="flex items-center gap-2">
          <span class="app-badge inline-flex rounded-full px-2.5 py-1 text-xs font-bold" :class="statusClass(selectedFinding.status)">{{ statusLabel(selectedFinding.status) }}</span>
          <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-muted)]" aria-label="Đóng chi tiết" @click="closeDetailPanel">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      <div class="min-h-0 h-[calc(100%-3.5rem)] space-y-4 overflow-y-auto p-4">
          <section class="space-y-2 border-b border-[var(--stroke)] pb-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{{ selectedFinding.findingCode || `FD-${selectedFinding.id}` }}</p>
            <h3 class="text-base font-bold text-[var(--text-primary)]">{{ selectedFinding.metaInfo?.criterion_code || '--' }}</h3>
            <p class="text-sm font-semibold text-[var(--text-primary)]">{{ selectedFinding.criterionName || selectedFinding.metaInfo?.criterion_name || 'Tiêu chí QC không đạt' }}</p>
          </section>

          <section class="rounded-lg border border-[var(--stroke)] bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="text-sm font-bold text-[var(--text-primary)]">QC ghi nhận</h4>
              <span class="text-xs font-semibold text-[var(--text-secondary)]">{{ findingDetectedLabel(selectedFinding) }}</span>
            </div>
            <dl class="mt-3 space-y-3 text-sm">
              <div>
                <dt class="text-xs font-semibold text-[var(--text-secondary)]">Nội dung ghi nhận</dt>
                <dd class="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">{{ selectedFinding.metaInfo?.qc_note || '--' }}</dd>
              </div>
            </dl>
            <div class="mt-3">
              <p class="text-xs font-semibold text-[var(--text-secondary)]">Ảnh QC ghi nhận</p>
              <div v-if="qcFindingImages(selectedFinding).length" class="mt-2 grid grid-cols-2 gap-2">
                <button
                  v-for="(image, index) in qcFindingImages(selectedFinding)"
                  :key="image.id || `${imageName(image, index)}-${index}`"
                  type="button"
                  class="overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]"
                >
                  <img :src="imageSource(image)" :alt="imageName(image, index)" class="aspect-[4/3] w-full object-cover" />
                </button>
              </div>
              <p v-else class="mt-2 text-xs text-[var(--text-secondary)]">Chưa có ảnh QC.</p>
            </div>
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
                  <span class="text-xs font-semibold text-[var(--text-secondary)]">Ảnh sau khi khắc phục</span>
                  <label
                    v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status) && ensureForm(selectedFinding).evidence.length < MAX_EVIDENCE_IMAGES"
                    class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    <span class="material-symbols-outlined text-[15px]">add</span>
                    {{ uploadTargetId === String(selectedFinding.id) ? 'Đang tải...' : 'Thêm ảnh' }}
                    <input type="file" accept="image/*" multiple class="hidden" :disabled="Boolean(uploadTargetId)" @change="handleEvidenceUpload(selectedFinding, $event)" />
                  </label>
                </div>
                <div v-if="ensureForm(selectedFinding).evidence.length" class="mt-2 grid grid-cols-3 gap-2">
                  <div v-for="(image, index) in ensureForm(selectedFinding).evidence" :key="image.id || `${image.name}-${index}`" class="group relative overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]">
                    <img :src="imageSource(image)" :alt="imageName(image, index)" class="aspect-square w-full object-cover" />
                    <button
                      v-if="canStoreSubmit && ['open', 'in_progress', 'rejected'].includes(selectedFinding.status)"
                      type="button"
                      class="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-white text-[var(--danger-text)] shadow"
                      @click="removeEvidence(selectedFinding, index)"
                    >
                      <span class="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </div>
                </div>
                <p v-else class="mt-2 text-xs text-[var(--text-secondary)]">Chưa có ảnh sau khắc phục.</p>
              </div>
            </div>
          </section>

          <section v-if="canReview && selectedFinding.status === 'resolved'" class="grid gap-3">
            <label class="block rounded-lg border border-[var(--stroke)] bg-white p-4">
              <span class="text-xs font-semibold text-[var(--text-secondary)]">Ghi chú duyệt đạt</span>
              <textarea v-model="ensureForm(selectedFinding).verifyNote" rows="2" class="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none" placeholder="Không bắt buộc"></textarea>
              <button type="button" class="app-button-primary mt-2 rounded-lg px-3 py-2 text-sm font-bold" :disabled="actionLoading" @click="verifyFinding(selectedFinding)">Đạt</button>
            </label>
            <label class="block rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
              <span class="text-xs font-semibold text-[var(--danger-text)]">Lý do chưa đạt</span>
              <textarea v-model="ensureForm(selectedFinding).rejectReason" rows="2" class="mt-1 w-full rounded-lg border border-[var(--danger-border)] px-3 py-2 text-sm focus:border-[var(--danger-text)] focus:outline-none" placeholder="Bắt buộc nếu trả lại"></textarea>
              <button type="button" class="app-button-danger mt-2 rounded-lg px-3 py-2 text-sm font-bold" :disabled="actionLoading" @click="rejectFinding(selectedFinding)">Chưa đạt</button>
            </label>
          </section>
      </div>
      </aside>
    </div>
  </div>
</template>
