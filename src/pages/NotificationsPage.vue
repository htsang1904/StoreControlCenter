<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/plugins/toast'
import { useApp } from '@/plugins/app'
import {
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotificationItem,
  normalizeNotificationList,
  getNotificationDisplayTitle,
  getNotificationSubscriptionDebug,
  getNotificationSubscriptionStatus,
  sendNotificationTestPush,
  unregisterCurrentNotificationSubscriptions,
} from '@/services/notification_service'
import {
  bindOneSignalUser,
  getBrowserOneSignalSubscriptionId,
  getOneSignalAppId,
  pushState,
  refreshPushBrowserState,
  setOneSignalPushOptOut,
} from '@/services/onesignal_service'

const PAGE_SIZE = 20

const router = useRouter()
const toast = useToast()
const { state } = useApp()

const loading = ref(false)
const markingAllRead = ref(false)
const enablingPush = ref(false)
const disablingPush = ref(false)
const testingPush = ref(false)
const subscribedInBackend = ref(false)
const browserSubscriptionId = ref(null)
const debugStatus = ref(null)
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
const pushEnabled = computed(() => subscribedInBackend.value)
const pushBlocked = computed(() => pushState.permission === 'denied')
const frontendAppId = computed(() => getOneSignalAppId() || 'Chưa cấu hình')
const pushStatusLabel = computed(() => {
  if (!pushState.configured) return 'Chưa cấu hình OneSignal'
  if (!pushState.supported) return 'Trình duyệt không hỗ trợ'
  if (pushEnabled.value) return 'Đã bật thông báo trên máy tính'
  if (pushBlocked.value) return 'Trình duyệt đang chặn thông báo'
  return 'Chưa bật thông báo trên máy tính'
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

const checkPushSubscriptionStatus = async () => {
  refreshPushBrowserState()
  try {
    const result = await getNotificationSubscriptionStatus()
    subscribedInBackend.value = Boolean(result?.data?.subscribed)
    if (!subscribedInBackend.value) {
      pushState.subscribed = false
    }
  } catch (_error) {
    subscribedInBackend.value = false
    pushState.subscribed = false
  }
}

const refreshDebugStatus = async () => {
  refreshPushBrowserState()
  const [subscriptionId, backendDebug] = await Promise.all([
    getBrowserOneSignalSubscriptionId(),
    getNotificationSubscriptionDebug().catch(() => null),
  ])
  browserSubscriptionId.value = subscriptionId
  debugStatus.value = backendDebug?.data || null
}

const enablePushNotifications = async () => {
  if (!state.userInfo || enablingPush.value || pushBlocked.value) return
  enablingPush.value = true
  try {
    const userId = state.userInfo?.id || state.userInfo?.user_id || state.userInfo?.staff_id
    setOneSignalPushOptOut(userId, false)
    const subscriptionId = await bindOneSignalUser(state.userInfo, { requestPermission: true })
    await checkPushSubscriptionStatus()
    await refreshDebugStatus()
    if (subscriptionId || pushEnabled.value) {
      toast.success('Đã bật thông báo trên máy tính')
    } else if (!pushBlocked.value) {
      toast.info('Bạn cần cho phép thông báo trên trình duyệt để hoàn tất')
    }
  } catch (error) {
    const message = error?.message || 'Không thể bật thông báo trên máy tính'
    toast.error(message)
  } finally {
    enablingPush.value = false
  }
}

const disablePushNotifications = async () => {
  if (disablingPush.value) return
  disablingPush.value = true
  try {
    await unregisterCurrentNotificationSubscriptions()
    const userId = state.userInfo?.id || state.userInfo?.user_id || state.userInfo?.staff_id
    setOneSignalPushOptOut(userId, true)
    subscribedInBackend.value = false
    pushState.subscribed = false
    await refreshDebugStatus()
    toast.success('Đã tắt thông báo trên máy tính')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể tắt thông báo trên máy tính'
    toast.error(message)
  } finally {
    disablingPush.value = false
  }
}

const handleTestPush = async () => {
  if (testingPush.value) return
  testingPush.value = true
  try {
    const result = await sendNotificationTestPush()
    await refreshDebugStatus()
    if (result?.success) {
      toast.success('Đã gửi test push')
    } else {
      toast.error(result?.message || result?.data?.error || 'Gửi test push thất bại')
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Gửi test push thất bại'
    toast.error(message)
  } finally {
    testingPush.value = false
  }
}

const changePage = (page) => {
  if (page < 1 || page > pagination.pageCount || page === pagination.page) return
  void fetchNotifications(page)
}

onMounted(async () => {
  await Promise.all([
    fetchNotifications(1),
    checkPushSubscriptionStatus(),
    refreshDebugStatus(),
  ])
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section">
      <div class="app-section-header space-y-4">
        <div class="app-page-header">
          <div class="app-page-heading">
            <h3 class="app-page-title">Thông báo</h3>
            <p class="app-page-subtitle">Theo dõi ticket mới, phản hồi và cấu hình thông báo trên máy tính.</p>
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

      <div class="border-b border-[var(--stroke)] p-4">
        <div class="flex flex-col gap-3 rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4 tablet:flex-row tablet:items-center tablet:justify-between">
          <div class="flex items-start gap-3">
            <div class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--primary)]">
              <span class="material-symbols-outlined text-[22px]">notifications_active</span>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[var(--text-primary)]">Thông báo trên máy tính</p>
              <p class="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{{ pushStatusLabel }}</p>
              <p v-if="pushBlocked" class="mt-1 text-xs leading-5 text-[var(--danger-text)]">Hãy mở Site settings của trình duyệt và cho phép Notification cho website này.</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="pushEnabled"
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="disablingPush"
              @click="disablePushNotifications"
            >
              <span class="material-symbols-outlined text-[18px]">notifications_off</span>
              {{ disablingPush ? 'Đang tắt...' : 'Tắt thông báo' }}
            </button>
            <button
              v-else
              type="button"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="enablingPush || pushBlocked || !pushState.configured || !pushState.supported"
              @click="enablePushNotifications"
            >
              <span class="material-symbols-outlined text-[18px]">notifications</span>
              {{ enablingPush ? 'Đang bật...' : 'Bật thông báo' }}
            </button>
          </div>
        </div>

        <div class="mt-3 rounded-xl border border-dashed border-[var(--stroke)] bg-white p-3">
          <div class="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
            <div class="min-w-0 space-y-1 text-xs leading-5 text-[var(--text-secondary)]">
              <p class="font-semibold text-[var(--text-primary)]">Debug OneSignal</p>
              <p>Frontend App ID: <span class="font-mono text-[var(--text-primary)]">{{ frontendAppId }}</span></p>
              <p>Browser permission: <span class="font-mono text-[var(--text-primary)]">{{ pushState.permission }}</span></p>
              <p>Browser subscription ID: <span class="break-all font-mono text-[var(--text-primary)]">{{ browserSubscriptionId || '--' }}</span></p>
              <p>Backend App ID: <span class="font-mono text-[var(--text-primary)]">{{ debugStatus?.backend_app_id || '--' }}</span></p>
              <p>Backend active subscriptions: <span class="font-mono text-[var(--text-primary)]">{{ debugStatus?.subscriptions?.filter((item) => item.is_active).length ?? '--' }}</span></p>
              <p>Last push: <span class="font-mono text-[var(--text-primary)]">{{ debugStatus?.last_push_result?.success === true ? 'success' : (debugStatus?.last_push_result?.success === false ? 'failed' : '--') }}</span></p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 text-sm font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                @click="refreshDebugStatus"
              >
                <span class="material-symbols-outlined text-[18px]">refresh</span>
                Làm mới
              </button>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="testingPush || !pushEnabled"
                @click="handleTestPush"
              >
                <span class="material-symbols-outlined text-[18px]">send</span>
                {{ testingPush ? 'Đang gửi...' : 'Test push' }}
              </button>
            </div>
          </div>
        </div>
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
