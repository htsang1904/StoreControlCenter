<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/plugins/toast'
import {
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotificationItem,
  normalizeNotificationList,
  getNotificationDisplayTitle,
} from '@/services/notification_service'
import {
  disableOneSignalPush,
  enableOneSignalPush,
  initializeOneSignal,
  pushState,
} from '@/services/onesignal_service'

const PAGE_SIZE = 20

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const markingAllRead = ref(false)
const updatingPush = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const pagination = reactive({
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  pageCount: 1,
})

const canGoPrevious = computed(() => pagination.page > 1 && !loading.value)
const canGoNext = computed(() => pagination.page < pagination.pageCount && !loading.value)
const pushEnabled = computed(() => (
  pushState.permission === 'granted' &&
  pushState.optedIn &&
  Boolean(pushState.subscriptionId) &&
  Boolean(pushState.subscriptionToken)
))
const pushBlocked = computed(() => pushState.permission === 'denied')
const pushStatusText = computed(() => {
  if (pushBlocked.value) return 'Đang bị trình duyệt chặn'
  return pushEnabled.value ? 'Đang bật trên thiết bị này' : 'Đang tắt trên thiết bị này'
})

const fetchNotifications = async (page = pagination.page) => {
  loading.value = true
  try {
    const result = await listNotifications({ page, pageSize: PAGE_SIZE })
    notifications.value = normalizeNotificationList(result?.data)
    unreadCount.value = Number(result?.unread_count || 0)
    pagination.page = Number(result?.pagination?.page || page)
    pagination.pageSize = Number(result?.pagination?.pageSize || PAGE_SIZE)
    pagination.total = Number(result?.pagination?.total || notifications.value.length)
    pagination.pageCount = Number(result?.pagination?.pageCount || 1)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể tải thông báo'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

const markLocalRead = (notificationId) => {
  notifications.value = notifications.value.map((item) => (
    Number(item?.id) === notificationId
      ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
      : item
  ))
}

const openNotification = async (notification) => {
  const item = normalizeNotificationItem(notification)
  const notificationId = Number(item?.id || 0)
  if (notificationId > 0 && !item.is_read) {
    try {
      const result = await markNotificationRead(notificationId)
      unreadCount.value = Number(result?.unread_count ?? Math.max(unreadCount.value - 1, 0))
      markLocalRead(notificationId)
    } catch (_error) {}
  }

  const ticketId = Number(item?.ticket_id || item?.ticket?.id || item?.meta?.ticket_id || 0)
  if (ticketId > 0) {
    await router.push({ path: '/ticket/inbox', query: { ticket: String(ticketId) } })
  }
}

const handleMarkAllRead = async () => {
  if (markingAllRead.value || unreadCount.value === 0) return
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

const changePage = (page) => {
  if (page < 1 || page > pagination.pageCount || page === pagination.page) return
  void fetchNotifications(page)
}

const togglePushNotifications = async () => {
  if (updatingPush.value || (pushBlocked.value && !pushEnabled.value)) return
  updatingPush.value = true

  try {
    if (pushEnabled.value) {
      await disableOneSignalPush()
      toast.success('Đã tắt thông báo trên thiết bị này')
    } else {
      await enableOneSignalPush()
      toast.success('Đã bật thông báo trên thiết bị này')
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật cài đặt thông báo'
    toast.error(message)
  } finally {
    updatingPush.value = false
  }
}

onMounted(() => {
  void initializeOneSignal()
  void fetchNotifications(1)
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section">
      <div class="app-section-header space-y-4">
        <div class="app-page-header">
          <div class="app-page-heading">
            <h3 class="app-page-title">Thông báo</h3>
            <p class="app-page-subtitle">Theo dõi ticket mới và các phản hồi cần xử lý.</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center rounded-full bg-[var(--primary-softer)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">
              {{ unreadCount }} chưa đọc
            </span>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="markingAllRead || unreadCount === 0"
              @click="handleMarkAllRead"
            >
              <span class="material-symbols-outlined text-[18px]">done_all</span>
              {{ markingAllRead ? 'Đang cập nhật...' : 'Đánh dấu đã đọc' }}
            </button>
          </div>
        </div>
      </div>

      <div class="mx-4 my-5 flex flex-col gap-3 rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4 tablet:mx-6 tablet:flex-row tablet:items-center tablet:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <span class="material-symbols-outlined mt-0.5 text-[22px] text-[var(--primary)]">notifications_active</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-[var(--text-primary)]">Thông báo đẩy</p>
            <p class="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{{ pushStatusText }}</p>
            <p v-if="pushBlocked" class="mt-1 text-xs leading-5 text-[var(--danger-text)]">Mở Site settings và cho phép quyền Thông báo để bật lại.</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          :aria-checked="pushEnabled"
          :aria-label="pushEnabled ? 'Tắt thông báo đẩy' : 'Bật thông báo đẩy'"
          class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          :class="pushEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--stroke-strong)]'"
          :disabled="updatingPush || (pushBlocked && !pushEnabled)"
          @click="togglePushNotifications"
        >
          <span
            class="pointer-events-none absolute top-1 inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform"
            :class="pushEnabled ? 'translate-x-6' : 'translate-x-1'"
          >
            <span v-if="updatingPush" class="size-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent"></span>
          </span>
        </button>
      </div>

      <div v-if="loading" class="app-state-inline p-6">Đang tải thông báo...</div>

      <div v-else-if="!notifications.length" class="px-4 py-12">
        <div class="app-state-panel app-state-panel--compact">
          <div class="app-state-stack mx-auto">
            <div class="app-state-icon mx-auto">
              <span class="material-symbols-outlined text-[24px]">notifications_off</span>
            </div>
            <p class="app-state-title">Hiện chưa có thông báo nào.</p>
            <p class="app-state-body">Các cập nhật ticket mới sẽ xuất hiện tại đây.</p>
          </div>
        </div>
      </div>

      <div v-else class="divide-y divide-[var(--stroke)]">
        <button
          v-for="item in notifications"
          :key="item.id"
          type="button"
          class="grid w-full grid-cols-[auto,1fr] gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)] tablet:grid-cols-[auto,1fr,150px] tablet:items-center"
          :class="item.is_read ? 'bg-white' : 'bg-[var(--primary-softer)]/40'"
          @click="openNotification(item)"
        >
          <span class="mt-1.5 inline-flex size-2 shrink-0 rounded-full tablet:mt-0" :class="item.is_read ? 'bg-[var(--stroke)]' : 'bg-[var(--primary)]'"></span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">{{ getNotificationDisplayTitle(item) }}</p>
            <p class="line-clamp-1 text-xs leading-5 text-[var(--text-secondary)]">{{ item.message }}</p>
          </div>
          <p class="col-start-2 text-[11px] leading-5 text-[var(--text-muted)] tablet:col-start-auto tablet:text-right">{{ formatNotificationTime(item.createdAt) }}</p>
        </button>
      </div>

      <div class="app-pagination-bar app-page-header tablet:items-center">
        <p class="text-sm text-[var(--text-secondary)]">
          Hiển thị trang
          <span class="font-semibold text-[var(--text-primary)]">{{ pagination.page }}</span>
          /
          <span class="font-semibold text-[var(--text-primary)]">{{ pagination.pageCount }}</span>
        </p>

        <div class="flex max-w-full items-center justify-between gap-2 tablet:justify-end">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-soft)] disabled:opacity-50"
            :disabled="!canGoPrevious"
            @click="changePage(pagination.page - 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <span class="rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-white">{{ pagination.page }}</span>

          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-soft)] disabled:opacity-50"
            :disabled="!canGoNext"
            @click="changePage(pagination.page + 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
