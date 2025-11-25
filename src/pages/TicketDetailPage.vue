<script setup>
import { onMounted } from 'vue'
import { useRouter } from "vue-router"

const router = useRouter()
defineProps({
    id: String
})
onMounted(() => {
})

function goBack() {
    router.push('/ticket')
}
</script>

<template>
  <div>
    <div class="header max-w-full p-2.5 text-[18px] font-bold text-white mx-4 mt-6 box-border rounded-lg bg-linear-to-r from-blue-600 to-blue-500 flex items-center">
        <button @click="goBack" type="button" class="cursor-pointer p-1 mr-2 inline-flex items-center rounded-lg bg-white/40 text-white shadow-2xs hover:bg-white/30 focus:outline-hidden focus:bg-white/30">
            <svg class="shrink-0 size-6 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        Ticket ID: #{{ id }}
    </div>
    <!-- Content -->
    <div class="relative h-[calc(100vh-132px)]">
    <div class="pt-14 pb-[140px] max-h-full overflow-scroll custom-scroll">
        <!-- Title -->
        <div class="max-w-4xl px-4 sm:px-6 lg:px-8 mx-auto text-center">

        <h1 class="text-3xl font-bold text-gray-800 sm:text-4xl dark:text-white">
            Welcome to Preline AI
        </h1>
        <div class="px-6 py-3">
                    <span class="py-1 px-1.5 inline-flex items-center gap-x-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full dark:bg-yellow-500/10 dark:text-yellow-500">
                      <svg class="size-2.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                      </svg>
                      Warning
                    </span>
                  </div>
        </div>
        <!-- End Title -->

        <ul class="mt-16 space-y-5">
        <!-- Chat Bubble -->
        <li class="max-w-4xl py-2 px-4 sm:px-6 lg:px-8 mx-auto flex gap-x-2 sm:gap-x-4">
            <svg class="shrink-0 size-9.5 rounded-full" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="38" height="38" rx="6" fill="#2563EB"/>
            <path d="M10 28V18.64C10 13.8683 14.0294 10 19 10C23.9706 10 28 13.8683 28 18.64C28 23.4117 23.9706 27.28 19 27.28H18.25" stroke="white" stroke-width="1.5"/>
            <path d="M13 28V18.7552C13 15.5104 15.6863 12.88 19 12.88C22.3137 12.88 25 15.5104 25 18.7552C25 22 22.3137 24.6304 19 24.6304H18.25" stroke="white" stroke-width="1.5"/>
            <ellipse cx="19" cy="18.6554" rx="3.75" ry="3.6" fill="white"/>
            </svg>

            <div class="space-y-3">
            <h2 class="font-medium text-gray-800 dark:text-white">
                How can we help?
            </h2>
            <div class="space-y-1.5">
                <p class="mb-1.5 text-sm text-gray-800 dark:text-white">
                You can ask questions like:
                </p>
                <ul class="list-disc list-outside space-y-1.5 ps-3.5">
                <li class="text-sm text-gray-800 dark:text-white">
                    What's Preline UI?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    How many Starter Pages & Examples are there?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    Is there a PRO version?
                </li>
                </ul>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->

        <!-- Chat Bubble -->
        <li class="py-2 sm:py-4">
            <div class="max-w-4xl px-4 sm:px-6 lg:px-8 mx-auto">
            <div class="max-w-2xl flex gap-x-2 sm:gap-x-4">
                <span class="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-gray-600">
                <span class="text-sm font-medium text-white">AZ</span>
                </span>

                <div class="grow mt-2 space-y-3">
                <p class="text-gray-800 dark:text-neutral-200">
                    what's preline ui?
                </p>
                </div>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->
         <!-- Chat Bubble -->
        <li class="max-w-4xl py-2 px-4 sm:px-6 lg:px-8 mx-auto flex gap-x-2 sm:gap-x-4">
            <svg class="shrink-0 size-9.5 rounded-full" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="38" height="38" rx="6" fill="#2563EB"/>
            <path d="M10 28V18.64C10 13.8683 14.0294 10 19 10C23.9706 10 28 13.8683 28 18.64C28 23.4117 23.9706 27.28 19 27.28H18.25" stroke="white" stroke-width="1.5"/>
            <path d="M13 28V18.7552C13 15.5104 15.6863 12.88 19 12.88C22.3137 12.88 25 15.5104 25 18.7552C25 22 22.3137 24.6304 19 24.6304H18.25" stroke="white" stroke-width="1.5"/>
            <ellipse cx="19" cy="18.6554" rx="3.75" ry="3.6" fill="white"/>
            </svg>

            <div class="space-y-3">
            <h2 class="font-medium text-gray-800 dark:text-white">
                How can we help?
            </h2>
            <div class="space-y-1.5">
                <p class="mb-1.5 text-sm text-gray-800 dark:text-white">
                You can ask questions like:
                </p>
                <ul class="list-disc list-outside space-y-1.5 ps-3.5">
                <li class="text-sm text-gray-800 dark:text-white">
                    What's Preline UI?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    How many Starter Pages & Examples are there?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    Is there a PRO version?
                </li>
                </ul>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->

        <!-- Chat Bubble -->
        <li class="py-2 sm:py-4">
            <div class="max-w-4xl px-4 sm:px-6 lg:px-8 mx-auto">
            <div class="max-w-2xl flex gap-x-2 sm:gap-x-4">
                <span class="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-gray-600">
                <span class="text-sm font-medium text-white">AZ</span>
                </span>

                <div class="grow mt-2 space-y-3">
                <p class="text-gray-800 dark:text-neutral-200">
                    what's preline ui?
                </p>
                </div>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->
         <!-- Chat Bubble -->
        <li class="max-w-4xl py-2 px-4 sm:px-6 lg:px-8 mx-auto flex gap-x-2 sm:gap-x-4">
            <svg class="shrink-0 size-9.5 rounded-full" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="38" height="38" rx="6" fill="#2563EB"/>
            <path d="M10 28V18.64C10 13.8683 14.0294 10 19 10C23.9706 10 28 13.8683 28 18.64C28 23.4117 23.9706 27.28 19 27.28H18.25" stroke="white" stroke-width="1.5"/>
            <path d="M13 28V18.7552C13 15.5104 15.6863 12.88 19 12.88C22.3137 12.88 25 15.5104 25 18.7552C25 22 22.3137 24.6304 19 24.6304H18.25" stroke="white" stroke-width="1.5"/>
            <ellipse cx="19" cy="18.6554" rx="3.75" ry="3.6" fill="white"/>
            </svg>

            <div class="space-y-3">
            <h2 class="font-medium text-gray-800 dark:text-white">
                How can we help?
            </h2>
            <div class="space-y-1.5">
                <p class="mb-1.5 text-sm text-gray-800 dark:text-white">
                You can ask questions like:
                </p>
                <ul class="list-disc list-outside space-y-1.5 ps-3.5">
                <li class="text-sm text-gray-800 dark:text-white">
                    What's Preline UI?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    How many Starter Pages & Examples are there?
                </li>

                <li class="text-sm text-gray-800 dark:text-white">
                    Is there a PRO version?
                </li>
                </ul>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->

        <!-- Chat Bubble -->
        <li class="py-2 sm:py-4">
            <div class="max-w-4xl px-4 sm:px-6 lg:px-8 mx-auto">
            <div class="max-w-2xl flex gap-x-2 sm:gap-x-4">
                <span class="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-gray-600">
                <span class="text-sm font-medium text-white">AZ</span>
                </span>

                <div class="grow mt-2 space-y-3">
                <p class="text-gray-800 dark:text-neutral-200">
                    what's preline ui?
                </p>
                </div>
            </div>
            </div>
        </li>
        <!-- End Chat Bubble -->

        </ul>
    </div>

    <div class="absolute w-full bottom-0 z-10 bg-white border-t border-gray-200 pt-2 pb-3 sm:pt-4 sm:pb-6 dark:bg-neutral-900 dark:border-neutral-700">
        <div class="max-w-4xl w-[96%] mx-auto px-4 sm:px-6 lg:px-0">
        <div class="relative">
            <textarea class="p-3 sm:p-4 pb-12 sm:pb-12 block w-full border border-gray-200 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" placeholder="Ask me anything..."></textarea>

            <!-- Toolbar -->
            <div class="absolute bottom-px inset-x-px p-2 rounded-b-lg bg-white dark:bg-neutral-900">
            <div class="flex flex-wrap justify-between items-center gap-2">
                <!-- Button Group -->
                <div class="flex items-center">
                <!-- Mic Button -->
                <button type="button" class="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-hidden focus:bg-gray-100 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700">
                    <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="9" x2="15" y1="15" y2="9"/></svg>
                </button>
                <!-- End Mic Button -->

                <!-- Attach Button -->
                <button type="button" class="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-hidden focus:bg-gray-100 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700">
                    <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <!-- End Attach Button -->
                </div>
                <!-- End Button Group -->

                <!-- Button Group -->
                <div class="flex items-center gap-x-1">
                <!-- Mic Button -->
                <button type="button" class="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-hidden focus:bg-gray-100 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700">
                    <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                <!-- End Mic Button -->

                <!-- Send Button -->
                <button type="button" class="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-white bg-blue-600 hover:bg-blue-500 focus:z-10 focus:outline-hidden focus:bg-blue-500">
                    <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
                    </svg>
                </button>
                <!-- End Send Button -->
                </div>
                <!-- End Button Group -->
            </div>
            </div>
            <!-- End Toolbar -->
        </div>
        </div>
    </div>
    </div>
    <!-- End Content -->

  </div>
</template>

<style scoped>

</style>
