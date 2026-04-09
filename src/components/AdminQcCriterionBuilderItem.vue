<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

defineOptions({
  name: 'AdminQcCriterionBuilderItem',
})

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  depth: {
    type: Number,
    default: 1,
  },
  canMoveUp: {
    type: Boolean,
    default: false,
  },
  canMoveDown: {
    type: Boolean,
    default: false,
  },
  validationMap: {
    type: Object,
    default: () => ({}),
  },
  displayOrdering: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'add-child-group',
  'add-child-criterion',
  'move-up',
  'move-down',
  'remove',
])

const isGroupNode = computed(() => props.node?.nodeType === 'group')
const sectionExpanded = ref(props.node?.nodeType === 'group' ? props.depth <= 1 : true)

const moveUp = () => emit('move-up', props.node.id)
const moveDown = () => emit('move-down', props.node.id)
const removeNode = () => emit('remove', props.node.id)
const addChildGroup = () => emit('add-child-group', props.node.id)
const addChildCriterion = () => emit('add-child-criterion', props.node.id)
const toggleSection = () => {
  sectionExpanded.value = !sectionExpanded.value
}

const collectLeafNodes = (node) => {
  const children = Array.isArray(node?.children) ? node.children : []
  if (!children.length) return [node]
  return children.flatMap((child) => collectLeafNodes(child))
}

const groupSummary = computed(() => {
  if (!isGroupNode.value) return null

  const children = Array.isArray(props.node?.children) ? props.node.children : []
  const leafNodes = collectLeafNodes(props.node).filter((node) => node?.nodeType === 'criterion')

  return {
    childCount: children.length,
    leafCount: leafNodes.length,
  }
})

const normalizeOrderingLabel = (value) => String(value || '').trim().toUpperCase()
const getChildDisplayOrdering = (node, index) => {
  const defaultSegment = String(index + 1)
  const customSegment = node?.nodeType === 'group' ? normalizeOrderingLabel(node.orderingLabel) : ''
  const segment = customSegment || defaultSegment
  return props.displayOrdering ? `${props.displayOrdering}.${segment}` : segment
}

const displayOrderingLabel = computed(() => String(props.displayOrdering || '').trim())
const fieldErrors = computed(() => props.validationMap?.[props.node?.id] || {})
const showGroupOrderingField = computed(() => isGroupNode.value && props.depth <= 1)
const groupFormClass = computed(() => (
  showGroupOrderingField.value
    ? 'mt-3 grid gap-4 pc:grid-cols-[minmax(0,1fr)_220px]'
    : 'mt-3 grid gap-4'
))
const nodeTitle = computed(() => {
  const name = String(props.node?.name || '').trim()
  if (name) return name
  return isGroupNode.value ? 'Nhóm chưa đặt tên' : 'Tiêu chí chưa đặt tên'
})

const criterionModeLabel = computed(() => (
  String(props.node?.mode || 'point') === 'pass_fail'
    ? 'Đạt / Không đạt'
    : `${Number(props.node?.maxScore || 0)} điểm`
))
const sectionToggleAriaLabel = computed(() => (
  sectionExpanded.value
    ? `Thu gọn ${isGroupNode.value ? 'nhóm' : 'tiêu chí'}`
    : `Mở rộng ${isGroupNode.value ? 'nhóm' : 'tiêu chí'}`
))

const childLaneClass = computed(() => (
  props.depth <= 1
    ? 'ml-5 space-y-3 border-l-2 border-slate-200 pl-5'
    : 'ml-4 space-y-3 border-l border-slate-200 pl-4'
))
const customInputClass = 'py-2.5 tablet:py-3 px-4 block w-full border border-gray-200 rounded-lg bg-white text-slate-700 tablet:text-sm focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-100'
const validationInputClass = 'app-input-invalid'
const validationMessageClass = 'app-field-error'
const buildHsSelectConfig = (placeholder) => JSON.stringify({
  placeholder,
  toggleTag: '<button type="button" aria-expanded="false"></button>',
  toggleClasses: 'hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-2.5 tablet:py-3 ps-4 pe-9 flex gap-x-2 text-nowrap w-full cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:outline-hidden',
  dropdownClasses: 'mt-2 z-50 w-full max-h-72 p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto',
  optionClasses: 'py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden',
  optionTemplate: '<div class="flex justify-between items-center w-full"><span data-title></span><span class="hidden hs-selected:block"><svg class="shrink-0 size-3.5 text-slate-900" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span></div>',
  extraMarkup: '<div class="absolute top-1/2 end-3 -translate-y-1/2"><svg class="shrink-0 size-3.5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></div>',
})
const modeSelectId = computed(() => `admin-qc-criterion-mode-${props.node.id}`)
const modeSelectConfig = buildHsSelectConfig('Chọn kiểu chấm')

