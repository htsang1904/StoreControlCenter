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
  <div class="page-stack space-y-4 p-4 tablet:p-5 pc:p-6">
    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
        <h3 class="text-base font-semibold text-blue-950">Danh sách công cụ</h3>
      </div>

      <article
        v-for="tool in toolCards"
        :key="tool.key"
        class="group px-4 py-4 transition-colors hover:bg-slate-50/70 tablet:px-5"
      >
        <div class="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
          <div class="min-w-0 flex items-start gap-3">
            <div class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <span class="material-symbols-outlined text-[22px]">{{ tool.icon }}</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-blue-950">{{ tool.title }}</h3>
              <p class="mt-1 text-sm leading-6 text-slate-500">{{ tool.description }}</p>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 tablet:w-auto"
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
