<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import { useApp } from '@/plugins/app'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

useApp()
const desktopSidebarOpen = ref(true)
const mainClass = 'px-2 pt-20 pb-6 sm:px-4 md:px-3 md:pt-[5rem] md:pb-8'

const toggleDesktopSidebar = () => {
  desktopSidebarOpen.value = !desktopSidebarOpen.value
}
</script>

<template>
  <div class="app-shell bg-[#f6f7f8]">
    <Sidebar :desktop-open="desktopSidebarOpen" @toggle-desktop-sidebar="toggleDesktopSidebar" />

    <div
      class="min-h-dvh transition-[padding] duration-300 ease-in-out"
      :class="desktopSidebarOpen ? 'md:pl-64' : 'md:pl-20'"
    >
      <Header :desktop-open="desktopSidebarOpen" />

      <main :class="mainClass">
        <RouterView />
      </main>
    </div>
  </div>
</template>
