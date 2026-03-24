<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHeaderBreadcrumb } from '@/composables/useHeaderBreadcrumb'
import HeaderDateControls from './HeaderDateControls.vue'
import HeaderNotifications from './HeaderNotifications.vue'

const props = defineProps({
  desktopOpen: {
    type: Boolean,
    default: true,
  },
  drawerMode: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['open-sidebar'])

const HEADER_TAB_SUBTITLES = {
  dashboard: 'Theo dõi chỉ số vận hành ticket và chất lượng cửa hàng',
  ticket: 'Quản lý và giải quyết các yêu cầu',
  qc: 'Theo dõi chỉ số QC và trạng thái vận hành',
  tools: 'Công cụ vận hành hệ thống',
}

const route = useRoute()
const router = useRouter()
const { breadcrumbLabel } = useHeaderBreadcrumb()

const headerContext = computed(() => resolveHeaderContext(route))
const activeRootTab = computed(() => headerContext.value.tab)
const showHeaderDateFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))
const showHeaderBreadcrumb = computed(() => headerContext.value.display === 'breadcrumb')

const visibleTitle = computed(() => headerContext.value.title)
const visibleSubtitle = computed(() => HEADER_TAB_SUBTITLES[activeRootTab.value] || '')
const breadcrumbItems = computed(() => resolveBreadcrumbItems(route, headerContext.value, breadcrumbLabel.value))

function resolveHeaderContext(currentRoute) {
  const path = currentRoute.path

  if (path.startsWith('/dashboard')) {
    return { tab: 'dashboard', title: 'Tổng quan Dashboard', display: 'title' }
  }

  if (path === '/ticket/inbox') {
    return { tab: '', title: 'Chế độ inbox', display: 'title' }
  }

  if (/^\/ticket\/\d+\/edit$/.test(path)) {
    return { tab: '', title: 'Chỉnh sửa Ticket', display: 'breadcrumb' }
  }

  if (path.startsWith('/ticket/add-ticket')) {
    return { tab: '', title: 'Tạo Ticket mới', display: 'breadcrumb' }
  }

  if (path.startsWith('/ticket/')) {
    return { tab: '', title: 'Chi tiết Ticket', display: 'breadcrumb' }
  }

  if (path.startsWith('/ticket')) {
    return { tab: 'ticket', title: 'Quản lý Ticket', display: 'title' }
  }

  if (path.startsWith('/QC/store/') && path.endsWith('/create')) {
    return { tab: '', title: 'Tạo phiên QC', display: 'breadcrumb' }
  }

  if (path.startsWith('/QC/store/')) {
    return { tab: '', title: 'Chi tiết QC theo cửa hàng', display: 'breadcrumb' }
  }

  if (path.startsWith('/QC')) {
    return { tab: 'qc', title: 'Quản lý QC Cửa hàng', display: 'title' }
  }

  if (path.startsWith('/tools')) {
    if (path.startsWith('/tools/users')) {
      return { tab: '', title: 'Quản lý nhân viên', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/stores')) {
      return { tab: '', title: 'Quản lý cửa hàng', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/store-sync')) {
      return { tab: '', title: 'Đồng bộ cửa hàng', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/qc-forms/create')) {
      return { tab: '', title: 'Tạo biểu mẫu QC', display: 'breadcrumb' }
    }

    if (/^\/tools\/qc-forms\/\d+\/edit$/.test(path)) {
      return { tab: '', title: 'Chỉnh sửa biểu mẫu QC', display: 'breadcrumb' }
    }

    if (/^\/tools\/qc-forms\/\d+$/.test(path)) {
      return { tab: '', title: 'Chi tiết biểu mẫu QC', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/qc-forms')) {
      return { tab: '', title: 'Quản lý biểu mẫu QC', display: 'breadcrumb' }
    }

    return { tab: 'tools', title: 'Công cụ Admin', display: 'title' }
  }

  return { tab: '', title: 'Store Control', display: 'title' }
}

function resolveBreadcrumbItems(currentRoute, context, currentLabelValue) {
  const path = currentRoute.path
  const currentLabel = String(currentLabelValue || context.title || '').trim()

  if (path.startsWith('/ticket/')) {
    return [
      { label: 'Danh sách Ticket', to: '/ticket' },
      { label: currentLabel || 'Chi tiết Ticket' },
    ]
  }

  if (path.startsWith('/QC/store/')) {
    return [
      { label: 'Quản lý QC', to: '/QC' },
      { label: currentLabel || context.title },
    ]
  }

  if (
    path.startsWith('/tools/users') ||
    path.startsWith('/tools/stores') ||
    path.startsWith('/tools/store-sync') ||
    path.startsWith('/tools/qc-forms')
  ) {
    return [
      { label: 'Công cụ Admin', to: '/tools' },
      { label: currentLabel || context.title },
    ]
  }

  return []
}

function navigateTo(path) {
  if (!path || path === route.path) return
  router.push(path)
}
</script>

<template>
  <header
    class="stitch-shell z-40 border-b border-slate-200 bg-white"
  >
    <div class="px-3 py-3.5 tablet:px-5 tablet:py-4 pc:px-8">
      <div :class="showHeaderDateFilter ? 'flex items-center justify-between gap-3 tablet:gap-4' : 'flex items-center justify-between gap-3'">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <button
            v-if="props.drawerMode"
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Mở sidebar"
            @click="emit('open-sidebar')"
          >
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>

          <div class="min-w-0">
            <div
              v-if="showHeaderBreadcrumb"
              class="flex min-w-0 items-center gap-2 text-sm text-slate-500"
            >
              <span class="h-4 w-px shrink-0 rounded-full bg-slate-300"></span>
              <template v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`">
                <button
                  v-if="item.to"
                  type="button"
                  class="shrink-0 cursor-pointer transition-colors hover:text-slate-700"
                  @click="navigateTo(item.to)"
                >
                  {{ item.label }}
                </button>
                <span v-else class="truncate font-medium text-slate-700" aria-current="page">{{ item.label }}</span>
                <span
                  v-if="index < breadcrumbItems.length - 1"
                  class="material-symbols-outlined shrink-0 text-[16px] text-slate-400"
                >
                  chevron_right
                </span>
              </template>
            </div>
            <template v-else>
              <h1 class="truncate text-base font-semibold text-slate-900 tablet:text-lg">{{ visibleTitle }}</h1>
              <p v-if="visibleSubtitle" class="mt-0.5 line-clamp-1 text-xs text-slate-500">{{ visibleSubtitle }}</p>
            </template>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2 tablet:gap-3">
          <HeaderDateControls v-if="showHeaderDateFilter" />
          <HeaderNotifications />
        </div>
      </div>

    </div>
  </header>
</template>

<style scoped>
.stitch-shell {
  font-family: var(--font-ui);
}
</style>
