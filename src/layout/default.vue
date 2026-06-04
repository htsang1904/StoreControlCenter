<script setup>
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useResponsive } from '@/composables/useResponsive'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

useApp()
const route = useRoute()
const { isPcViewport } = useResponsive()

const desktopSidebarOpen = ref(true)
const drawerOpen = ref(false)
const drawerMode = computed(() => !isPcViewport.value)
const shouldOffsetLayout = computed(() => isPcViewport.value)
const effectiveDesktopSidebarOpen = computed(() => (isPcViewport.value ? desktopSidebarOpen.value : false))

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
