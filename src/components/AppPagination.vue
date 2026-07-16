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
</script>

<template>
  <div class="app-pagination-bar">
    <div class="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
      <div class="flex flex-col items-center gap-3 tablet:flex-row tablet:justify-start tablet:gap-5">
        <div class="flex items-center gap-1" :aria-label="`Số ${itemLabel} trên mỗi trang`">
          <button
            v-for="option in pageSizeOptions"
            :key="option"
            type="button"
            class="inline-flex h-9 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
            :class="option === pageSize ? 'border border-[var(--stroke)] bg-white text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--primary)]'"
            :disabled="loading || option === pageSize"
            @click="emit('update:page-size', option)"
          >
            {{ option }}
          </button>
        </div>
        <p class="text-center text-sm text-[var(--text-muted)] tablet:text-left">
          Trang <span class="font-medium text-[var(--text-secondary)]">{{ page }}</span>
          của <span class="font-medium text-[var(--text-secondary)]">{{ normalizedPageCount }}</span>
          <span class="whitespace-nowrap">({{ total }} {{ itemLabel }})</span>
        </p>
      </div>

      <nav class="flex items-center justify-center gap-1 tablet:justify-end" aria-label="Pagination">
        <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30" :disabled="page <= 1 || loading" @click="changePage(page - 1)">
          <span class="sr-only">Trang trước</span>
          <svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
        </button>
        <template v-for="item in visiblePageItems" :key="String(item)">
          <button v-if="typeof item === 'number'" type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:cursor-default" :class="item === page ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--primary)]'" :disabled="loading || item === page" @click="changePage(item)">{{ item }}</button>
          <span v-else class="inline-flex size-9 items-center justify-center text-sm text-[var(--text-muted)]">…</span>
        </template>
        <button type="button" class="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30" :disabled="page >= normalizedPageCount || loading" @click="changePage(page + 1)">
          <span class="sr-only">Trang sau</span>
          <svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
        </button>
      </nav>
    </div>
  </div>
</template>