const updateOrderingLabel = (event) => {
  props.node.orderingLabel = String(event?.target?.value || '').trim().toUpperCase()
}

function syncPrelineSelectValue(elementId, value) {
  if (typeof document === 'undefined') return

  const selectElement = document.getElementById(elementId)
  if (!selectElement) return

  const normalizedValue = value ? String(value) : ''
  selectElement.value = normalizedValue

  const hsSelect = window.HSSelect?.getInstance?.(selectElement, true)
  if (hsSelect?.element?.setValue) {
    hsSelect.element.setValue(normalizedValue)
  }
}

async function initCriterionSelects() {
  if (isGroupNode.value) return

  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  syncPrelineSelectValue(modeSelectId.value, props.node?.mode || 'point')
}

onMounted(() => {
  initCriterionSelects()
})

watch(
  () => props.node?.mode,
  async () => {
    await nextTick()
    syncPrelineSelectValue(modeSelectId.value, props.node?.mode || 'point')
  }
)
</script>

<template>
  <article class="space-y-2.5">
    <section v-if="isGroupNode" class="rounded-2xl border border-slate-200 bg-slate-50/80">
      <div class="px-4 py-3.5">
        <div class="flex flex-wrap items-start justify-between gap-2.5">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                Nhóm
              </span>
              <span
                v-if="displayOrderingLabel"
                class="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {{ displayOrderingLabel }}
              </span>
              <p class="min-w-0 break-words text-sm font-semibold text-slate-900">
                {{ nodeTitle }}
              </p>
              <span v-if="groupSummary" class="text-[11px] font-medium text-slate-500">
                {{ groupSummary.childCount }} mục con • {{ groupSummary.leafCount }} tiêu chí lá
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white"
              :aria-expanded="String(sectionExpanded)"
              :aria-label="sectionToggleAriaLabel"
              @click="toggleSection"
            >
              <span class="material-symbols-outlined text-[18px]">{{ sectionExpanded ? 'expand_less' : 'expand_more' }}</span>
            </button>
          </div>
        </div>

        <div v-show="sectionExpanded" :class="groupFormClass">
          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Tên nhóm</span>
            <input
              v-model="node.name"
              type="text"
              :class="[customInputClass, fieldErrors.name ? validationInputClass : '']"
              placeholder="VD: Quy trình phục vụ"
            />
            <p v-if="fieldErrors.name" :class="validationMessageClass">{{ fieldErrors.name }}</p>
          </label>

          <label v-if="showGroupOrderingField" class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Mã thứ tự nhóm</span>
            <input
              :value="node.orderingLabel"
              type="text"
              :class="[customInputClass, 'uppercase', fieldErrors.orderingLabel ? validationInputClass : '']"
              placeholder="VD: A"
              @input="updateOrderingLabel"
            />
            <p v-if="fieldErrors.orderingLabel" :class="validationMessageClass">{{ fieldErrors.orderingLabel }}</p>
            <p class="text-xs leading-5 text-slate-400">Để trống nếu muốn giữ thứ tự tự động theo vị trí.</p>
          </label>
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 pt-3">
          <div v-show="sectionExpanded" class="flex flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              @click="addChildGroup"
            >
              <span class="material-symbols-outlined text-[18px]">account_tree</span>
              Thêm nhóm con
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              @click="addChildCriterion"
            >
              <span class="material-symbols-outlined text-[18px]">playlist_add</span>
              Thêm tiêu chí
            </button>
            <p v-if="fieldErrors.children" class="w-full text-sm text-rose-600">{{ fieldErrors.children }}</p>
          </div>

          <div class="ml-auto inline-flex items-center gap-2">
            <div class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1">
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canMoveUp"
                aria-label="Di chuyển lên"
                @click="moveUp"
              >
                <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
              </button>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canMoveDown"
                aria-label="Di chuyển xuống"
                @click="moveDown"
              >
                <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
              </button>
            </div>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
              aria-label="Xóa mục"
              @click="removeNode"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      <div class="flex flex-wrap items-start justify-between gap-2.5">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Tiêu chí
            </span>
            <span
              v-if="displayOrderingLabel"
              class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
            >
              {{ displayOrderingLabel }}
            </span>
            <p class="min-w-0 break-words text-sm font-semibold text-slate-900">
              {{ nodeTitle }}
            </p>
            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {{ criterionModeLabel }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
            :aria-expanded="String(sectionExpanded)"
            :aria-label="sectionToggleAriaLabel"
            @click="toggleSection"
          >
            <span class="material-symbols-outlined text-[18px]">{{ sectionExpanded ? 'expand_less' : 'expand_more' }}</span>
          </button>
        </div>
      </div>

      <div v-show="sectionExpanded" class="mt-3 grid gap-4 pc:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
        <label class="space-y-2">
          <span class="text-sm font-semibold text-slate-700">Tên tiêu chí</span>
          <input
            v-model="node.name"
            type="text"
            :class="[customInputClass, fieldErrors.name ? validationInputClass : '']"
            placeholder="VD: Chào khách trong 5 giây"
          />
          <p v-if="fieldErrors.name" :class="validationMessageClass">{{ fieldErrors.name }}</p>
        </label>

        <div class="grid gap-3 tablet:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Kiểu chấm</span>
            <select
              :id="modeSelectId"
              v-model="node.mode"
              class="hidden"
              :data-hs-select="modeSelectConfig"
            >
              <option value="point">Chấm điểm</option>
              <option value="pass_fail">Đạt / Không đạt</option>
            </select>
            <p v-if="fieldErrors.mode" :class="validationMessageClass">{{ fieldErrors.mode }}</p>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Điểm tối đa</span>
            <input
              v-model.number="node.maxScore"
              type="number"
              min="1"
              step="1"
              :disabled="node.mode === 'pass_fail'"
              :class="[customInputClass, 'no-spin', fieldErrors.maxScore ? validationInputClass : '']"
            />
            <p v-if="fieldErrors.maxScore" :class="validationMessageClass">{{ fieldErrors.maxScore }}</p>
            <p v-if="node.mode === 'pass_fail'" class="text-xs text-slate-400">Kiểu này luôn quy đổi về 1 điểm.</p>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Điểm đạt tối thiểu</span>
            <input
              v-model.number="node.minPassScore"
              type="number"
              min="0"
              :max="node.maxScore"
              step="0.1"
              :disabled="node.mode === 'pass_fail'"
              :class="[customInputClass, 'no-spin', fieldErrors.minPassScore ? validationInputClass : '']"
            />
            <p v-if="fieldErrors.minPassScore" :class="validationMessageClass">{{ fieldErrors.minPassScore }}</p>
            <p v-if="node.mode === 'pass_fail'" class="text-xs text-slate-400">Mặc định tính là 1 điểm.</p>
            <p v-else class="text-xs text-slate-400">Dưới điểm này sẽ bị tính Không Đạt.</p>
          </label>

        </div>
      </div>

      <div class="mt-3 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
        <div class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1 py-1">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canMoveUp"
            aria-label="Di chuyển lên"
            @click="moveUp"
          >
            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
          </button>
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canMoveDown"
            aria-label="Di chuyển xuống"
            @click="moveDown"
          >
            <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
          </button>
        </div>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
          aria-label="Xóa mục"
          @click="removeNode"
        >
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </section>

    <div v-if="isGroupNode && sectionExpanded" :class="childLaneClass">
      <AdminQcCriterionBuilderItem
        v-for="(child, index) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :validation-map="validationMap"
        :display-ordering="getChildDisplayOrdering(child, index)"
        :can-move-up="index > 0"
        :can-move-down="index < node.children.length - 1"
        @add-child-group="emit('add-child-group', $event)"
        @add-child-criterion="emit('add-child-criterion', $event)"
        @move-up="emit('move-up', $event)"
        @move-down="emit('move-down', $event)"
        @remove="emit('remove', $event)"
      />

      <p
        v-if="!node.children.length"
        class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500"
      >
        Nhóm này chưa có nội dung. Hãy thêm nhóm con hoặc tiêu chí để tiếp tục dựng cây.
      </p>
    </div>
  </article>
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
