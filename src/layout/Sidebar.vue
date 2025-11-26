<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute()
const TABS = [
  {
    label: 'Yêu cầu xử lý',
    value: 0,
    icon: 'https://cdn.lordicon.com/rguyoaum.json',
    path: '/ticket'
  },
  {
    label: 'Báo cáo QC',
    value: 1,
    icon: 'https://cdn.lordicon.com/wwcdwkaf.json',
    path: '/QC'
  }
]
const tabs = reactive(TABS)
const selectedTab = ref(null)

function selectTab() {
  setTimeout(() => {
    selectedTab.value = route.path
  }, 50)
}
onMounted(async () => {
  await nextTick()
  selectTab()
})
</script>
<template>
  <div id="hs-pro-sidebar" class="hs-overlay [--auto-close:md] hs-overlay-open:translate-x-0 -translate-x-full transition-all duration-300 transform w-65 hs-overlay-minified:w-13 overflow-hidden hidden fixed inset-y-0 z-60 start-0 bg-white border-e border-gray-200 dark:border-neutral-700 md:block md:translate-x-0 md:end-auto md:bottom-0 dark:bg-neutral-800" role="dialog" tabindex="-1" aria-label="Sidebar">
    <div class="relative flex flex-col h-full max-h-full">

      <header class="py-2.5 px-4 flex justify-between items-center gap-x-2">
        <div class="-ms-2 flex items-center gap-x-1">
          <div class="md:hs-overlay-minified:hidden">
            <a class="shrink-0 inline-flex justify-center items-center w-[70%] rounded-lg text-xl font-semibold hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="" aria-label="Guta">
              <img class="w-auto" src="/src/assets/images/logo.png" alt="">
            </a>
          </div>

          <button type="button" class="hidden md:hs-overlay-minified:flex justify-center items-center flex-none gap-x-3 size-9 text-sm text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" aria-haspopup="dialog" aria-expanded="true" aria-controls="hs-pro-sidebar" aria-label="Minify navigation" data-hs-overlay-minifier="#hs-pro-sidebar">
            <svg class="hidden hs-overlay-minified:block shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"></rect>
              <path d="M15 3v18"></path>
              <path d="m8 9 3 3-3 3"></path>
            </svg>
            <svg class="hs-overlay-minified:hidden shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"></rect>
              <path d="M15 3v18"></path>
              <path d="m10 15-3-3 3-3"></path>
            </svg>
          </button>
        </div>

        <button type="button" class="hidden md:hs-overlay-minified:hidden md:flex justify-center items-center flex-none gap-x-3 size-9 text-sm text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" aria-haspopup="dialog" aria-expanded="true" aria-controls="hs-pro-sidebar" aria-label="Minify navigation" data-hs-overlay-minifier="#hs-pro-sidebar">
          <svg class="hidden hs-overlay-minified:block shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m8 9 3 3-3 3"></path>
          </svg>
          <svg class="hs-overlay-minified:hidden shrink-0 size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m10 15-3-3 3-3"></path>
          </svg>
        </button>
        <button type="button" class="flex md:hidden justify-center items-center gap-x-3 size-6 bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200" data-hs-overlay="#hs-pro-sidebar" aria-expanded="true">
          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <div class="mb-5 px-2 flex flex-col gap-y-5">
        <!-- List -->
        <ul class="flex flex-col gap-y-0.5">
          <li v-for="(tab, index) in tabs" :key="index" @click="selectTab">
            <router-link :to="tab.path" :class="{'active': selectedTab === tab.path }" class="hover-target group relative w-full flex items-center gap-1 py-1.5 px-2.5 text-sm text-gray-800 rounded-lg before:absolute before:inset-y-0 before:-start-2 before:rounded-e-full before:w-1 before:h-full hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
              <span class="-ms-[5px] flex shrink-0 justify-center items-center size-6">
               <lord-icon
                  :src="tab.icon"
                  trigger="hover"
                  :colors="selectedTab === tab.path ? 'primary:#ffffff' : 'primary:#333333'"
                  target=".hover-target">
              </lord-icon>
              </span>
              <span class="relative hs-overlay-minified:opacity-0 transition-opacity duration-300 pr-3.5">
                <span class="truncate text-sm">{{ tab.label }}</span>
                <span v-if="false" class="absolute -top-0.5 -end-0.5">
                  <span class="relative flex">
                    <span class="animate-ping absolute inline-flex size-full rounded-full bg-red-400 dark:bg-red-600 opacity-75"></span>
                    <span class="relative inline-flex size-2 bg-red-500 rounded-full"></span>
                  </span>
                </span>
              </span>
            </router-link>
          </li>
        </ul>
      </div>

      <div class="hs-overlay-minified:opacity-0 transition-opacity duration-300 pb-4 px-2 size-full flex flex-col gap-y-5 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
        <div class="flex flex-col">
          <span class="block ps-2.5 mb-2 text-sm text-gray-400 dark:text-neutral-500">
            Xử lý gần nhất
          </span>

          <ul class="flex flex-col gap-y-0.5">
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Preline UI Overview</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid1" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid1">
                      <div class="p-1 space-y-0.5">
                        <button type="button" class="w-full flex items-center gap-x-3 py-1.5 px-2 rounded-lg text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
                          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" x2="12" y1="2" y2="15" />
                          </svg>
                          Share
                        </button>
                        <button type="button" class="w-full flex items-center gap-x-3 py-1.5 px-2 rounded-lg text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
                          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                            <path d="m15 5 4 4" />
                          </svg>
                          Rename
                        </button>
                        <button type="button" class="w-full flex items-center gap-x-3 py-1.5 px-2 rounded-lg text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800">
                          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="20" height="5" x="2" y="3" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                            <path d="M10 12h4" />
                          </svg>
                          Archive
                        </button>
                        <button type="button" class="w-full flex items-center gap-x-3 py-1.5 px-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/20 dark:focus:bg-red-500/20">
                          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                    <!-- End More Dropdown -->
                  </div>
                  <!-- End More Dropdown -->
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
@custom-variant dark (&:where(.dark, .dark *));
@reference "tailwindcss";
.active {
  @apply relative bg-blue-600 text-white before:absolute before:inset-y-0
         before:-start-2 before:rounded-e-full before:w-1 before:h-full before:bg-blue-600 font-medium
         dark:bg-neutral-700 dark:text-cyan-400 dark:before:bg-cyan-400;
}
</style>