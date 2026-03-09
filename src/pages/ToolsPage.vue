<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const toolCards = computed(() => [
  {
    key: 'qc_forms',
    title: 'Quản lý biểu mẫu QC',
    description: 'Tạo mới, theo dõi và quản trị các biểu mẫu kiểm tra chất lượng dùng cho toàn hệ thống.',
    action: 'Mở quản lý biểu mẫu',
    path: '/tools/qc-forms',
    icon: 'fact_check',
  },
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
  <div class="space-y-5">
    <section class="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div class="max-w-3xl">
        <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Admin Hub</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Chọn công cụ quản trị</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          Mỗi tính năng quản trị có một màn hình riêng để vận hành và theo dõi kết quả. Chọn đúng khu vực bạn cần thao tác để tránh làm việc trên một trang quá tải thông tin.
        </p>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <article
        v-for="tool in toolCards"
        :key="tool.key"
        class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="inline-flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span class="material-symbols-outlined text-[22px]">{{ tool.icon }}</span>
            </div>
            <h3 class="mt-4 text-lg font-semibold text-slate-900">{{ tool.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-slate-500">{{ tool.description }}</p>
          </div>

          <span class="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Admin
          </span>
        </div>

        <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <p class="text-xs text-slate-400">Khu vực quản trị riêng</p>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
