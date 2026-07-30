<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHeaderBreadcrumb } from '@/composables/useHeaderBreadcrumb'
import { useStoresStore } from '@/stores/stores'
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
const storesStore = useStoresStore()
const { breadcrumbLabel } = useHeaderBreadcrumb()

const headerContext = computed(() => resolveHeaderContext(route))
const activeRootTab = computed(() => headerContext.value.tab)
const showHeaderDateFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))
const showHeaderBreadcrumb = computed(() => headerContext.value.display === 'breadcrumb')

const visibleTitle = computed(() => headerContext.value.title)
const visibleSubtitle = computed(() => HEADER_TAB_SUBTITLES[activeRootTab.value] || '')
const breadcrumbItems = computed(() => resolveBreadcrumbItems(route, headerContext.value, breadcrumbLabel.value))
const stores = computed(() => storesStore.availableStores)
const sharedStoreFilter = computed({
  get: () => storesStore.effectiveSelectedStoreIds,
  set: (value) => storesStore.setSelectedStoreIds(value),
})
const showStoreFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))

const isQcSessionView = computed(() => route.path.startsWith('/QC/store/') && route.path.includes('/session/'))
const qcSessionViewTab = computed(() => (String(route.query.view || 'qc') === 'findings' ? 'findings' : 'qc'))
const qcSessionFindingCount = computed(() => {
  const count = Number(route.query.findingCount || 0)
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
})

function setQcSessionViewTab(tab) {
  const nextView = tab === 'findings' ? 'findings' : 'qc'
  if (qcSessionViewTab.value === nextView) return
  router.replace({ query: { ...route.query, view: nextView } })
}

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

  if (path.startsWith('/QC/store/') && path.includes('/session/')) {
    return { tab: '', title: 'Chi tiết QC', display: 'breadcrumb' }
  }

  if (path.startsWith('/QC/findings')) {
    return { tab: 'qc', title: 'Quản lý QC Cửa hàng', display: 'title' }
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

    if (/^\/tools\/qc-forms\/\d+\/versions\/\d+\/edit$/.test(path)) {
      return { tab: '', title: 'Chỉnh sửa version QC', display: 'breadcrumb' }
    }

    if (/^\/tools\/qc-forms\/\d+$/.test(path)) {
      return { tab: '', title: 'Chi tiết biểu mẫu QC', display: 'breadcrumb' }
    }

    if (path.startsWith('/tools/qc-forms')) {
      return { tab: '', title: 'Quản lý biểu mẫu QC', display: 'breadcrumb' }
    }

    return { tab: 'tools', title: 'Công cụ Admin', display: 'title' }
  }

  return { tab: '', title: 'Store OPS', display: 'title' }
}

