<script setup>
import { computed, ref } from 'vue'

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
})

const emit = defineEmits([
  'add-child-group',
  'add-child-criterion',
  'move-up',
  'move-down',
  'remove',
])

const isGroupNode = computed(() => props.node?.nodeType === 'group')
const sectionExpanded = ref(props.depth <= 1)

const moveUp = () => emit('move-up', props.node.id)
const moveDown = () => emit('move-down', props.node.id)
const removeNode = () => emit('remove', props.node.id)
const addChildGroup = () => emit('add-child-group', props.node.id)
const addChildCriterion = () => emit('add-child-criterion', props.node.id)
const toggleSection = () => {
  if (!isGroupNode.value) return
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

const nodeTitle = computed(() => {
  const name = String(props.node?.name || '').trim()
  if (name) return name
  return isGroupNode.value ? 'Nhóm mới' : 'Tiêu chí mới'
})

const nodeDescription = computed(() => String(props.node?.description || '').trim())
const groupOrderingLabel = computed(() => String(props.node?.orderingLabel || '').trim().toUpperCase())

const criterionModeLabel = computed(() => (
  String(props.node?.mode || 'point') === 'pass_fail'
    ? 'Đạt / Không đạt'
    : `${Number(props.node?.maxScore || 0)} điểm`
))

const frequencyLabel = computed(() => (
  String(props.node?.frequency || 'per_audit') === 'weekly_once'
    ? 'Mỗi tuần một lần'
    : 'Mỗi lần kiểm'
))

const childLaneClass = computed(() => (
  props.depth <= 1
    ? 'ml-5 space-y-3 border-l-2 border-blue-100 pl-5'
    : 'ml-4 space-y-3 border-l border-slate-200 pl-4'
))

const updateOrderingLabel = (event) => {
  props.node.orderingLabel = String(event?.target?.value || '').trim().toUpperCase()
}
</script>

<template>
  <article class="space-y-3">
    <section v-if="isGroupNode" class="rounded-2xl border border-blue-100 bg-blue-50/70">
      <div class="px-4 py-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Nhóm
              </span>
              <span
                v-if="groupOrderingLabel"
                class="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {{ groupOrderingLabel }}
              </span>
              <span v-if="groupSummary" class="text-[11px] font-medium text-slate-500">
                {{ groupSummary.childCount }} mục con • {{ groupSummary.leafCount }} tiêu chí lá
              </span>
            </div>

            <h4 class="mt-2 text-sm font-semibold text-slate-900">{{ nodeTitle }}</h4>
            <p class="mt-1 text-sm leading-6 text-slate-600">
              {{ nodeDescription || 'Dùng nhóm này để gom các tiêu chí cùng một phần việc.' }}
            </p>
          </div>

          <div class="flex items-center gap-1">
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
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
              aria-label="Xóa mục"
              @click="removeNode"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white"
              :aria-expanded="String(sectionExpanded)"
              :aria-label="sectionExpanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'"
              @click="toggleSection"
            >
              <span class="material-symbols-outlined text-[18px]">{{ sectionExpanded ? 'expand_less' : 'expand_more' }}</span>
            </button>
          </div>
        </div>

        <div v-show="sectionExpanded" class="mt-4 grid gap-4 border-t border-blue-100 pt-4 lg:grid-cols-[minmax(160px,0.45fr)_minmax(0,1fr)]">
          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Mã thứ tự nhóm</span>
            <input
              :value="node.orderingLabel"
              type="text"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm uppercase text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="VD: A"
              @input="updateOrderingLabel"
            />
            <p class="text-xs text-slate-400">Để trống nếu muốn giữ thứ tự tự động theo vị trí.</p>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Tên nhóm</span>
            <input
              v-model="node.name"
              type="text"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="VD: Quy trình phục vụ"
            />
          </label>

          <label class="space-y-2 lg:col-span-2">
            <span class="text-sm font-semibold text-slate-700">Mô tả</span>
            <textarea
              v-model="node.description"
              rows="3"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Mô tả ngắn phạm vi hoặc mục tiêu của nhóm này"
            />
          </label>
        </div>

        <div v-show="sectionExpanded" class="mt-4 flex flex-wrap items-center gap-2 border-t border-blue-100 pt-4">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            @click="addChildGroup"
          >
            <span class="material-symbols-outlined text-[18px]">account_tree</span>
            Thêm nhóm con
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
            @click="addChildCriterion"
          >
            <span class="material-symbols-outlined text-[18px]">playlist_add</span>
            Thêm tiêu chí
          </button>
        </div>
      </div>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Tiêu chí
            </span>
            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {{ criterionModeLabel }}
            </span>
            <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {{ frequencyLabel }}
            </span>
            <span
              v-if="node.required"
              class="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
            >
              Bắt buộc
            </span>
            <span
              v-if="node.isCritical"
              class="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700"
            >
              Trọng yếu
            </span>
          </div>

          <h4 class="mt-2 text-sm font-semibold text-slate-900">{{ nodeTitle }}</h4>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            {{ nodeDescription || 'Node lá này sẽ xuất hiện trực tiếp ở màn chấm QC.' }}
          </p>
        </div>

        <div class="flex items-center gap-1">
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

      <div class="mt-4 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <div class="space-y-4">
          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Tên tiêu chí</span>
            <input
              v-model="node.name"
              type="text"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="VD: Chào khách trong 5 giây"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Mô tả</span>
            <textarea
              v-model="node.description"
              rows="3"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Mô tả ngắn cách chấm hoặc minh chứng cần kiểm tra"
            />
          </label>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2 sm:col-span-2">
            <span class="text-sm font-semibold text-slate-700">Kiểu chấm</span>
            <select
              v-model="node.mode"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="point">Chấm điểm</option>
              <option value="pass_fail">Đạt / Không đạt</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Điểm tối đa</span>
            <input
              v-model.number="node.maxScore"
              type="number"
              min="1"
              step="1"
              :disabled="node.mode === 'pass_fail'"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <p v-if="node.mode === 'pass_fail'" class="text-xs text-slate-400">Kiểu này luôn quy đổi về 1 điểm.</p>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-slate-700">Trọng số</span>
            <input
              v-model.number="node.weight"
              type="number"
              min="0"
              step="0.1"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label class="space-y-2 sm:col-span-2">
            <span class="text-sm font-semibold text-slate-700">Tần suất</span>
            <select
              v-model="node.frequency"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="per_audit">Mỗi lần kiểm</option>
              <option value="weekly_once">Mỗi tuần một lần</option>
            </select>
          </label>

          <label class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <input v-model="node.required" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span class="text-sm font-medium text-slate-700">Tiêu chí bắt buộc</span>
          </label>

          <label class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <input v-model="node.isCritical" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span class="text-sm font-medium text-slate-700">Tiêu chí trọng yếu</span>
          </label>
        </div>
      </div>
    </section>

    <div v-if="isGroupNode && sectionExpanded" :class="childLaneClass">
      <AdminQcCriterionBuilderItem
        v-for="(child, index) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
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
