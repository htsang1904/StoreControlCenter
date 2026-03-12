<script setup>
import { computed, ref } from 'vue'

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
})

const emit = defineEmits(['update-state', 'upload-attachment', 'remove-attachment', 'open-finding-modal'])

const sectionExpanded = ref(props.level <= 2)
const detailsExpanded = ref(false)

const hasChildren = computed(() => Array.isArray(props.criterion.children) && props.criterion.children.length > 0)
const state = computed(() => props.criteriaStates[props.criterion.id] || { status: 'pending', score: null, note: '', attachments: [] })
const criterionDomId = computed(() => `criterion-${props.criterion.id}`)

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const resolveCriterionStatus = (criterion, criterionState = {}) => {
  const rawStatus = String(criterionState?.status || 'pending')
  if (rawStatus === 'na' && criterion?.mode !== 'point') return 'na'

  if (criterion?.mode === 'point') {
    const rawScore = criterionState?.score
    if (rawScore === null || rawScore === undefined || String(rawScore) === '') {
      return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
    }

    const score = toNumber(rawScore, NaN)
    if (!Number.isFinite(score)) return 'pending'
    return score >= toNumber(criterion?.passScore ?? criterion?.maxScore, 0) ? 'pass' : 'fail'
  }

  return rawStatus === 'pass' || rawStatus === 'fail' ? rawStatus : 'pending'
}

const currentStatus = computed(() => resolveCriterionStatus(props.criterion, state.value))

const cardToneClass = computed(() => {
  if (props.criterion.mode === 'point') return 'border-slate-200'
  if (currentStatus.value === 'pass') return 'border-emerald-200'
  if (currentStatus.value === 'fail') return 'border-rose-200'
  if (currentStatus.value === 'na') return 'border-slate-300'
  return 'border-slate-200'
})

const statusBadgeClass = computed(() => {
  if (currentStatus.value === 'pass') return 'bg-emerald-600 text-white'
  if (currentStatus.value === 'fail') return 'bg-rose-600 text-white'
  if (currentStatus.value === 'na') return 'bg-guta-blue text-white'
  return 'bg-slate-100 text-slate-600'
})

const statusLabel = computed(() => {
  if (currentStatus.value === 'pass') return 'Đạt'
  if (currentStatus.value === 'fail') return 'Không đạt'
  if (currentStatus.value === 'na') return 'N/A'
  return 'Chưa chấm'
})

const metricLabel = computed(() => (
  props.criterion.mode === 'point'
    ? `Tối đa ${toNumber(props.criterion.maxScore)} điểm`
    : 'Đánh giá đạt / không đạt'
))

const pointThreshold = computed(() => toNumber(props.criterion.passScore ?? props.criterion.maxScore, 0))
const scorePercent = computed(() => {
  if (props.criterion.mode !== 'point') return 0
  const maxScore = Math.max(toNumber(props.criterion.maxScore), 0)
  if (maxScore <= 0) return 0
  const score = Math.min(Math.max(toNumber(state.value.score), 0), maxScore)
  return Math.round((score / maxScore) * 100)
})

const scoreHint = computed(() => {
  if (props.criterion.mode !== 'point') return ''
  if (state.value.score === null || state.value.score === undefined || String(state.value.score) === '') {
    return `Ngưỡng đạt từ ${pointThreshold.value}/${toNumber(props.criterion.maxScore)}`
  }
  return currentStatus.value === 'pass'
    ? `Đạt ngưỡng ${pointThreshold.value}/${toNumber(props.criterion.maxScore)}`
    : `Chưa đạt ngưỡng ${pointThreshold.value}/${toNumber(props.criterion.maxScore)}`
})

const scoreHintClass = computed(() => {
  if (currentStatus.value === 'pass') return 'text-emerald-700'
  if (currentStatus.value === 'fail') return 'text-rose-700'
  return 'text-slate-500'
})

const canShowDetails = computed(() => currentStatus.value !== 'pending' && currentStatus.value !== 'na')
const detailsVisible = computed(() => (
  canShowDetails.value
  && (
    detailsExpanded.value
    || currentStatus.value === 'fail'
    || Boolean(String(state.value.note || '').trim())
    || (Array.isArray(state.value.attachments) && state.value.attachments.length > 0)
  )
))

