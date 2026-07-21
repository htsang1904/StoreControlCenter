<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  pageSizeOptions: { type: Array, default: () => [20, 50, 100] },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  itemLabel: { type: String, default: 'mục' },
})

const emit = defineEmits(['update:page', 'update:page-size'])

const normalizedPageCount = computed(() => Math.max(Number(props.pageCount) || 1, 1))
const visiblePageItems = computed(() => {
  const total = normalizedPageCount.value
  const current = props.page
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('dots-left')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('dots-right')
  items.push(total)
  return items
})

function changePage(page) {
  if (props.loading || page < 1 || page > normalizedPageCount.value || page === props.page) return
  emit('update:page', page)
}

function changePageSize(event) {
  const nextSize = Number(event?.target?.value || props.pageSize)
  if (props.loading || !nextSize || nextSize === props.pageSize) return
  emit('update:page-size', nextSize)
}
</script>

<template>
  <div class="app-pagination-bar">
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <label class="relative shrink-0">
          <span class="sr-only">Số {{ itemLabel }} trên mỗi trang</span>
          <select
            class="h-9 appearance-none rounded-lg border border-[var(--stroke)] bg-white px-3 pr-8 text-sm font-semibold text-[var(--text-primary)] shadow-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/10 disabled:cursor-not-allowed disabled:opacity-60"
            :value="pageSize"
            :disabled="loading"
            @change="changePageSize"
          >
            <option
              v-for="option in pageSizeOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
          <svg class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
        </label>

        <p class="truncate text-sm font-medium text-[var(--text-secondary)]">
          {{ page }}/{{ normalizedPageCount }}
        </p>
      </div>

      <nav class="flex shrink-0 items-center justify-end gap-1" aria-label="Pagination">
        <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30" :disabled="page <= 1 || loading" @click="changePage(page - 1)">
          <span class="sr-only">Trang trước</span>
          <svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
        </button>
        <template v-for="item in visiblePageItems" :key="String(item)">
          <button v-if="typeof item === 'number'" type="button" class="hidden size-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:cursor-default tablet:inline-flex" :class="item === page ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--primary)]'" :disabled="loading || item === page" @click="changePage(item)">{{ item }}</button>
          <span v-else class="hidden size-9 items-center justify-center text-sm text-[var(--text-muted)] tablet:inline-flex">…</span>
        </template>
        <span class="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-white shadow-sm tablet:hidden">{{ page }}</span>
        <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30" :disabled="page >= normalizedPageCount || loading" @click="changePage(page + 1)">
          <span class="sr-only">Trang sau</span>
          <svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
        </button>
      </nav>
    </div>
  </div>
</template>
