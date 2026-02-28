<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/plugins/toast'
import { useApp } from '@/plugins/app'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notification_service'

const route = useRoute()
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

const pageTitle = computed(() => {
  if (/^\/ticket\/\d+\/edit$/.test(route.path)) {
    return 'Chỉnh sửa yêu cầu'
  }
  if (route.path.startsWith('/ticket/add-ticket')) {
    return 'Tạo yêu cầu mới'
  }
  if (route.path.startsWith('/ticket/')) {
    return 'Chi tiết yêu cầu'
  }
  if (route.path.startsWith('/QC')) {
    return 'Báo cáo QC'
  }
  return 'Yêu cầu hỗ trợ'
})

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
  <header class="fixed top-0 inset-x-0 md:ms-65 md:hs-overlay-minified:ms-16 transition-[margin] duration-300 ease-in-out z-50 px-3 sm:px-5 pt-3">
    <nav class="glass-card flex h-14 items-center justify-between rounded-2xl px-3 sm:px-4">
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          class="md:hidden flex justify-center items-center size-9 text-slate-500 rounded-lg hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-haspopup="dialog"
          aria-expanded="true"
          aria-controls="hs-pro-sidebar"
          aria-label="Open sidebar"
          data-hs-overlay="#hs-pro-sidebar"
        >
          <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m8 9 3 3-3 3"></path>
          </svg>
          <span class="sr-only">Open sidebar</span>
        </button>

        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Trung tâm điều phối cửa hàng</p>
          <h1 class="font-heading truncate text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{{ pageTitle }}</h1>
        </div>
      </div>

      <div ref="notificationPanelRef" class="relative flex items-center gap-2">
        <button
          type="button"
          class="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Thông báo"
          @click="handleToggleNotification"
        >
          <span v-if="unreadCount > 0" class="absolute -end-1 -top-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
          <svg class="size-4.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .738-1.674C19.41 13.854 18 12.105 18 8.8V8a6 6 0 1 0-12 0v.8c0 3.305-1.41 5.054-2.738 6.526"></path>
          </svg>
        </button>

        <div
          v-if="notificationOpen"
          class="absolute right-0 top-full mt-2 z-70 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Thông báo</p>
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
              class="mb-1 w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
              :class="item.is_read ? 'border-transparent' : 'border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/20'"
              @click="handleOpenNotification(item)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ item.title || 'Thông báo' }}</p>
                <span v-if="!item.is_read" class="mt-1 inline-flex size-2 rounded-full bg-blue-500"></span>
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{{ item.message }}</p>
              <p class="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{{ formatNotificationTime(item.createdAt) }}</p>
            </button>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>
