<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toolCards = computed(() => [
  {
    key: 'store_sync',
    title: 'Đồng bộ cửa hàng',
    description: 'Kích hoạt đồng bộ danh mục cửa hàng từ nguồn chính và theo dõi kết quả chạy gần nhất.',
    action: 'Mở công cụ đồng bộ',
    path: '/tools/store-sync',
    icon: 'sync_alt',
  },
])

const openTool = (path) => {
  if (!path) return
  router.push(path)
}
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section">
      <div class="app-section-header">
        <h3 class="text-base font-semibold text-[var(--text-primary)]">Danh sách công cụ</h3>
      </div>

      <article
        v-for="tool in toolCards"
        :key="tool.key"
        class="group px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] tablet:px-5"
      >
        <div class="app-page-header">
          <div class="min-w-0 flex items-start gap-3">
            <div class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-softer)] text-[var(--text-secondary)]">
              <span class="material-symbols-outlined text-[22px]">{{ tool.icon }}</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-[var(--text-primary)]">{{ tool.title }}</h3>
              <p class="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{{ tool.description }}</p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] tablet:w-auto"
            @click="openTool(tool.path)"
          >
            {{ tool.action }}
            <span class="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
          </button>
        </div>
      </article>
    </section>
  </div>
</template>
