<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HeaderDateControls from './HeaderDateControls.vue'
import HeaderNotifications from './HeaderNotifications.vue'

const props = defineProps({
  desktopOpen: {
    type: Boolean,
    default: true,
  },
})

const HEADER_TAB_SUBTITLES = {
  dashboard: 'Theo dõi chỉ số vận hành ticket và chất lượng cửa hàng',
  ticket: 'Quản lý và giải quyết các yêu cầu',
  qc: 'Theo dõi chỉ số QC và trạng thái vận hành',
  tools: 'Công cụ vận hành hệ thống',
}

const route = useRoute()

const headerContext = computed(() => resolveHeaderContext(route.path))
const activeRootTab = computed(() => headerContext.value.tab)
const showHeaderDateFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))

const visibleTitle = computed(() => headerContext.value.title)
const visibleSubtitle = computed(() => HEADER_TAB_SUBTITLES[activeRootTab.value] || '')

function resolveHeaderContext(path) {
  if (path.startsWith('/dashboard')) {
    return { tab: 'dashboard', title: 'Tổng quan Dashboard' }
  }

  if (/^\/ticket\/\d+\/edit$/.test(path)) {
    return { tab: '', title: 'Chỉnh sửa Ticket' }
  }

  if (path.startsWith('/ticket/add-ticket')) {
    return { tab: '', title: 'Tạo Ticket mới' }
  }

  if (path.startsWith('/ticket/')) {
    return { tab: '', title: 'Chi tiết Ticket' }
  }

  if (path.startsWith('/ticket')) {
    return { tab: 'ticket', title: 'Quản lý Ticket' }
  }

  if (path.startsWith('/QC/store/') && path.endsWith('/create')) {
    return { tab: '', title: 'Tạo phiên QC' }
  }

  if (path.startsWith('/QC/store/')) {
    return { tab: '', title: 'Chi tiết QC theo cửa hàng' }
  }

  if (path.startsWith('/QC')) {
    return { tab: 'qc', title: 'Quản lý QC Cửa hàng' }
  }

  if (path.startsWith('/tools')) {
    return { tab: 'tools', title: 'Công cụ Admin' }
  }

  return { tab: '', title: 'Store Control' }
}
</script>

<template>
  <header
    class="stitch-shell fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white transition-[left] duration-300 ease-in-out"
    :class="props.desktopOpen ? 'md:left-64' : 'md:left-20'"
  >
    <div class="px-3 py-3 sm:px-5 md:px-8">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <button
            type="button"
            class="mt-0.5 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            aria-haspopup="dialog"
            aria-expanded="true"
            aria-controls="hs-pro-sidebar"
            aria-label="Open sidebar"
            data-hs-overlay="#hs-pro-sidebar"
          >
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>

          <div class="min-w-0">
            <h1 class="truncate text-base font-semibold text-slate-900 sm:text-lg">{{ visibleTitle }}</h1>
            <p v-if="visibleSubtitle" class="mt-0.5 line-clamp-1 text-xs text-slate-500">{{ visibleSubtitle }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <HeaderDateControls v-if="showHeaderDateFilter" />
          <HeaderNotifications />
        </div>
      </div>

    </div>
  </header>
</template>

<style scoped>
.stitch-shell {
  font-family: 'Inter', sans-serif;
}
</style>
