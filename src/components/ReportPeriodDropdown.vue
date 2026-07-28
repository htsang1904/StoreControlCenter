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
const dropdownDirection = ref('down')

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

function toggleDropdown(event) {
  if (props.disabled) return
  if (!open.value) {
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
    const spaceAbove = rect ? rect.top : 0
    dropdownDirection.value = spaceBelow < 190 && spaceAbove > spaceBelow ? 'up' : 'down'
  }
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
  <div ref="rootRef" class="relative w-full tablet:w-auto">
    <button
      type="button"
      class="app-button-secondary inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold tablet:w-auto disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <span class="max-w-[10rem] truncate whitespace-nowrap">Kỳ báo cáo: {{ activeLabel }}</span>
      <svg class="size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="app-menu-panel absolute right-0 z-30 w-40 p-1.5"
      :class="dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
    >
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        class="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors"
        :class="option.key === activeKey ? 'bg-[var(--primary-softer)] text-[var(--primary-strong)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'"
        @click="selectPeriod(option.key)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
