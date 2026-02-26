<script setup>
import { RouterView } from 'vue-router'
import { useApp } from '@/plugins/app'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

useApp()
</script>

<template>
  <div class="app-shell dark:bg-neutral-950">
    <Sidebar />
    <main class="md:ps-65 md:hs-overlay-minified:ps-16 transition-[padding] duration-300 ease-in-out min-h-dvh pb-6">
      <Header />
      <section class="px-3 sm:px-5 pt-20">
        <RouterView />
      </section>
    </main>
  </div>
</template>
