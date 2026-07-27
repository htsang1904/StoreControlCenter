<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const props = defineProps({
  criterion: {
    type: Object,
    required: true,
  },
  level: {
    type: Number,
    default: 1,
  },
  criteriaStates: {
    type: Object,
    required: true,
  },
  maxAttachments: {
    type: Number,
    default: 3,
  },
  showFindingAction: {
    type: Boolean,
    default: false,
  },
  shallowGroups: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update-state', 'upload-attachment', 'remove-attachment', 'open-finding-modal', 'select-group', 'open-evidence'])

const sectionExpanded = ref(props.level <= 2)
const detailsExpanded = ref(false)
const attachmentMenuOpen = ref(false)
const statusMenuOpen = ref(false)
const itemRoot = ref(null)
const attachmentMenuTrigger = ref(null)
const attachmentMenuRef = ref(null)
const attachmentMenuPosition = reactive({ top: 0, left: 0 })

const hasChildren = computed(() => Array.isArray(props.criterion.children) && props.criterion.children.length > 0)
const state = computed(() => props.criteriaStates[props.criterion.id] || { status: 'pending', score: null, note: '', attachments: [] })
const criterionDomId = computed(() => `criterion-${props.criterion.id}`)

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeLocalCriterionMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pass_fail' || normalized === 'passfail' || normalized === 'binary') return 'pass_fail'
  if (normalized === 'deduction' || normalized === 'deduct') return 'deduction'
  return 'point'
}

const criterionMode = computed(() => normalizeLocalCriterionMode(props.criterion?.mode || props.criterion?.scoreType))

const evidenceImages = computed(() => (
  Array.isArray(state.value.attachments)
    ? state.value.attachments
        .map((file, index) => ({
          ...file,
          id: String(file?.id || `${props.criterion.id}-${index}`),
          source: 'qc',
          url: file?.url || file?.previewUrl || file?.preview || file?.dataUrl || '',
          thumbnailUrl: file?.thumbnailUrl || file?.url || file?.previewUrl || file?.preview || file?.dataUrl || '',
          name: file?.name || `Ảnh QC ${index + 1}`,
          note: state.value.note || '',
        }))
        .filter((file) => file.url)
    : []
))

const resolveCriterionStatus = (criterion, criterionState = {}) => {
  const rawStatus = String(criterionState?.status || 'pending')
  const mode = normalizeLocalCriterionMode(criterion?.mode || criterion?.scoreType)
  if (rawStatus === 'na' && mode !== 'point') return 'na'

  if (mode === 'point') {
    const rawScore = criterionState?.score
    if (rawScore === null || rawScore === undefined || String(rawScore) === '') {
      return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
    }

    const score = toNumber(rawScore, NaN)
    if (!Number.isFinite(score)) return 'pending'
    const maxScore = Math.max(toNumber(criterion?.maxScore), 0)
    const minPassScore = toNumber(criterion?.minPassScore ?? (maxScore / 2), maxScore / 2)
    return score >= minPassScore ? 'pass' : 'fail'
  }

  return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
}

const currentStatus = computed(() => resolveCriterionStatus(props.criterion, state.value))
const isPointScored = computed(() => criterionMode.value === 'point' && currentStatus.value === 'pass')

const cardToneClass = computed(() => {
  if (isPointScored.value) return 'border-[var(--info-border)] bg-[var(--info-bg)]/30 shadow-sm'
  if (currentStatus.value === 'pass') return 'border-[var(--success-border)] bg-[var(--success-bg)]/30 shadow-sm'
  if (currentStatus.value === 'fail') return 'border-[var(--danger-border)] bg-[var(--danger-bg)]/30 shadow-sm'
  if (currentStatus.value === 'na') return 'border-[var(--stroke)] bg-[var(--surface-muted)] opacity-75'
  return 'border-[var(--warning-border)] bg-[var(--warning-bg)]/35 transition-all hover:border-[var(--warning-border)]'
})

const statusBadgeClass = computed(() => {
  if (currentStatus.value === 'pass') return 'bg-[var(--success-text)] text-white shadow-sm'
  if (currentStatus.value === 'fail') return 'bg-[var(--danger-text)] text-white shadow-sm'
  if (currentStatus.value === 'na') return 'bg-[var(--neutral-bg)] text-[var(--neutral-text)]'
  return 'border border-[var(--stroke)] bg-white font-semibold text-[var(--text-secondary)]'
})

const statusLabel = computed(() => {
  if (currentStatus.value === 'pass') return 'Đạt'
  if (currentStatus.value === 'fail') return 'Không đạt'
  if (currentStatus.value === 'na') return 'N/A'
  return 'Chưa chấm'
})

const metricLabel = computed(() => (
  criterionMode.value === 'deduction'
    ? `Không đạt trừ ${toNumber(props.criterion.deductionPercent)} điểm %`
    : (criterionMode.value === 'point'
      ? `Ngưỡng đạt ${toNumber(props.criterion.minPassScore ?? props.criterion.maxScore)}/${toNumber(props.criterion.maxScore)} điểm`
      : `Đạt / Không đạt · ${toNumber(props.criterion.maxScore)} điểm`)
))

const modeName = computed(() => {
  if (criterionMode.value === 'deduction') return 'Khấu trừ'
  if (criterionMode.value === 'pass_fail') return 'Đạt / Không đạt'
  return 'Chấm điểm'
})

const modeBadgeClass = computed(() => {
  if (criterionMode.value === 'deduction') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (criterionMode.value === 'pass_fail') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
})

const scorePercent = computed(() => {
  if (criterionMode.value !== 'point') return 0
  const maxScore = Math.max(toNumber(props.criterion.maxScore), 0)
  if (maxScore <= 0) return 0
  const score = Math.min(Math.max(toNumber(state.value.score), 0), maxScore)
  return Math.round((score / maxScore) * 100)
})

const scoreHint = computed(() => {
  if (criterionMode.value !== 'point') return ''
  if (state.value.score === null || state.value.score === undefined || String(state.value.score) === '') {
    return `Nhập từ 0 đến ${toNumber(props.criterion.maxScore)} điểm`
  }
  return `Đóng góp ${toNumber(state.value.score)}/${toNumber(props.criterion.maxScore)} điểm`
})

const scoreHintClass = computed(() => {
  if (isPointScored.value) return 'text-[var(--primary-strong)]'
  if (currentStatus.value === 'pass') return 'text-[var(--success-text)]'
  if (currentStatus.value === 'fail') return 'text-[var(--danger-text)]'
  return 'text-[var(--text-secondary)]'
})

const canShowDetails = computed(() => currentStatus.value !== 'na')
const detailsVisible = computed(() => (
  canShowDetails.value
  && (
    detailsExpanded.value
    || currentStatus.value === 'fail'
    || Boolean(String(state.value.note || '').trim())
    || (Array.isArray(state.value.attachments) && state.value.attachments.length > 0)
  )
))

const attachmentCount = computed(() => (Array.isArray(state.value.attachments) ? state.value.attachments.length : 0))
const hasDetailContent = computed(() => Boolean(String(state.value.note || '').trim()) || attachmentCount.value > 0)

const detailToggleLabel = computed(() => (
  detailsVisible.value ? 'Ẩn ghi chú & ảnh' : 'Ghi chú & ảnh'
))

const sectionHeaderClass = computed(() => {
  if (props.level === 1) {
    return 'rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-2.5 py-2 shadow-sm'
  }

  if (props.level === 2) {
    return 'rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] px-2.5 py-1.5'
  }

  return 'rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)]/80 px-2 py-1.5'
})

const sectionTagClass = computed(() => {
  if (props.level <= 2) {
    return 'border border-[var(--stroke)] bg-white font-semibold text-[var(--primary-strong)]'
  }

  return 'bg-[var(--primary-softer)] text-[var(--text-secondary)]'
})

const sectionTitleClass = computed(() => {
  if (props.level === 1) return 'text-xs font-semibold text-[var(--text-primary)]'
  if (props.level === 2) return 'text-xs font-semibold text-[var(--text-primary)]'
  return 'text-xs font-medium text-[var(--text-primary)]'
})

const sectionChildrenLaneClass = computed(() => {
  if (props.level === 1) return 'ml-2 space-y-1 border-l border-[var(--stroke)] pl-2'
  return 'ml-1.5 space-y-1 border-l border-[var(--stroke)] pl-2'
})

const collectLeafCriteria = (criterion) => {
  const children = Array.isArray(criterion?.children) ? criterion.children : []
  if (!children.length) return [criterion]
  return children.flatMap((child) => collectLeafCriteria(child))
}

const sectionSummary = computed(() => {
  if (!hasChildren.value) return null

  return collectLeafCriteria(props.criterion).reduce((acc, criterion) => {
    const criterionState = props.criteriaStates[criterion.id] || {}
    const status = resolveCriterionStatus(criterion, criterionState)
    acc.total += 1

    if (status !== 'pending') acc.completed += 1
    if (status === 'pass') acc.passed += 1
    if (status === 'fail') acc.failed += 1
    if (status === 'na') acc.excluded += 1

    return acc
  }, {
    total: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    excluded: 0,
  })
})

const updateState = (updates) => {
  emit('update-state', props.criterion.id, updates)
}

const handlePassFail = (status) => {
  if (props.readonly) return
  statusMenuOpen.value = false
  updateState({ status })
}

const handleScoreChange = (event) => {
  if (props.readonly) return
  const input = event?.target
  const value = String(input?.value ?? '').trim()
  if (value === '') {
    updateState({
      score: null,
      status: 'pending',
    })
    return
  }

  const parsedScore = Number(value)
  if (!Number.isFinite(parsedScore)) {
    if (input) {
      input.value = state.value?.score === null || state.value?.score === undefined ? '' : String(state.value.score)
    }
    return
  }

  const maxScore = Math.max(toNumber(props.criterion.maxScore), 0)
  const normalizedScore = Math.min(Math.max(parsedScore, 0), maxScore)
  if (input) {
    input.value = String(normalizedScore)
  }

  const minPassScore = toNumber(props.criterion.minPassScore ?? (maxScore / 2), maxScore / 2)

  updateState({
    score: normalizedScore,
    status: normalizedScore >= minPassScore ? 'pass' : 'fail',
  })
}

const handleUpload = (event) => {
  if (props.readonly) return
  attachmentMenuOpen.value = false
  statusMenuOpen.value = false
  emit('upload-attachment', props.criterion.id, event)
}

const removeAttachment = (index) => {
  if (props.readonly) return
  attachmentMenuOpen.value = false
  emit('remove-attachment', props.criterion.id, index)
}


const openEvidence = (index) => {
  if (!props.readonly || !evidenceImages.value.length) return
  const safeIndex = Math.min(Math.max(Number(index || 0), 0), evidenceImages.value.length - 1)
  emit('open-evidence', {
    images: evidenceImages.value,
    index: safeIndex,
    source: 'qc',
  })
}

const updateAttachmentMenuPosition = () => {
  const rect = attachmentMenuTrigger.value?.getBoundingClientRect?.()
  if (!rect) return
  const menuWidth = 144
  attachmentMenuPosition.top = rect.bottom + 6
  attachmentMenuPosition.left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
}

const toggleAttachmentMenu = () => {
  if (props.readonly) return
  statusMenuOpen.value = false
  if (!attachmentMenuOpen.value) updateAttachmentMenuPosition()
  attachmentMenuOpen.value = !attachmentMenuOpen.value
}

const toggleStatusMenu = () => {
  if (props.readonly) return
  attachmentMenuOpen.value = false
  statusMenuOpen.value = !statusMenuOpen.value
}

const closeMenus = () => {
  attachmentMenuOpen.value = false
  statusMenuOpen.value = false
}

const handleDocumentClick = (event) => {
  const root = itemRoot.value
  const menu = attachmentMenuRef.value
  if ((root && root.contains(event.target)) || (menu && menu.contains(event.target))) return
  closeMenus()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

const toggleSection = () => {
  if (props.shallowGroups) {
    emit('select-group', props.criterion)
    return
  }

  sectionExpanded.value = !sectionExpanded.value
}

const toggleDetails = () => {
  if (!canShowDetails.value) return
  detailsExpanded.value = !detailsExpanded.value
  if (!detailsExpanded.value) {
    attachmentMenuOpen.value = false
    statusMenuOpen.value = false
  }
}
</script>

<template>
  <div ref="itemRoot" :class="['qc-criterion-item', level > 1 ? 'mt-0.5' : 'mt-1']">
    <div v-if="hasChildren" class="border-b border-transparent">
      <button
        type="button"
        class="cursor-pointer flex w-full items-start gap-2 text-left transition"
        :class="sectionHeaderClass"
        :aria-expanded="String(sectionExpanded)"
        @click="toggleSection"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium" :class="sectionTagClass">
              {{ criterion.ordering || `Nhóm ${level}` }}
            </span>
            <h3 :class="sectionTitleClass">{{ criterion.name }}</h3>
          </div>
        </div>

        <div v-if="sectionSummary" class="hidden shrink-0 items-center gap-2 tablet:flex">
          <span class="text-[11px] text-[var(--text-secondary)]">
            {{ sectionSummary.completed }}/{{ sectionSummary.total }} hoàn tất
          </span>
          <span v-if="sectionSummary.failed > 0" class="text-[11px] text-[var(--danger-text)]">{{ sectionSummary.failed }} lỗi</span>
        </div>

        <span class="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--stroke)] bg-white text-[var(--text-secondary)]">
          <svg
            class="size-3.5 transition-transform"
            :class="sectionExpanded ? 'rotate-180' : ''"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <div v-if="!shallowGroups" v-show="sectionExpanded" class="pb-0.5">
        <div :class="sectionChildrenLaneClass">
          <QCCriterionTreeItem
            v-for="child in criterion.children"
            :key="child.id"
            :criterion="child"
            :level="level + 1"
            :criteria-states="criteriaStates"
            :max-attachments="maxAttachments"
            :show-finding-action="showFindingAction"
            :shallow-groups="shallowGroups"
            :readonly="readonly"
            @update-state="(id, updates) => $emit('update-state', id, updates)"
            @upload-attachment="(id, event) => $emit('upload-attachment', id, event)"
            @remove-attachment="(id, index) => $emit('remove-attachment', id, index)"
            @open-finding-modal="(id) => $emit('open-finding-modal', id)"
            @select-group="(node) => $emit('select-group', node)"
          />
        </div>
      </div>
    </div>

    <div
      v-else
      :id="criterionDomId"
      class="scroll-mt-24 rounded-lg border bg-white transition-colors"
      :class="cardToneClass"
    >
      <div class="grid min-h-[52px] gap-1.5 px-2.5 py-1.5 tablet:grid-cols-[56px_minmax(0,1fr)_auto] tablet:items-center tablet:gap-2">
        <div class="flex items-center tablet:border-r tablet:border-[var(--stroke)] tablet:pr-3">
          <span class="text-xs font-semibold text-[var(--primary)]">{{ criterion.ordering || criterion.code || 'QC' }}</span>
        </div>

        <div class="min-w-0">
          <h4 class="line-clamp-1 text-xs font-semibold text-[var(--text-primary)]" :title="criterion.name">{{ criterion.name }}</h4>
          <p v-if="criterion.description" class="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]" :title="criterion.description">{{ criterion.description }}</p>
        </div>

        <div class="flex min-w-0 items-center justify-end gap-2">
          <span class="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md border px-2 text-[10px] font-medium leading-none" :class="modeBadgeClass">
            {{ modeName }}
          </span>

          <div class="w-[126px] shrink-0">
            <div v-if="criterionMode === 'point'" class="flex h-8 items-center rounded-lg border border-[var(--stroke)] bg-white px-2 shadow-sm focus-within:border-[var(--primary)]">
              <input
                type="number"
                :value="state.score"
                :min="0"
                :max="criterion.maxScore"
                step="0.5"
                placeholder="Nhập điểm"
                :disabled="readonly"
                class="score-input h-7 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-center text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default"
                @input="handleScoreChange"
              />
              <span class="mx-1 text-xs text-[var(--text-secondary)]">/</span>
              <span class="shrink-0 text-xs font-medium text-[var(--text-secondary)]">{{ criterion.maxScore }}</span>
            </div>

            <div v-else class="relative">
              <button
                type="button"
                class="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] bg-white px-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--primary)] focus:border-[var(--primary)] focus:outline-none"
                :aria-expanded="String(statusMenuOpen)"
                :disabled="readonly"
                @click="toggleStatusMenu"
              >
                <span>{{ currentStatus === 'fail' ? 'Không đạt' : currentStatus === 'pass' ? 'Đạt' : '-' }}</span>
                <span class="material-symbols-outlined text-[16px] text-[var(--text-secondary)]">{{ statusMenuOpen ? 'expand_less' : 'expand_more' }}</span>
              </button>

              <div
                v-if="statusMenuOpen"
                class="absolute left-0 top-9 z-20 w-full overflow-hidden rounded-lg border border-[var(--stroke)] bg-white py-1 text-xs font-semibold text-[var(--text-primary)] shadow-lg"
              >
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-[var(--success-text)] transition hover:bg-[var(--surface-muted)]"
                  @click="handlePassFail('pass')"
                >
                  <span>Đạt</span>
                  <span v-if="currentStatus === 'pass'" class="material-symbols-outlined text-[15px]">check</span>
                </button>
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-[var(--danger-text)] transition hover:bg-[var(--surface-muted)]"
                  @click="handlePassFail('fail')"
                >
                  <span>Không đạt</span>
                  <span v-if="currentStatus === 'fail'" class="material-symbols-outlined text-[15px]">check</span>
                </button>
              </div>
            </div>
          </div>

          <span v-if="currentStatus !== 'pending'" class="inline-flex min-w-[76px] shrink-0 justify-center rounded-md border px-2 py-1 text-xs font-semibold" :class="statusBadgeClass">
            {{ statusLabel }}
          </span>

          <button
            type="button"
            class="relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
            :class="detailsVisible || hasDetailContent ? 'text-[var(--primary-strong)]' : ''"
            :disabled="!canShowDetails"
            :aria-expanded="String(detailsVisible)"
            :title="detailToggleLabel"
            @click="toggleDetails"
          >
            <span class="material-symbols-outlined text-[16px]">{{ detailsVisible ? 'expand_less' : 'chat_bubble_outline' }}</span>
            <span v-if="attachmentCount > 0" class="absolute -right-0.5 -top-0.5 inline-flex min-w-3 justify-center rounded-full bg-[var(--primary)] px-0.5 text-[9px] font-bold text-white">{{ attachmentCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="currentStatus === 'fail'" class="border-t border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-medium text-[var(--danger-text)]">
        {{ readonly ? 'Tiêu chí này cần khắc phục' : 'Yêu cầu khắc phục sẽ được tạo khi hoàn tất phiên QC' }}
      </div>

      <div v-if="canShowDetails && detailsVisible" class="grid gap-2 border-t border-[var(--stroke)] px-3 py-2 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-end">
        <div>
          <label class="block text-xs font-semibold text-[var(--text-secondary)]">Ghi chú</label>
          <input
            type="text"
            :value="state.note"
            class="mt-1 h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-0"
            :placeholder="currentStatus === 'fail' ? 'Mô tả lỗi...' : 'Ghi chú thêm...'"
            :readonly="readonly"
            @input="(event) => !readonly && updateState({ note: event.target.value })"
          />
        </div>

        <div v-if="!readonly || attachmentCount > 0">
          <label class="block text-xs font-semibold text-[var(--text-secondary)]">Ảnh ({{ attachmentCount }}/{{ maxAttachments }})</label>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <div
              v-for="(file, index) in state.attachments"
              :key="file.id || index"
              class="group relative size-9 overflow-hidden rounded-md border border-[var(--stroke)] bg-white"
              :class="readonly ? 'cursor-pointer transition-opacity hover:opacity-90' : 'cursor-default'"
              :role="readonly ? 'button' : undefined"
              :tabindex="readonly ? 0 : undefined"
              @click="openEvidence(index)"
              @keydown.enter.prevent="openEvidence(index)"
              @keydown.space.prevent="openEvidence(index)"
            >
              <img :src="file.preview || file.url" class="h-full w-full object-cover" />
              <button
                v-if="!readonly"
                type="button"
                class="absolute right-0.5 top-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--danger-text)]"
                @click.stop="removeAttachment(index)"
              >
                <span class="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>

            <div v-if="!readonly && state.attachments.length < maxAttachments" class="relative">
              <button
                ref="attachmentMenuTrigger"
                type="button"
                class="flex size-9 cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--stroke-strong)] bg-white text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
                :aria-expanded="String(attachmentMenuOpen)"
                title="Thêm ảnh minh chứng"
                @click="toggleAttachmentMenu"
              >
                <span class="material-symbols-outlined text-[18px]">photo_camera</span>
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="attachmentMenuOpen"
      ref="attachmentMenuRef"
      class="fixed z-[9999] w-36 overflow-hidden rounded-lg border border-[var(--stroke)] bg-white py-1 text-xs font-semibold text-[var(--text-primary)] shadow-xl"
      :style="{ top: `${attachmentMenuPosition.top}px`, left: `${attachmentMenuPosition.left}px` }"
      @click.stop
    >
      <label class="flex cursor-pointer items-center gap-2 px-3 py-2 transition hover:bg-[var(--surface-muted)]">
        <span class="material-symbols-outlined text-[16px] text-[var(--text-secondary)]">photo_camera</span>
        <span>Chụp ảnh</span>
        <input type="file" class="hidden" accept="image/*" capture="environment" @change="handleUpload" />
      </label>

      <label class="flex cursor-pointer items-center gap-2 px-3 py-2 transition hover:bg-[var(--surface-muted)]">
        <span class="material-symbols-outlined text-[16px] text-[var(--text-secondary)]">photo_library</span>
        <span>Thư viện</span>
        <input type="file" class="hidden" accept="image/*" multiple @change="handleUpload" />
      </label>
    </div>
  </Teleport>

</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.score-input {
  -moz-appearance: textfield;
  appearance: textfield;
  box-shadow: none;
  outline: none;
}

.score-input:focus,
.score-input:focus-visible {
  box-shadow: none;
  outline: none;
}
</style>
