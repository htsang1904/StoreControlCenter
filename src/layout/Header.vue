<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/plugins/toast'
import { useApp } from '@/plugins/app'
import DateRangePicker from '@/components/DateRangePicker.vue'
import { useTicketHeaderBridge } from '@/composables/ticket_header_bridge'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notification_service'
const props = defineProps({
  desktopOpen: {
    type: Boolean,
    default: true,
  },
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { state } = useApp()
const ticketHeader = useTicketHeaderBridge()
const notificationPanelRef = ref(null)
const notificationOpen = ref(false)
const notificationLoading = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const markingAllRead = ref(false)
const headerDateFrom = ref('')
const headerDateTo = ref('')
let pollingTimer = null

const isDashboard = computed(() => route.path.startsWith('/dashboard'))
const isTicketListPage = computed(() => /^\/ticket\/?$/.test(route.path))
const isQcManagementPage = computed(() => /^\/QC\/?$/.test(route.path))
const activeRootTab = computed(() => {
  if (isDashboard.value) return 'dashboard'
  if (isTicketListPage.value) return 'ticket'
  if (isQcManagementPage.value) return 'qc'
  if (/^\/tools\/?$/.test(route.path)) return 'tools'
  return ''
})
const showHeaderDateFilter = computed(() => ['dashboard', 'ticket', 'qc'].includes(activeRootTab.value))

const headerSubtitles = {
  dashboard: 'Theo dõi chỉ số vận hành ticket và chất lượng cửa hàng',
  ticket: 'Quản lý và giải quyết các yêu cầu',
  qc: 'Theo dõi chỉ số QC và trạng thái vận hành',
  tools: 'Công cụ vận hành hệ thống',
}

const pageTitle = computed(() => {
  if (route.path.startsWith('/dashboard')) return 'Tổng quan Dashboard'
  if (/^\/ticket\/\d+\/edit$/.test(route.path)) return 'Chỉnh sửa Ticket'
  if (route.path.startsWith('/ticket/add-ticket')) return 'Tạo Ticket mới'
  if (route.path.startsWith('/ticket/')) return 'Chi tiết Ticket'
  if (route.path.startsWith('/ticket')) return 'Quản lý Ticket'
  if (route.path.startsWith('/QC/store/') && route.path.endsWith('/create')) return 'Tạo phiên QC'
  if (route.path.startsWith('/QC/store/')) return 'Chi tiết QC theo cửa hàng'
  if (route.path.startsWith('/QC')) return 'Quản lý QC'
  if (route.path.startsWith('/tools')) return 'Công cụ Admin'
  return 'Store Control'
})

const visibleTitle = computed(() => {
  if (isTicketListPage.value && ticketHeader.enabled) return ticketHeader.title
  if (isQcManagementPage.value) return 'Quản lý Chất lượng Cửa hàng'
  return pageTitle.value
})

const visibleSubtitle = computed(() => {
  if (isTicketListPage.value && ticketHeader.enabled) return ticketHeader.subtitle
  const tab = activeRootTab.value
  if (tab && headerSubtitles[tab]) return headerSubtitles[tab]
  return ''
})

function toIsoDate(date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return normalized.toISOString().slice(0, 10)
}

function shiftDays(days) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return base
}

function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

function getDefaultRange() {
  return {
    from: toIsoDate(shiftDays(-6)),
    to: toIsoDate(new Date()),
  }
}

function normalizeHeaderRange(query) {
  const fallback = getDefaultRange()
  const from = isValidYmd(query?.date_from) ? String(query.date_from) : fallback.from
  const to = isValidYmd(query?.date_to) ? String(query.date_to) : fallback.to

  if (from > to) return fallback
  return { from, to }
}

function syncHeaderRangeFromRoute() {
  if (!showHeaderDateFilter.value) {
    headerDateFrom.value = ''
    headerDateTo.value = ''
    return
  }
  const range = normalizeHeaderRange(route.query || {})
  headerDateFrom.value = range.from
  headerDateTo.value = range.to
}

async function updateHeaderRange(from, to) {
  if (!showHeaderDateFilter.value) return
  if (!isValidYmd(from) || !isValidYmd(to) || from > to) return
  if (String(route.query?.date_from || '') === from && String(route.query?.date_to || '') === to) return

  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      date_from: from,
      date_to: to,
    },
  })
}

const todayRange = computed(() => {
  const now = new Date()
  const day = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  return { from: day, to: day }
})

const last7Range = computed(() => ({
  from: toIsoDate(shiftDays(-6)),
  to: toIsoDate(new Date()),
}))

const thisMonthRange = computed(() => {
  const now = new Date()
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
  }
})

function isActiveRange(range) {
  return headerDateFrom.value === range.from && headerDateTo.value === range.to
}

function applyQuickRange(range) {
  headerDateFrom.value = range.from
  headerDateTo.value = range.to
  updateHeaderRange(range.from, range.to)
}

function handleDateRangeChange(payload) {
  const from = String(payload?.from || '')
  const to = String(payload?.to || '')
  updateHeaderRange(from, to)
}

