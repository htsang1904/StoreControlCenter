<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useApp } from '@/plugins/app'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

useApp()
const DRAWER_BREAKPOINT = 1024
const route = useRoute()

const desktopSidebarOpen = ref(true)
const drawerMode = ref(false)
const drawerOpen = ref(false)
const mainClass = 'px-2 pt-20 pb-6 sm:px-4 md:px-3 md:pt-[5rem] md:pb-8'
const shouldOffsetLayout = computed(() => !drawerMode.value)
const effectiveDesktopSidebarOpen = computed(() => (shouldOffsetLayout.value ? desktopSidebarOpen.value : false))

const syncDesktopSidebarViewport = () => {
  if (typeof window === 'undefined') return
  const nextDrawerMode = window.innerWidth <= DRAWER_BREAKPOINT

  if (drawerMode.value !== nextDrawerMode) {
    drawerMode.value = nextDrawerMode
  }

  if (nextDrawerMode) {
    drawerOpen.value = false
  }
}

const toggleDesktopSidebar = () => {
  if (drawerMode.value) {
    drawerOpen.value = !drawerOpen.value
    return
  }

  desktopSidebarOpen.value = !desktopSidebarOpen.value
}

const closeSidebarDrawer = () => {
  if (!drawerMode.value || !drawerOpen.value) return
  drawerOpen.value = false
}

onMounted(() => {
  syncDesktopSidebarViewport()
  window.addEventListener('resize', syncDesktopSidebarViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncDesktopSidebarViewport)
})

watch(
  () => route.fullPath,
  () => {
    closeSidebarDrawer()
  }
)
</script>

<template>
  <div class="app-shell bg-[#f6f7f8]">
    <Sidebar
      :desktop-open="desktopSidebarOpen"
      :drawer-mode="drawerMode"
      :drawer-open="drawerOpen"
      @toggle-desktop-sidebar="toggleDesktopSidebar"
      @close-drawer="closeSidebarDrawer"
    />

    <div
      class="min-h-dvh transition-[padding] duration-300 ease-in-out"
      :class="shouldOffsetLayout ? (effectiveDesktopSidebarOpen ? 'md:pl-64' : 'md:pl-20') : ''"
    >
      <Header
        :desktop-open="effectiveDesktopSidebarOpen"
        :drawer-mode="drawerMode"
        @open-sidebar="toggleDesktopSidebar"
      />

      <main :class="mainClass">
        <RouterView />
      </main>
    </div>
  </div>
</template>
