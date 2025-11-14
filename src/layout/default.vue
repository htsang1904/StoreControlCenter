<script setup>
import { onMounted } from 'vue'
import { useApp } from '@/plugins/app'
import SIdebar from './SIdebar.vue'
import Header from './Header.vue'
import { RouterView } from 'vue-router'
const { state, logout } = useApp()
onMounted(() => {
})
</script>

<template>
    <body class="dark:bg-neutral-800">
        <SIdebar/>
        <main class="md:ps-65 md:hs-overlay-minified:ps-13 transition-all duration-300 pb-4 h-screen flex flex-col">
            <Header/>
            <RouterView/>
        </main>
    </body>
</template>

<style scoped>

</style>
