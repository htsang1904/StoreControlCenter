<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHeaderBreadcrumb } from '@/composables/useHeaderBreadcrumb'
import { useApp } from '@/plugins/app'
import StoreFilterButton from '@/components/StoreFilterButton.vue'
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
  dashboard: 'Tổng quan hoạt động',
  ticket: 'Quản lý và giải quyết các yêu cầu',
  qc: 'Theo dõi chỉ số QC và trạng thái vận hành',
  tools: 'Công cụ vận hành hệ thống',
}

const route = useRoute()
const router = useRouter()
const { state } = useApp()
const { breadcrumbLabel } = useHeaderBreadcrumb()

const headerContext = computed(() => resolveHeaderContext(route))
const activeRootTab = computed(() => headerContext.value.tab)
const showHeaderDateFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))
const showHeaderBreadcrumb = computed(() => headerContext.value.display === 'breadcrumb')

const visibleTitle = computed(() => headerContext.value.title)
const visibleSubtitle = computed(() => HEADER_TAB_SUBTITLES[activeRootTab.value] || '')
const breadcrumbItems = computed(() => resolveBreadcrumbItems(route, headerContext.value, breadcrumbLabel.value))
const stores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))
const dashboardStoreFilter = ref([])

function resolveHeaderContext(currentRoute) {
  const path = currentRoute.path

  if (path.startsWith('/dashboard')) {
    return { tab: 'dashboard', title: 'Dashboard', display: 'title' }
  }

  if (path === '/ticket/inbox') {
    return { tab: '', title: 'Danh sách Ticket', display: 'breadcrumb' }
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

    if (path.startsWith('/tools/departments')) {
      return { tab: '', title: 'Quản lý bộ phận', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/permissions')) {
      return { tab: '', title: 'Quản lý quyền', display: 'breadcrumb' }
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

  if (path === '/ticket/inbox') {
    return [
      { label: 'Quản lý Ticket', to: '/ticket' },
      { label: currentLabel || context.title },
    ]
  }

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
    path.startsWith('/tools/departments') ||
    path.startsWith('/tools/permissions') ||
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

watch(
  () => [route.path, route.query.store_ids, stores.value.map((store) => store.id).join(',')],
  () => {
    if (!route.path.startsWith('/dashboard')) return

    const queryStoreIds = route.query.store_ids
    if (typeof queryStoreIds === 'string' && queryStoreIds.trim() !== '') {
      const parsed = queryStoreIds.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)
      if (parsed.join(',') !== dashboardStoreFilter.value.join(',')) {
        dashboardStoreFilter.value = parsed
      }
      return
    }

    const allStoreIds = stores.value.map((store) => store.id).filter((id) => Number.isInteger(Number(id)))
    if (allStoreIds.length && allStoreIds.join(',') !== dashboardStoreFilter.value.join(',')) {
      dashboardStoreFilter.value = allStoreIds
    }
  },
  { immediate: true }
)

watch(
  dashboardStoreFilter,
  (newValue) => {
    if (!route.path.startsWith('/dashboard')) return

    const selectedIds = newValue.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    const allSelected = stores.value.length > 0 && selectedIds.length === stores.value.length
    const nextStoreIds = allSelected ? '' : selectedIds.join(',')
    const currentStoreIds = String(route.query.store_ids || '')

    if (currentStoreIds === nextStoreIds) return

    const query = { ...route.query }
    if (nextStoreIds) query.store_ids = nextStoreIds
    else delete query.store_ids
    router.replace({ path: route.path, query })
  },
  { deep: true }
)
</script>

<template>
  <header
    class="stitch-shell z-40 border-b border-[var(--stroke)] bg-white"
  >
    <div class="px-3 py-3.5 tablet:px-5 tablet:py-4 pc:px-8">
      <div :class="showHeaderDateFilter ? 'flex items-center justify-between gap-3 tablet:gap-4' : 'flex items-center justify-between gap-3'">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <button
            v-if="props.drawerMode"
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] hover:text-[var(--text-primary)]"
            aria-label="Mở sidebar"
            @click="emit('open-sidebar')"
          >
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>

          <div class="min-w-0">
            <div
              v-if="showHeaderBreadcrumb"
              class="flex min-w-0 items-center gap-2 text-sm text-[var(--text-secondary)]"
            >
              <span class="h-4 w-px shrink-0 rounded-full bg-[var(--stroke-strong)]"></span>
              <template v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`">
                <button
                  v-if="item.to"
                  type="button"
                  class="shrink-0 cursor-pointer transition-colors hover:text-[var(--text-secondary)]"
                  @click="navigateTo(item.to)"
                >
                  {{ item.label }}
                </button>
                <span v-else class="truncate font-medium text-[var(--text-secondary)]" aria-current="page">{{ item.label }}</span>
                <span
                  v-if="index < breadcrumbItems.length - 1"
                  class="material-symbols-outlined shrink-0 text-[16px] text-[var(--text-muted)]"
                >
                  chevron_right
                </span>
              </template>
            </div>
            <template v-else>
              <h1 class="truncate text-base font-semibold text-[var(--text-primary)] tablet:text-lg">{{ visibleTitle }}</h1>
              <p v-if="visibleSubtitle" class="mt-0.5 line-clamp-1 text-xs text-[var(--text-secondary)]">{{ visibleSubtitle }}</p>
            </template>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2">
          <StoreFilterButton v-if="activeRootTab === 'dashboard'" v-model="dashboardStoreFilter" />
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
