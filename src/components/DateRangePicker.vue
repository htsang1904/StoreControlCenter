<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  from: {
    type: String,
    default: '',
  },
  to: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: 'Chọn ngày',
  },
})

const emit = defineEmits(['update:from', 'update:to', 'change'])

const rootRef = ref(null)
const open = ref(false)
const pickerDirection = ref('down')
const pickerId = `range-picker-${Math.random().toString(36).slice(2, 9)}`
const today = toYmd(new Date())

const tempFrom = ref('')
const tempTo = ref('')
const currentMonth = ref(new Date())

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const buttonLabel = computed(() => {
  if (!props.from || !props.to) return props.placeholder
  return `${formatDateLabel(props.from)} - ${formatDateLabel(props.to)}`
})

const monthTitle = computed(() => {
  const month = String(currentMonth.value.getMonth() + 1).padStart(2, '0')
  const year = currentMonth.value.getFullYear()
  return `${month}/${year}`
})

const calendarDays = computed(() => buildMonthDays(currentMonth.value))

function toYmd(date) {
  const safeDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return safeDate.toISOString().slice(0, 10)
}

function parseYmd(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateLabel(value) {
  const date = parseYmd(value)
  if (!date) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}


function buildMonthDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset)
  const days = []

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const ymd = toYmd(date)
    days.push({
      key: ymd,
      ymd,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: ymd === today,
    })
  }

  return days
}

function openPicker(event) {
  if (props.disabled) return
  const rect = event?.currentTarget?.getBoundingClientRect?.()
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
  const spaceAbove = rect ? rect.top : 0
  pickerDirection.value = spaceBelow < 390 && spaceAbove > spaceBelow ? 'up' : 'down'
  tempFrom.value = props.from || ''
  tempTo.value = props.to || ''
  currentMonth.value = parseYmd(props.from || props.to || today) || new Date()
  open.value = true
}

function closePicker() {
  open.value = false
}

function togglePicker(event) {
  if (open.value) {
    closePicker()
    return
  }
  openPicker(event)
}

function prevMonth() {
  const base = new Date(currentMonth.value)
  currentMonth.value = new Date(base.getFullYear(), base.getMonth() - 1, 1)
}

function nextMonth() {
  const base = new Date(currentMonth.value)
  currentMonth.value = new Date(base.getFullYear(), base.getMonth() + 1, 1)
}

function selectDate(value) {
  if (!tempFrom.value || (tempFrom.value && tempTo.value)) {
    tempFrom.value = value
    tempTo.value = ''
    return
  }

  if (value < tempFrom.value) {
    tempTo.value = tempFrom.value
    tempFrom.value = value
    return
  }

  tempTo.value = value
}

function resolveRangeTo() {
  return tempTo.value || tempFrom.value
}

function isInSelectedRange(ymd) {
  if (!tempFrom.value) return false
  const to = resolveRangeTo()
  return ymd >= tempFrom.value && ymd <= to
}

function dayContainerClass(day, index) {
  const classes = ['my-0.5', 'h-8', 'flex', 'items-center', 'justify-center']
  const inRange = isInSelectedRange(day.ymd)

  if (!inRange) return classes.join(' ')

  const prevDay = calendarDays.value[index - 1]
  const nextDay = calendarDays.value[index + 1]
  const prevInRange = !!prevDay && isInSelectedRange(prevDay.ymd)
  const nextInRange = !!nextDay && isInSelectedRange(nextDay.ymd)
  const atRowStart = index % 7 === 0
  const atRowEnd = index % 7 === 6

    classes.push('bg-[var(--primary-softer)]')
  if (atRowStart || !prevInRange) classes.push('rounded-l-full')
  if (atRowEnd || !nextInRange) classes.push('rounded-r-full')

  return classes.join(' ')
}

function dayClass(day) {
  const classes = [
    'size-8',
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'text-xs',
    'border',
    'transition-colors',
  ]

  const isStart = tempFrom.value && day.ymd === tempFrom.value
  const resolvedTo = resolveRangeTo()
  const isEnd = resolvedTo && day.ymd === resolvedTo
  const inRange = tempFrom.value && resolvedTo && day.ymd > tempFrom.value && day.ymd < resolvedTo

  if (!day.isCurrentMonth) {
    classes.push('text-[var(--text-muted)]', 'border-transparent')
  } else if (isStart || isEnd) {
    classes.push('bg-[var(--primary)]', 'border-[var(--primary)]', 'text-white', 'font-semibold')
  } else if (inRange) {
    classes.push('bg-transparent', 'border-transparent', 'text-[var(--text-secondary)]')
  } else if (day.isToday) {
    classes.push('border-[var(--stroke-strong)]', 'text-[var(--text-primary)]', 'hover:border-[var(--primary)]')
  } else {
    classes.push('border-transparent', 'text-[var(--text-secondary)]', 'hover:border-[var(--stroke-strong)]', 'hover:text-[var(--text-primary)]')
  }

  return classes.join(' ')
}

function applyPicker() {
  if (!tempFrom.value) {
    closePicker()
    return
  }

  const from = tempFrom.value
  const to = tempTo.value || tempFrom.value
  emit('update:from', from)
  emit('update:to', to)
  emit('change', { from, to })
  closePicker()
}


function cancelPicker() {
  tempFrom.value = props.from || ''
  tempTo.value = props.to || ''
  closePicker()
}

function handleOutsideClick(event) {
  if (!open.value) return
  const root = rootRef.value
  if (!root) return
  if (root.contains(event.target)) return
  closePicker()
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
  <div ref="rootRef" class="relative w-fit max-w-full">
    <button
      :id="pickerId"
      type="button"
      class="inline-flex h-9 max-w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="disabled"
      @click="togglePicker"
    >
      <span class="max-w-[170px] truncate tablet:max-w-[220px]">{{ buttonLabel }}</span>
      <svg class="size-3.5 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 z-30 w-[18rem] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--stroke)] bg-white p-2.5"
      :class="pickerDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
      :aria-labelledby="pickerId"
    >
      <div class="grid grid-cols-3 items-center gap-1.5 px-1 pb-2">
        <button
          type="button"
          class="size-7 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--primary-softer)]"
          @click="prevMonth"
        >
          <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <p class="text-center text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">{{ monthTitle }}</p>

        <button
          type="button"
          class="justify-self-end size-7 inline-flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--primary-softer)]"
          @click="nextMonth"
        >
          <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-7 pb-1.5">
        <span v-for="week in weekDays" :key="week" class="text-center text-[11px] text-[var(--text-secondary)]">{{ week }}</span>
      </div>

      <div class="grid grid-cols-7 gap-y-0.5">
        <div v-for="(day, index) in calendarDays" :key="day.key" :class="dayContainerClass(day, index)">
          <button
            type="button"
            :class="dayClass(day)"
            @click="selectDate(day.ymd)"
          >
            {{ day.day }}
          </button>
        </div>
      </div>

      <div class="mt-2.5 flex justify-end gap-2 border-t border-[var(--stroke)] pt-2.5">
        <button
          type="button"
          class="rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          @click="cancelPicker"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-strong)]"
          @click="applyPicker"
        >
          Áp dụng
        </button>
      </div>
    </div>
  </div>
</template>
