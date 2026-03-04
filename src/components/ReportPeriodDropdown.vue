<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  activeKey: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const rootRef = ref(null)
const open = ref(false)

const options = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
]

const activeLabel = computed(() => {
  const found = options.find((item) => item.key === props.activeKey)
  return found ? found.label : 'Tùy chọn'
})

function toggleDropdown() {
  if (props.disabled) return
  open.value = !open.value
}

function selectPeriod(key) {
  emit('select', key)
  open.value = false
}

function handleOutsideClick(event) {
  if (!open.value) return
  const root = rootRef.value
  if (!root) return
  if (root.contains(event.target)) return
  open.value = false
}

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('click', handleOutsideClick)
    } else {
      document.removeEventListener('click', handleOutsideClick)
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div ref="rootRef" class="relative w-full sm:w-auto">
    <button
      type="button"
      class="w-full sm:w-auto cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 inline-flex items-center justify-between gap-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <span class="max-w-[10rem] truncate whitespace-nowrap">Kỳ báo cáo: {{ activeLabel }}</span>
      <svg class="size-3.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-40 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
    >
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        class="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors"
        :class="option.key === activeKey ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'"
        @click="selectPeriod(option.key)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
