<script setup>
defineOptions({ name: 'QCCreateStructureNode' })

const props = defineProps({
  node: { type: Object, required: true },
  activeNodeId: { type: String, default: '' },
  depth: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'toggle'])

const nodeId = () => String(props.node?.id || '')
const isActive = () => props.activeNodeId === nodeId()
const hasChildren = () => Array.isArray(props.node?.children) && props.node.children.length > 0

const selectNode = () => {
  emit('select', props.node)
}

const toggleNode = () => {
  if (!hasChildren()) return
  emit('toggle', props.node)
}
</script>

<template>
  <div class="qc-structure-item">
    <button
      type="button"
      class="qc-outline-node"
      :class="[
        `qc-outline-node--level-${Math.min(depth + 1, 4)}`,
        `qc-outline-node--${node.tone}`,
        !hasChildren() ? 'qc-outline-node--terminal' : '',
        isActive() ? 'qc-outline-node--active' : '',
      ]"
      @click="selectNode"
    >
      <span
        v-if="hasChildren()"
        class="material-symbols-outlined qc-outline-chevron"
        @click.stop="toggleNode"
      >{{ node.expanded ? 'keyboard_arrow_down' : 'chevron_right' }}</span>
      <span class="qc-outline-label">
        <span class="qc-outline-code">{{ node.displayOrdering || node.ordering }}</span>
        <span>{{ node.name }}</span>
      </span>
      <span class="qc-outline-count">{{ node.completed }}/{{ node.total }}</span>
    </button>

    <div
      v-if="hasChildren()"
      v-show="node.expanded"
      class="qc-outline-branch"
    >
      <QCCreateStructureNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :active-node-id="activeNodeId"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.qc-structure-item {
  min-width: 0;
}

.qc-outline-branch {
  margin-left: 0.625rem;
  padding-left: 0.125rem;
}

.qc-outline-node {
  display: grid;
  min-height: 2rem;
  width: 100%;
  cursor: pointer;
  grid-template-columns: 1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0.35rem 0.375rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.qc-outline-node:hover {
  background: var(--surface-muted);
}

.qc-outline-node--level-1 {
  font-size: 0.84rem;
  font-weight: 600;
}

.qc-outline-node--level-2 {
  min-height: 1.875rem;
  font-size: 0.8rem;
}

.qc-outline-node--level-3,
.qc-outline-node--level-4 {
  min-height: 1.875rem;
  font-size: 0.78rem;
  font-weight: 500;
}

.qc-outline-node--terminal {
  grid-template-columns: minmax(0, 1fr) auto;
}

.qc-outline-node--active {
  border-color: var(--stroke-strong);
  background: var(--surface-muted);
  color: var(--primary-strong);
}

.qc-outline-node--danger {
  color: var(--danger-text);
}

.qc-outline-chevron {
  color: currentColor;
  font-size: 1rem;
  line-height: 1;
}

.qc-outline-label {
  display: flex;
  min-width: 0;
  gap: 0.3rem;
  overflow: hidden;
  text-align: left;
  white-space: nowrap;
}

.qc-outline-label > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qc-outline-code {
  flex-shrink: 0;
  font-weight: 600;
}

.qc-outline-count {
  flex-shrink: 0;
  color: currentColor;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
