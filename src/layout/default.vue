<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useResponsive } from '@/composables/useResponsive'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import {
  bindOneSignalUser,
  cleanupLegacyOneSignalState,
  isOneSignalPushOptedOut,
  pushState,
  refreshPushBrowserState,
} from '@/services/onesignal_service'
import { getNotificationSubscriptionStatus } from '@/services/notification_service'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

const { state } = useApp()
const route = useRoute()
const { isPcViewport } = useResponsive()

const desktopSidebarOpen = ref(true)
const drawerOpen = ref(false)
const drawerMode = computed(() => !isPcViewport.value)
const shouldOffsetLayout = computed(() => isPcViewport.value)
const effectiveDesktopSidebarOpen = computed(() => (isPcViewport.value ? desktopSidebarOpen.value : false))
const currentUserId = computed(() => state.userInfo?.id || state.userInfo?.user_id || state.userInfo?.staff_id || null)

const checkingPushSubscription = ref(false)
const promptedPushUserId = ref(null)
const shouldRequestPushOnInteraction = ref(false)

const toggleDesktopSidebar = () => {
  if (!isPcViewport.value) {
    drawerOpen.value = !drawerOpen.value
    return
  }

  desktopSidebarOpen.value = !desktopSidebarOpen.value
}

const closeSidebarDrawer = () => {
  if (isPcViewport.value || !drawerOpen.value) return
  drawerOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    closeSidebarDrawer()
  }
)

const requestNativePushPermissionIfNeeded = async () => {
  if (!currentUserId.value || checkingPushSubscription.value) return
  if (isOneSignalPushOptedOut(currentUserId.value)) return
  if (promptedPushUserId.value === currentUserId.value && !shouldRequestPushOnInteraction.value) return

  const didCleanup = await cleanupLegacyOneSignalState()
  if (didCleanup) {
    window.location.reload()
    return
  }

  refreshPushBrowserState()
  if (!pushState.configured || !pushState.supported || pushState.permission === 'denied') return

  checkingPushSubscription.value = true

  try {
    const result = await getNotificationSubscriptionStatus()
    if (result?.data?.subscribed) {
      shouldRequestPushOnInteraction.value = false
      promptedPushUserId.value = currentUserId.value
      return
    }

    const subscriptionId = await bindOneSignalUser(state.userInfo, { requestPermission: true })
    promptedPushUserId.value = currentUserId.value
    shouldRequestPushOnInteraction.value = !subscriptionId && pushState.permission === 'default'
  } catch (_error) {
    shouldRequestPushOnInteraction.value = pushState.permission === 'default'
  } finally {
    checkingPushSubscription.value = false
  }
}

const requestNativePushPermissionFromInteraction = () => {
  if (!shouldRequestPushOnInteraction.value) return
  shouldRequestPushOnInteraction.value = false
  promptedPushUserId.value = null
  void requestNativePushPermissionIfNeeded()
}

watch(
  () => [currentUserId.value, route.fullPath],
  () => {
    void requestNativePushPermissionIfNeeded()
  },
  { immediate: true }
)

if (typeof window !== 'undefined') {
  window.addEventListener('click', requestNativePushPermissionFromInteraction, true)
  window.addEventListener('keydown', requestNativePushPermissionFromInteraction, true)
}

onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('click', requestNativePushPermissionFromInteraction, true)
  window.removeEventListener('keydown', requestNativePushPermissionFromInteraction, true)
})

watch(
  () => isPcViewport.value,
  () => {
    drawerOpen.value = false
  },
  { immediate: true }
)
</script>

<template>
  <div class="app-shell h-dvh overflow-hidden bg-[var(--app-bg)]">
    <Sidebar
      :desktop-open="desktopSidebarOpen"
      :drawer-mode="drawerMode"
      :drawer-open="drawerOpen"
      @toggle-desktop-sidebar="toggleDesktopSidebar"
      @close-drawer="closeSidebarDrawer"
    />

    <div
      class="flex h-full min-h-0 flex-col transition-[padding] duration-300 ease-in-out"
      :class="shouldOffsetLayout ? (effectiveDesktopSidebarOpen ? 'pc:pl-64' : 'pc:pl-20') : ''"
    >
      <Header
        :desktop-open="effectiveDesktopSidebarOpen"
        :drawer-mode="drawerMode"
        @open-sidebar="toggleDesktopSidebar"
      />

      <main class="min-h-0 flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>

    <AppConfirmDialog />
  </div>
</template>