const detailToggleLabel = computed(() => (
  detailsVisible.value ? 'Ẩn ghi chú & ảnh' : 'Thêm ghi chú & ảnh'
))

const sectionHeaderClass = computed(() => {
  if (props.level === 1) {
    return 'rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4'
  }

  if (props.level === 2) {
    return 'rounded-xl border border-blue-100/80 bg-blue-50/55 px-4 py-3'
  }

  return 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'
})

const sectionTagClass = computed(() => {
  if (props.level <= 2) {
    return 'bg-white text-guta-blue'
  }

  return 'bg-slate-100 text-slate-600'
})

const sectionTitleClass = computed(() => {
  if (props.level === 1) return 'text-base font-semibold text-slate-900'
  if (props.level === 2) return 'text-[15px] font-semibold text-slate-900'
  return 'text-sm font-semibold text-slate-900'
})

const sectionChildrenLaneClass = computed(() => {
  if (props.level === 1) return 'ml-5 space-y-1 border-l-2 border-blue-100 pl-5'
  return 'ml-4 space-y-1 border-l border-blue-100 pl-4'
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
  updateState({ status })
}

const handleScoreChange = (event) => {
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

  updateState({
    score: normalizedScore,
    status: normalizedScore === null
      ? 'pending'
      : (normalizedScore >= pointThreshold.value ? 'pass' : 'fail'),
  })
}

const handleUpload = (event) => {
  emit('upload-attachment', props.criterion.id, event)
}

const removeAttachment = (index) => {
  emit('remove-attachment', props.criterion.id, index)
}

const toggleSection = () => {
  sectionExpanded.value = !sectionExpanded.value
}

const toggleDetails = () => {
  if (!canShowDetails.value) return
  detailsExpanded.value = !detailsExpanded.value
}
</script>

<template>
  <div :class="['qc-criterion-item', level > 1 ? 'mt-2' : 'mt-4']">
    <div v-if="hasChildren" class="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        class="cursor-pointer flex w-full items-start gap-3 text-left transition"
        :class="sectionHeaderClass"
        :aria-expanded="String(sectionExpanded)"
        @click="toggleSection"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" :class="sectionTagClass">
              {{ criterion.ordering || `Nhóm ${level}` }}
            </span>
            <h3 :class="sectionTitleClass">{{ criterion.name }}</h3>
          </div>
        </div>

        <div v-if="sectionSummary" class="hidden shrink-0 items-center gap-2 md:flex">
          <span class="text-[11px] text-slate-500">
            {{ sectionSummary.completed }}/{{ sectionSummary.total }} hoàn tất
          </span>
          <span v-if="sectionSummary.failed > 0" class="text-[11px] text-rose-600">{{ sectionSummary.failed }} lỗi</span>
        </div>

        <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
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

      <div v-show="sectionExpanded" class="pb-2">
        <div :class="sectionChildrenLaneClass">
          <QCCriterionTreeItem
            v-for="child in criterion.children"
            :key="child.id"
            :criterion="child"
            :level="level + 1"
            :criteria-states="criteriaStates"
            :max-attachments="maxAttachments"
            :show-finding-action="showFindingAction"
            @update-state="(id, updates) => $emit('update-state', id, updates)"
            @upload-attachment="(id, event) => $emit('upload-attachment', id, event)"
            @remove-attachment="(id, index) => $emit('remove-attachment', id, index)"
            @open-finding-modal="(id) => $emit('open-finding-modal', id)"
          />
        </div>
      </div>
    </div>

    <div
      v-else
      :id="criterionDomId"
      :class="['scroll-mt-24 border-b bg-white py-4 last:border-b-0 transition-colors', cardToneClass]"
    >
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {{ criterion.ordering || criterion.code || 'Tiêu chí' }}
            </span>
            <span class="text-[11px] text-slate-500">
              {{ metricLabel }}
            </span>
            <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold" :class="statusBadgeClass">
              {{ statusLabel }}
            </span>
          </div>

          <h4 class="mt-2 text-sm font-semibold leading-6 text-slate-900">
            {{ criterion.name }}
          </h4>
          <p v-if="criterion.description" class="mt-1 text-sm leading-6 text-slate-600">
            {{ criterion.description }}
          </p>
        </div>

        <div class="w-full lg:min-w-[280px] lg:max-w-[320px]">
          <div v-if="criterion.mode === 'pass_fail'" class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition"
              :class="currentStatus === 'pass' ? 'border-emerald-200 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'"
              @click="handlePassFail('pass')"
            >
              Đạt
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition"
              :class="currentStatus === 'fail' ? 'border-rose-200 bg-rose-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50'"
              @click="handlePassFail('fail')"
            >
              Không đạt
            </button>
          </div>

          <div v-else class="space-y-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50/90">
              <div class="flex items-center gap-3">
                <input
                  type="number"
                  :value="state.score"
                  :min="0"
                  :max="criterion.maxScore"
                  step="0.5"
                  placeholder="Điểm"
                  class="score-input h-10 min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight text-slate-900 placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                  @input="handleScoreChange"
                />
                <span class="inline-flex shrink-0 items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                  / {{ criterion.maxScore }} điểm
                </span>
              </div>
              <div class="mt-2 flex items-center justify-between gap-3 text-[11px]">
                <span class="text-slate-500">Ngưỡng đạt {{ pointThreshold }}/{{ criterion.maxScore }}</span>
                <span class="font-medium" :class="scoreHintClass">{{ scoreHint }}</span>
              </div>
            </div>

            <div class="px-1">
              <div class="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  class="h-full rounded-full transition-all duration-200"
                  :class="currentStatus === 'fail' ? 'bg-rose-500' : currentStatus === 'pass' ? 'bg-emerald-500' : 'bg-blue-500'"
                  :style="{ width: `${scorePercent}%` }"
                ></div>
              </div>
              <div class="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span class="text-slate-500">Điểm: {{ state.score ?? '--' }}</span>
                <span class="font-medium" :class="scoreHintClass">{{ statusLabel }}</span>
              </div>
            </div>
          </div>

          <button
            v-if="showFindingAction && currentStatus === 'fail'"
            type="button"
            class="cursor-pointer mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
            @click="$emit('open-finding-modal', criterion.id)"
          >
            <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Khắc phục
          </button>
        </div>
      </div>

      <div v-if="canShowDetails" class="mt-3 border-t border-slate-200 pt-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-slate-500">Ghi chú & ảnh</p>
            <p class="mt-1 text-[11px] text-slate-500">
              {{ Array.isArray(state.attachments) ? state.attachments.length : 0 }}/{{ maxAttachments }} ảnh được phép đính kèm
            </p>
          </div>

          <button
            type="button"
            class="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            @click="toggleDetails"
          >
            {{ detailToggleLabel }}
          </button>
        </div>

        <div v-if="detailsVisible" class="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label class="block text-xs font-medium text-slate-500">Nhận xét</label>
            <textarea
              :value="state.note"
              rows="3"
              class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              :placeholder="currentStatus === 'fail' ? 'Mô tả chi tiết lỗi và yêu cầu xử lý...' : 'Ghi chú thêm cho tiêu chí này...'"
              @input="(event) => updateState({ note: event.target.value })"
            ></textarea>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-500">Ảnh minh chứng</label>
            <div class="mt-2 flex flex-wrap gap-2">
              <div
                v-for="(file, index) in state.attachments"
                :key="file.id || index"
                class="group relative h-[72px] w-[72px] overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <img :src="file.preview || file.url" class="h-full w-full object-cover" />
                <button
                  type="button"
                  class="cursor-pointer absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100"
                  @click="removeAttachment(index)"
                >
                  <svg class="size-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="m19 6-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>

              <label
                v-if="state.attachments.length < maxAttachments"
                class="cursor-pointer flex h-[72px] w-[72px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <span class="text-lg font-semibold">+</span>
                <span class="text-[11px] font-medium">Thêm ảnh</span>
                <input type="file" class="hidden" accept="image/*" multiple @change="handleUpload" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qc-criterion-item {
  transition: all 0.2s ease;
}

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
