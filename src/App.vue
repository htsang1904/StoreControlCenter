<script setup>
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import AppSplash from '@/components/AppSplash.vue'
import ToastContainer from '@/components/ToastContainer.vue'

const route = useRoute()
const showRouteSplash = computed(() => route.path === '/sso/callback')
</script>

<template>
  <RouterView />
  <ToastContainer />
  <Transition name="app-splash">
    <AppSplash v-if="showRouteSplash" />
  </Transition>
</template>

<style>
.app-splash-enter-active,
.app-splash-leave-active {
  transition: opacity 320ms ease;
}

.app-splash-enter-from,
.app-splash-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .app-splash-enter-active,
  .app-splash-leave-active {
    transition-duration: 1ms;
  }
}
</style>
