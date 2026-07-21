<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'AdminQcOutlineNode' })

const props = defineProps({
  node: { type: Object, required: true },
  ordering: { type: String, required: true },
  selectedNodeId: { type: [String, Number], default: '' },
  query: { type: String, default: '' },
  depth: { type: Number, default: 0 },
})

const emit = defineEmits(['select'])
const expanded = ref(true)
const isGroup = computed(() => props.node.nodeType === 'group')
const normalizedQuery = computed(() => props.query.trim().toLocaleLowerCase('vi'))

const childOrdering = (child, index) => {
  const segment = child.nodeType === 'group' && child.orderingLabel
    ? String(child.orderingLabel).trim().toUpperCase()
    : String(index + 1)
  return `${props.ordering}.${segment}`
}

const matchesQuery = (node) => {
  if (!normalizedQuery.value) return true
  if (String(node.name || '').toLocaleLowerCase('vi').includes(normalizedQuery.value)) return true
  return (node.children || []).some(matchesQuery)
}

const visibleChildren = computed(() => (props.node.children || []).filter(matchesQuery))
const isVisible = computed(() => matchesQuery(props.node))
</script>

<template>
  <li v-if="isVisible" class="list-none">
    <button
      type="button"
      class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
      :class="selectedNodeId === node.id ? 'bg-[var(--primary-softer)] text-[var(--primary)]' : 'text-[var(--text-secondary)]'"
      @click="emit('select', node.id)"
    >
      <span
        v-if="isGroup"
        class="inline-flex size-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-white"
        @click.stop="expanded = !expanded"
      ><span class="material-symbols-outlined text-[17px]">{{ expanded ? 'expand_more' : 'chevron_right' }}</span></span>
      <span v-else class="inline-flex size-5 shrink-0"></span>
      <span class="shrink-0 text-[11px] text-[var(--text-muted)]">{{ ordering }}</span>
      <span class="min-w-0 flex-1 truncate text-xs" :class="isGroup ? 'font-semibold text-[var(--text-primary)]' : 'font-medium'" :title="node.name || ''">{{ node.name || (isGroup ? 'Nhóm chưa đặt tên' : 'Tiêu chí chưa đặt tên') }}</span>
    </button>

    <ul
      v-if="isGroup && (expanded || normalizedQuery)"
      class="space-y-0.5"
      :class="depth === 0 ? 'ml-3 border-l border-[var(--stroke)] pl-2' : (depth === 1 ? 'ml-2 border-l border-[var(--stroke)] pl-1.5' : 'ml-1 pl-1')"
    >
      <AdminQcOutlineNode
        v-for="(child, index) in visibleChildren"
        :key="child.id"
        :node="child"
        :ordering="childOrdering(child, index)"
        :selected-node-id="selectedNodeId"
        :query="query"
        :depth="depth + 1"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>
