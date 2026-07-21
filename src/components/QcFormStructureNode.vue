<script setup>
import { computed } from 'vue'
import { ChevronDown, ChevronRight, Folders, Gauge, ListTree, ToggleRight, TrendingDown } from '@lucide/vue'

defineOptions({ name: 'QcFormStructureNode' })

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 1 },
  expandedIds: { type: Object, required: true },
})

const emit = defineEmits(['toggle'])
const isGroup = computed(() => props.node.nodeType === 'group')
const expanded = computed(() => props.expandedIds.has(String(props.node.id)))
const leaves = computed(() => {
  const collect = (node) => !node.children?.length ? (node.nodeType === 'group' ? [] : [node]) : node.children.flatMap(collect)
  return collect(props.node)
})
const maxScore = computed(() => leaves.value.reduce((total, item) => item.mode === 'deduction' ? total : total + Number(item.maxScore || 0), 0))
const modeLabel = computed(() => props.node.mode === 'deduction' ? `-${Number(props.node.deductionPercent || 0)} điểm %` : `${Number(props.node.maxScore || 0)} điểm`)
const modeName = computed(() => {
  if (props.node.mode === 'deduction') return 'Khấu trừ'
  if (props.node.mode === 'pass_fail') return 'Đạt / Không đạt'
  return 'Chấm điểm'
})
const modeIcon = computed(() => {
  if (props.node.mode === 'deduction') return TrendingDown
  if (props.node.mode === 'pass_fail') return ToggleRight
  return Gauge
})
const groupIndent = computed(() => `${10 + Math.max(props.depth - 1, 0) * 10}px`)
const criterionIndent = computed(() => `${30 + Math.max(props.depth - 1, 0) * 10}px`)
</script>

<template>
  <div>
    <button v-if="isGroup" type="button" class="flex w-full flex-wrap items-center gap-2 border-b border-[var(--stroke)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]" :style="{ paddingLeft: groupIndent }" @click="emit('toggle', node.id)">
      <ChevronDown v-if="expanded" :size="17" :stroke-width="2" class="shrink-0 text-[var(--text-secondary)]" />
      <ChevronRight v-else :size="17" :stroke-width="2" class="shrink-0 text-[var(--text-secondary)]" />
      <Folders :size="19" :stroke-width="2" class="shrink-0 text-blue-600" />
      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{{ node.ordering ? `${node.ordering}. ` : '' }}{{ node.name }}</span>
      <span class="ml-14 shrink-0 text-xs font-medium text-[var(--text-secondary)] tablet:ml-0">{{ leaves.length }} tiêu chí<span v-if="maxScore"> · {{ maxScore }} điểm</span></span>
    </button>
    <div v-else class="flex flex-wrap items-start gap-2 border-b border-[var(--stroke)] px-3 py-3 tablet:flex-nowrap tablet:items-center tablet:gap-3" :style="{ paddingLeft: criterionIndent }">
      <ListTree :size="16" :stroke-width="1.8" class="shrink-0 text-[var(--text-muted)]" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-[var(--text-primary)]">{{ node.ordering ? `${node.ordering} ` : '' }}{{ node.name }}</p>
        <p v-if="node.description" class="mt-0.5 truncate text-xs text-[var(--text-muted)]">{{ node.description }}</p>
      </div>
      <div class="ml-6 flex w-full flex-wrap items-center gap-1.5 tablet:ml-0 tablet:w-auto tablet:shrink-0">
        <span
          class="inline-flex h-5 items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 text-[10px] font-semibold leading-none"
          :class="node.mode === 'deduction' ? 'border-amber-200 bg-amber-50 text-amber-700' : node.mode === 'pass_fail' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'"
        >
          <component :is="modeIcon" :size="10" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          {{ modeName }}
        </span>
        <span class="inline-flex h-5 items-center whitespace-nowrap rounded-full px-1.5 text-[10px] font-bold leading-none" :class="node.mode === 'deduction' ? 'bg-amber-100 text-amber-800' : node.mode === 'pass_fail' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'">{{ modeLabel }}</span>
      </div>
    </div>
    <div v-if="isGroup && expanded">
      <QcFormStructureNode v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" :expanded-ids="expandedIds" @toggle="emit('toggle', $event)" />
    </div>
  </div>
</template>