function resolveQcStoreBreadcrumbLabel(currentRoute) {
  const storeId = Number(currentRoute.params.storeId || 0)
  const matchedStore = stores.value.find((store) => Number(store?.id || 0) === storeId)

  if (matchedStore) {
    return matchedStore.shortAddress || matchedStore.address || matchedStore.code || `Cửa hàng #${matchedStore.id}`
  }

  return storeId ? `Cửa hàng #${storeId}` : 'Cửa hàng'
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

  if (path.startsWith('/QC/store/') && path.endsWith('/create')) {
    const storeLabel = resolveQcStoreBreadcrumbLabel(currentRoute)
    const storePath = `/QC/store/${currentRoute.params.storeId}`

    return [
      { label: 'Quản lý QC', to: '/QC' },
      { label: storeLabel, to: storePath },
      { label: currentLabel || context.title },
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
  () => route.path,
  () => {
    if (
      route.path.startsWith('/dashboard') ||
      route.path.startsWith('/QC') ||
      route.path.startsWith('/ticket')
    ) {
      storesStore.loadAdminStores().catch((error) => console.warn('Failed to load admin header stores:', error))
    }
  },
  { immediate: true }
)

watch(
  () => [route.path, showStoreFilter.value, route.query.store_ids, stores.value.map((store) => store.id).join(',')],
  () => {
    if (!showStoreFilter.value) return

    const queryStoreIds = route.query.store_ids
    if (typeof queryStoreIds === 'string' && queryStoreIds.trim() !== '') {
      const parsed = queryStoreIds.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0)
      if (parsed.join(',') !== storesStore.selectedStoreIds.join(',')) {
        storesStore.setSelectedStoreIds(parsed)
      }
      return
    }

  },
  { immediate: true }
)

watch(
  () => [route.path, showStoreFilter.value, storesStore.selectedStoreIds.join(','), stores.value.map((store) => store.id).join(',')],
  () => {
    if (!showStoreFilter.value) return

    const selectedIds = storesStore.selectedStoreIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
    const availableIds = stores.value
      .map((store) => Number(store?.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0)
    const allSelected = availableIds.length > 0 && selectedIds.length === availableIds.length
    const nextStoreIds = selectedIds.length > 0 && !allSelected ? selectedIds.join(',') : ''
    const currentStoreIds = String(route.query.store_ids || '')

    if (currentStoreIds === nextStoreIds) return

    const query = { ...route.query }
    if (nextStoreIds) query.store_ids = nextStoreIds
    else delete query.store_ids
    if (route.query.page) delete query.page
    router.replace({ path: route.path, query })
  }
)
</script>

<template>
  <header
    class="stitch-shell z-40 border-b border-[var(--stroke)] bg-white"
  >
    <div class="px-3 py-3.5 tablet:px-5 tablet:py-4 pc:px-8">
      <div :class="isQcSessionView ? 'flex items-center justify-between gap-3 pc:grid pc:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : showHeaderDateFilter ? 'flex items-center justify-between gap-3 tablet:gap-4' : 'flex items-center justify-between gap-3'">
        <div class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <button
            v-if="props.drawerMode"
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-softer)] hover:text-[var(--text-primary)]"
            aria-label="Mở sidebar"
            @click="emit('open-sidebar')"
          >
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>

          <div class="min-w-0 flex-1 overflow-hidden">
            <div
              v-if="showHeaderBreadcrumb"
              class="flex min-w-0 max-w-full items-center gap-2 overflow-hidden text-sm text-[var(--text-secondary)]"
            >
              <span class="h-4 w-px shrink-0 rounded-full bg-[var(--stroke-strong)]"></span>
              <template v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`">
                <button
                  v-if="item.to"
                  type="button"
                  class="min-w-0 shrink truncate cursor-pointer transition-colors hover:text-[var(--text-secondary)]"
                  @click="navigateTo(item.to)"
                >
                  {{ item.label }}
                </button>
                <span v-else class="min-w-0 flex-1 truncate font-medium text-[var(--text-secondary)]" aria-current="page">{{ item.label }}</span>
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

        <div v-if="isQcSessionView" class="hidden justify-self-center pc:block">
          <div class="inline-flex rounded-lg border border-[var(--stroke)] bg-white p-1 shadow-sm" role="tablist" aria-label="Nội dung phiên QC">
            <button
              type="button"
              class="inline-flex h-9 min-w-[132px] items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors"
              :class="qcSessionViewTab === 'qc' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'"
              @click="setQcSessionViewTab('qc')"
            >
              <span class="material-symbols-outlined text-[18px]">assignment</span>
              Biên bản QC
            </button>
            <button
              type="button"
              class="inline-flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors"
              :class="qcSessionViewTab === 'findings' ? 'bg-[var(--danger-text)] text-white shadow-sm' : 'text-[var(--danger-text)] hover:bg-[var(--danger-bg)]'"
              @click="setQcSessionViewTab('findings')"
            >
              <span class="material-symbols-outlined text-[18px]">report_problem</span>
              Khắc phục lỗi
              <span
                v-if="qcSessionFindingCount > 0"
                class="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                :class="qcSessionViewTab === 'findings' ? 'bg-white text-[var(--danger-text)]' : 'bg-[var(--danger-bg)] text-[var(--danger-text)]'"
              >
                {{ qcSessionFindingCount }}
              </span>
            </button>
          </div>
        </div>

        <div class="relative z-10 flex shrink-0 items-center justify-end gap-2 bg-white">
          <StoreFilterButton v-if="showStoreFilter" v-model="sharedStoreFilter" :stores="stores" />
          <HeaderDateControls v-if="showHeaderDateFilter" />
          <HeaderNotifications />
        </div>
      </div>
      <div v-if="isQcSessionView" class="mt-3 pc:hidden">
        <div class="inline-flex w-full rounded-lg border border-[var(--stroke)] bg-white p-1 shadow-sm" role="tablist" aria-label="Nội dung phiên QC">
          <button type="button" class="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors" :class="qcSessionViewTab === 'qc' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'" @click="setQcSessionViewTab('qc')">
            <span class="material-symbols-outlined text-[18px]">assignment</span>
            Biên bản QC
          </button>
          <button type="button" class="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition-colors" :class="qcSessionViewTab === 'findings' ? 'bg-[var(--danger-text)] text-white shadow-sm' : 'text-[var(--danger-text)] hover:bg-[var(--danger-bg)]'" @click="setQcSessionViewTab('findings')">
            <span class="material-symbols-outlined text-[18px]">report_problem</span>
            Khắc phục
            <span v-if="qcSessionFindingCount > 0" class="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold" :class="qcSessionViewTab === 'findings' ? 'bg-white text-[var(--danger-text)]' : 'bg-[var(--danger-bg)] text-[var(--danger-text)]'">{{ qcSessionFindingCount }}</span>
          </button>
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
