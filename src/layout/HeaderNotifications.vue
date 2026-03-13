<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/plugins/toast'
import { useApp } from '@/plugins/app'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notification_service'

const NOTIFICATION_PAGE_SIZE = 12
const NOTIFICATION_POLLING_INTERVAL_MS = 30000

const router = useRouter()
const toast = useToast()
const { state } = useApp()

const notificationPanelRef = ref(null)
const notificationOpen = ref(false)
const notificationLoading = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const markingAllRead = ref(false)
let pollingTimer = null

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

const updateNotificationReadState = (notificationId) => {
  notifications.value = notifications.value.map((item) => (
    Number(item?.id) === notificationId
      ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
      : item
  ))
}

const markAllNotificationsReadLocally = () => {
  notifications.value = notifications.value.map((item) => ({
    ...item,
    is_read: true,
    read_at: item.read_at || new Date().toISOString(),
  }))
}

const fetchNotifications = async ({ silent = false } = {}) => {
  if (!state?.token) return
  if (notificationLoading.value && silent) return

  notificationLoading.value = true

  try {
    const result = await listNotifications({
      page: 1,
      pageSize: NOTIFICATION_PAGE_SIZE,
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

    updateNotificationReadState(notificationId)
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
    markAllNotificationsReadLocally()
    toast.success('Đã đánh dấu tất cả thông báo là đã đọc')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể cập nhật thông báo'
    toast.error(message)
  } finally {
    markingAllRead.value = false
  }
}

function startNotificationPolling() {
  if (pollingTimer || !state?.token) return
  pollingTimer = window.setInterval(() => {
    void fetchNotifications({ silent: true })
  }, NOTIFICATION_POLLING_INTERVAL_MS)
}

function stopNotificationPolling() {
  if (!pollingTimer) return
  window.clearInterval(pollingTimer)
  pollingTimer = null
}

watch(
  () => state?.token,
  async (token) => {
    if (!token) {
      notifications.value = []
      unreadCount.value = 0
      stopNotificationPolling()
      return
    }

    await fetchNotifications({ silent: true })
    startNotificationPolling()
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  stopNotificationPolling()
})
</script>

<template>
  <div ref="notificationPanelRef" class="relative">
    <button
      type="button"
      class="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
      aria-label="Thông báo"
      @click="handleToggleNotification"
    >
      <span v-if="unreadCount > 0" class="absolute right-1.5 top-1.5 inline-flex size-2.5 rounded-full border border-white bg-slate-900"></span>
      <span class="material-symbols-outlined text-[20px]">notifications</span>
    </button>

    <div
      v-if="notificationOpen"
      class="absolute right-0 top-full mt-2 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white"
    >
      <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p class="text-sm font-semibold text-slate-800">Thông báo</p>
        <button
          type="button"
          class="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="markingAllRead || unreadCount === 0"
          @click="handleMarkAllRead"
        >
          {{ markingAllRead ? 'Đang cập nhật...' : 'Đánh dấu đã đọc' }}
        </button>
      </div>

      <div class="max-h-96 overflow-y-auto p-1.5">
        <p v-if="notificationLoading" class="app-state-inline">Đang tải thông báo...</p>
        <p v-else-if="!notifications.length" class="app-state-inline">Hiện chưa có thông báo nào.</p>
        <button
          v-for="item in notifications"
          :key="item.id"
          type="button"
          class="mb-1 w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
          :class="item.is_read ? 'border-transparent' : 'border-slate-200 bg-slate-50'"
          @click="handleOpenNotification(item)"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-slate-800">{{ item.title || 'Thông báo' }}</p>
            <span v-if="!item.is_read" class="mt-1 inline-flex size-2 rounded-full bg-slate-900"></span>
          </div>
          <p class="mt-1 line-clamp-2 text-xs text-slate-600">{{ item.message }}</p>
          <p class="mt-1 text-[11px] text-slate-400">{{ formatNotificationTime(item.createdAt) }}</p>
        </button>
      </div>
    </div>
  </div>
</template>