const formatNotificationTime = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const fetchNotifications = async ({ silent = false } = {}) => {
  if (!state?.token) return
  if (notificationLoading.value && silent) return

  notificationLoading.value = true

  try {
    const result = await listNotifications({
      page: 1,
      pageSize: 12,
    })
    const payload = result?.data || {}
    notifications.value = Array.isArray(payload.notifications) ? payload.notifications : []
    unreadCount.value = Number(payload.unread_count || 0)
  } catch (error) {
    if (!silent) {
      const message = error?.response?.data?.message || error?.message || 'Không thể tải thông báo'
      toast.error(message)
    }
  } finally {
    notificationLoading.value = false
  }
}

const handleToggleNotification = async () => {
  notificationOpen.value = !notificationOpen.value
  if (notificationOpen.value) {
    await fetchNotifications({ silent: true })
  }
}

const handleClickOutside = (event) => {
  if (!notificationOpen.value) return
  const root = notificationPanelRef.value
  if (!root) return
  if (root.contains(event.target)) return
  notificationOpen.value = false
}

const handleOpenNotification = async (notification) => {
  const notificationId = Number(notification?.id || 0)
  if (notificationId <= 0) return

  try {
    const result = await markNotificationRead(notificationId)
    const unread = Number(result?.data?.unread_count)
    if (Number.isInteger(unread) && unread >= 0) {
      unreadCount.value = unread
    } else {
      unreadCount.value = Math.max(unreadCount.value - 1, 0)
    }

    notifications.value = notifications.value.map((item) => (
      Number(item?.id) === notificationId
        ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
        : item
    ))
  } catch (_error) {}

  notificationOpen.value = false
  const ticketId = Number(notification?.ticket?.id || notification?.meta?.ticket_id || 0)
  if (ticketId > 0) {
    await router.push(`/ticket/${ticketId}`)
  }
}

const handleMarkAllRead = async () => {
  if (markingAllRead.value) return
  markingAllRead.value = true

  try {
    await markAllNotificationsRead()
    unreadCount.value = 0
    notifications.value = notifications.value.map((item) => ({
      ...item,
      is_read: true,
      read_at: item.read_at || new Date().toISOString(),
    }))
    toast.success('Đã đánh dấu tất cả thông báo là đã đọc')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật thông báo'
    toast.error(message)
  } finally {
    markingAllRead.value = false
  }
}

watch(
  () => [route.path, route.query.date_from, route.query.date_to],
  () => {
    syncHeaderRangeFromRoute()
  },
  { immediate: true }
)

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  if (state?.token) {
    await fetchNotifications({ silent: true })
    pollingTimer = window.setInterval(() => {
      fetchNotifications({ silent: true })
    }, 30000)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
})
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
        <template v-if="showHeaderDateFilter">
          <div class="hidden items-center rounded-lg bg-slate-100 p-1 sm:inline-flex">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="isActiveRange(todayRange) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
              @click="applyQuickRange(todayRange)"
            >
              Hôm nay
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="isActiveRange(last7Range) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
              @click="applyQuickRange(last7Range)"
            >
              7 ngày qua
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="isActiveRange(thisMonthRange) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
              @click="applyQuickRange(thisMonthRange)"
            >
              Tháng này
            </button>
          </div>

          <div class="hidden md:block">
            <DateRangePicker
              v-model:from="headerDateFrom"
              v-model:to="headerDateTo"
              @change="handleDateRangeChange"
            />
          </div>

          <div class="hidden h-6 w-px bg-slate-200 md:block"></div>
        </template>

        <div ref="notificationPanelRef" class="relative">
          <button
            type="button"
            class="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="Thông báo"
            @click="handleToggleNotification"
          >
            <span v-if="unreadCount > 0" class="absolute right-1.5 top-1.5 inline-flex size-2.5 rounded-full border border-white bg-rose-500"></span>
            <span class="material-symbols-outlined text-[20px]">notifications</span>
          </button>

          <div
            v-if="notificationOpen"
            class="absolute right-0 top-full mt-2 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p class="text-sm font-semibold text-slate-800">Thông báo</p>
              <button
                type="button"
                class="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="markingAllRead || unreadCount === 0"
                @click="handleMarkAllRead"
              >
                {{ markingAllRead ? 'Đang cập nhật...' : 'Đánh dấu đã đọc' }}
              </button>
            </div>

            <div class="max-h-96 overflow-y-auto p-1.5">
              <p v-if="notificationLoading" class="px-2 py-3 text-xs text-slate-500">Đang tải thông báo...</p>
              <p v-else-if="!notifications.length" class="px-2 py-3 text-xs text-slate-500">Hiện chưa có thông báo nào.</p>
              <button
                v-for="item in notifications"
                :key="item.id"
                type="button"
                class="mb-1 w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                :class="item.is_read ? 'border-transparent' : 'border-blue-100 bg-blue-50/60'"
                @click="handleOpenNotification(item)"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-semibold text-slate-800">{{ item.title || 'Thông báo' }}</p>
                  <span v-if="!item.is_read" class="mt-1 inline-flex size-2 rounded-full bg-blue-500"></span>
                </div>
                <p class="mt-1 line-clamp-2 text-xs text-slate-600">{{ item.message }}</p>
                <p class="mt-1 text-[11px] text-slate-400">{{ formatNotificationTime(item.createdAt) }}</p>
              </button>
            </div>
          </div>
        </div>

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
