<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'AdminQcBuilderTreeNode' })

const props = defineProps({
  node: { type: Object, required: true },
  ordering: { type: String, required: true },
  selectedNodeId: { type: [String, Number], default: '' },
  validationMap: { type: Object, default: () => ({}) },
  canMoveUp: { type: Boolean, default: false },
  canMoveDown: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'add-child', 'move-up', 'move-down', 'remove'])
const expanded = ref(true)
const isGroup = computed(() => props.node.nodeType === 'group')
const hasError = computed(() => Boolean(props.validationMap?.[props.node.id]))

const isCriterionComplete = (node) => {
  if (!String(node?.name || '').trim()) return false

  const mode = String(node?.mode || '').trim()
  if (!['point', 'pass_fail', 'deduction'].includes(mode)) return false

  if (mode === 'deduction') {
    const deductionPercent = Number(node?.deductionPercent)
    return Number.isFinite(deductionPercent) && deductionPercent > 0 && deductionPercent <= 100
  }

  const maxScore = Number(node?.maxScore)
  return Number.isFinite(maxScore) && maxScore > 0
}

const isNodeComplete = (node) => {
  if (node?.nodeType === 'criterion') return isCriterionComplete(node)
  const children = Array.isArray(node?.children) ? node.children : []
  return Boolean(String(node?.name || '').trim()) && children.length > 0 && children.every(isNodeComplete)
}

const isComplete = computed(() => isNodeComplete(props.node))
const statusIcon = computed(() => {
  if (isComplete.value) return 'check_circle'
  return 'warning'
})
const statusClass = computed(() => {
  if (isComplete.value) return 'text-emerald-500'
  return 'text-orange-500'
})
const statusLabel = computed(() => {
  if (isComplete.value) return 'Đã hoàn tất'
  return hasError.value ? 'Có lỗi cần xử lý' : 'Chưa hoàn tất'
})

const collectCriteria = (node) => {
  if (node.nodeType === 'criterion') return [node]
  return (node.children || []).flatMap(collectCriteria)
}

const criterionCount = computed(() => collectCriteria(props.node).length)
const totalScore = computed(() => collectCriteria(props.node).reduce((total, node) => (
  total + (node.mode === 'deduction' ? 0 : Number(node.maxScore || 0))
), 0))

const childOrdering = (child, index) => {
  const segment = child.nodeType === 'group' && child.orderingLabel
    ? String(child.orderingLabel).trim().toUpperCase()
    : String(index + 1)
  return `${props.ordering}.${segment}`
}
</script>

<template>
  <article class="space-y-2">
    <div
      class="group flex min-h-14 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-2 py-2 transition-all tablet:gap-2 tablet:px-2.5"
      :class="selectedNodeId === node.id ? 'border-[var(--primary)] bg-[var(--primary-softer)] shadow-sm' : 'border-[var(--stroke)] hover:border-[var(--stroke-strong)]'"
      @click="emit('select', node.id)"
    >
      <button
        v-if="isGroup"
        type="button"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-white"
        :aria-label="expanded ? 'Thu gọn nhóm' : 'Mở rộng nhóm'"
        @click.stop="expanded = !expanded"
      >
        <span class="material-symbols-outlined text-[18px]">{{ expanded ? 'expand_more' : 'chevron_right' }}</span>
      </button>
      <span v-else class="inline-flex size-7 shrink-0 items-center justify-center text-[var(--text-muted)]"><span class="material-symbols-outlined text-[17px]">drag_indicator</span></span>

      <span class="inline-flex max-w-[3.75rem] shrink-0 items-center justify-center truncate rounded-full border border-[var(--stroke)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] tablet:min-w-8">{{ ordering }}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-[var(--text-primary)]">{{ node.name || (isGroup ? 'Nhóm chưa đặt tên' : 'Tiêu chí chưa đặt tên') }}</p>
        <p class="mt-0.5 text-[11px] text-[var(--text-muted)]">{{ isGroup ? `${criterionCount} tiêu chí · ${totalScore} điểm` : (node.mode === 'deduction' ? `Khấu trừ ${node.deductionPercent || 0}%` : `${node.maxScore || 0} điểm`) }}</p>
      </div>
      <span class="material-symbols-outlined text-[18px]" :class="statusClass" :title="statusLabel" :aria-label="statusLabel">{{ statusIcon }}</span>
      <div class="flex items-center gap-0.5 pc:hidden pc:group-hover:flex">
        <button type="button" class="node-action" :disabled="!canMoveUp" aria-label="Di chuyển lên" @click.stop="emit('move-up', node.id)"><span class="material-symbols-outlined text-[17px]">keyboard_arrow_up</span></button>
        <button type="button" class="node-action" :disabled="!canMoveDown" aria-label="Di chuyển xuống" @click.stop="emit('move-down', node.id)"><span class="material-symbols-outlined text-[17px]">keyboard_arrow_down</span></button>
      </div>
    </div>

    <div v-if="isGroup && expanded" class="ml-2 space-y-2 border-l border-[var(--stroke)] pl-2 tablet:ml-4 tablet:pl-3 pc:ml-5">
      <AdminQcBuilderTreeNode
        v-for="(child, index) in node.children"
        :key="child.id"
        :node="child"
        :ordering="childOrdering(child, index)"
        :selected-node-id="selectedNodeId"
        :validation-map="validationMap"
        :can-move-up="index > 0"
        :can-move-down="index < node.children.length - 1"
        @select="emit('select', $event)"
        @add-child="emit('add-child', $event)"
        @move-up="emit('move-up', $event)"
        @move-down="emit('move-down', $event)"
        @remove="emit('remove', $event)"
      />
      <button type="button" class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--stroke-strong)] py-2 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-softer)]" @click="emit('add-child', node.id)">
        <span class="material-symbols-outlined text-[16px]">add</span>Thêm mục tại đây
      </button>
    </div>
  </article>
</template>

<style scoped>
.node-action {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-secondary);
}
.node-action:hover { background: var(--surface-muted); }
.node-action:disabled { cursor: not-allowed; opacity: 0.3; }
</style>
