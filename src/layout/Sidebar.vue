<script setup></script>
<template>
     <div id="hs-pro-sidebar" class="hs-overlay [--auto-close:md]
  hs-overlay-open:translate-x-0
  -translate-x-full transition-all duration-300 transform
  w-65 hs-overlay-minified:w-13 overflow-hidden
  hidden
  fixed inset-y-0 z-60 start-0
  bg-white border-e border-gray-200 dark:border-neutral-700
  md:block md:translate-x-0 md:end-auto md:bottom-0
  dark:bg-neutral-800" role="dialog" tabindex="-1" aria-label="Sidebar">
    <div class="relative flex flex-col h-full max-h-full">
      <!-- Header -->
      <header class="py-2.5 px-4 flex justify-between items-center gap-x-2">
        <div class="-ms-2 flex items-center gap-x-1">
          <div class="md:hs-overlay-minified:hidden">
            <a class="shrink-0 inline-flex justify-center items-center size-9 rounded-lg text-xl inline-block font-semibold hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="index.html" aria-label="Preline">
              <svg class="shrink-0 size-5 text-cyan-700 dark:text-cyan-400" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M18.0835 3.23358C9.88316 3.23358 3.23548 9.8771 3.23548 18.0723V35.5832H0.583496V18.0723C0.583496 8.41337 8.41851 0.583252 18.0835 0.583252C27.7485 0.583252 35.5835 8.41337 35.5835 18.0723C35.5835 27.7312 27.7485 35.5614 18.0835 35.5614H16.7357V32.911H18.0835C26.2838 32.911 32.9315 26.2675 32.9315 18.0723C32.9315 9.8771 26.2838 3.23358 18.0835 3.23358Z" fill="currentColor" />
                <path fill-rule="evenodd" clip-rule="evenodd" d="M18.0833 8.62162C12.8852 8.62162 8.62666 12.9245 8.62666 18.2879V35.5833H5.97468V18.2879C5.97468 11.5105 11.3713 5.97129 18.0833 5.97129C24.7954 5.97129 30.192 11.5105 30.192 18.2879C30.192 25.0653 24.7954 30.6045 18.0833 30.6045H16.7355V27.9542H18.0833C23.2815 27.9542 27.54 23.6513 27.54 18.2879C27.54 12.9245 23.2815 8.62162 18.0833 8.62162Z" fill="currentColor" />
                <path d="M24.8225 18.1012C24.8225 21.8208 21.8053 24.8361 18.0833 24.8361C14.3614 24.8361 11.3442 21.8208 11.3442 18.1012C11.3442 14.3815 14.3614 11.3662 18.0833 11.3662C21.8053 11.3662 24.8225 14.3815 24.8225 18.1012Z" fill="currentColor" />
              </svg>
            </a>
          </div>

          <!-- Sidebar Toggle -->
          <button type="button" class="hidden md:hs-overlay-minified:flex justify-center items-center flex-none gap-x-3 size-9 text-sm text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" aria-haspopup="dialog" aria-expanded="true" aria-controls="hs-pro-sidebar" aria-label="Minify navigation" data-hs-overlay-minifier="#hs-pro-sidebar">
            <svg class="hidden hs-overlay-minified:block shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"></rect>
              <path d="M15 3v18"></path>
              <path d="m8 9 3 3-3 3"></path>
            </svg>
            <svg class="hs-overlay-minified:hidden shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"></rect>
              <path d="M15 3v18"></path>
              <path d="m10 15-3-3 3-3"></path>
            </svg>
            <span class="sr-only">Sidebar Toggle</span>
          </button>
          <!-- End Sidebar Toggle -->

          <div class="hidden sm:block md:hs-overlay-minified:hidden">
            <!-- Templates Dropdown -->
            <div class="hs-dropdown  relative  [--scope:window] [--auto-close:inside] inline-flex">
              <button id="hs-dropdown-preview-navbar" type="button" class="hs-dropdown-toggle  group relative flex justify-center items-center size-8 text-xs rounded-lg text-gray-800 hover:bg-gray-100 focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden" aria-haspopup="menu" aria-expanded="false" aria-label="Dropdown">
                <span class="">
                  <svg class=" size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>

                <span class="absolute -top-0.5 -end-0.5">
                  <span class="relative flex">
                    <span class="animate-ping absolute inline-flex size-full rounded-full bg-red-400 dark:bg-red-600 opacity-75"></span>
                    <span class="relative inline-flex size-2 bg-red-500 rounded-full"></span>
                    <span class="sr-only">Notification</span>
                  </span>
                </span>
              </button>

              <!-- Dropdown -->
              <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-full min-w-90 md:w-125 transition-[opacity,margin] duration opacity-0 hidden z-61 overflow-hidden border border-gray-200 bg-white rounded-xl shadow-xl dark:bg-neutral-800 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-dropdown-preview-navbar">
                <!-- Tab -->
                <div class="p-3 pb-0 flex flex-wrap justify-between items-center gap-3 border-b border-gray-200 dark:border-neutral-700">
                  <!-- Nav Tab -->
                  <nav class="flex gap-1" aria-label="Tabs" role="tablist" aria-orientation="horizontal">
                    <button type="button" class="hs-tab-active:after:bg-gray-800 hs-tab-active:text-gray-800 px-2 py-1.5 mb-2 relative inline-flex justify-center items-center gap-x-2 hover:bg-gray-100 text-gray-500 hover:text-gray-800 text-sm rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 after:absolute after:-bottom-2 after:inset-x-2 after:z-10 after:h-0.5 after:pointer-events-none dark:hs-tab-active:text-neutral-200 dark:hs-tab-active:after:bg-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden " id="hs-pmn-item-pro" aria-selected="false" data-hs-tab="#hs-pmn-pro" aria-controls="hs-pmn-pro" role="tab">
                      Pro
                    </button>
                    <button type="button" class="hs-tab-active:after:bg-gray-800 hs-tab-active:text-gray-800 px-2 py-1.5 mb-2 relative inline-flex justify-center items-center gap-x-2 hover:bg-gray-100 text-gray-500 hover:text-gray-800 text-sm rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 after:absolute after:-bottom-2 after:inset-x-2 after:z-10 after:h-0.5 after:pointer-events-none dark:hs-tab-active:text-neutral-200 dark:hs-tab-active:after:bg-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden active" id="hs-pmn-item-free" aria-selected="true" data-hs-tab="#hs-pmn-free" aria-controls="hs-pmn-free" role="tab">
                      Free
                    </button>
                  </nav>
                  <!-- End Nav Tab -->

                  <!-- Switch/Toggle -->
                  <div class="mb-2 flex items-center gap-x-0.5">
                    <button type="button" class="hs-dark-mode hs-dark-mode-active:hidden flex shrink-0 justify-center items-center gap-x-1 text-xs text-gray-500 hover:text-gray-800 focus:outline-hidden focus:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200 dark:focus:text-neutral-200" data-hs-theme-click-value="dark">
                      <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                      </svg>
                      Switch to Dark
                    </button>
                    <button type="button" class="hs-dark-mode hs-dark-mode-active:flex hidden shrink-0 justify-center items-center gap-x-1 text-xs text-gray-500 hover:text-gray-800 focus:outline-hidden focus:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200 dark:focus:text-neutral-200" data-hs-theme-click-value="light">
                      <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="4"></circle>
                        <path d="M12 2v2"></path>
                        <path d="M12 20v2"></path>
                        <path d="m4.93 4.93 1.41 1.41"></path>
                        <path d="m17.66 17.66 1.41 1.41"></path>
                        <path d="M2 12h2"></path>
                        <path d="M20 12h2"></path>
                        <path d="m6.34 17.66-1.41 1.41"></path>
                        <path d="m19.07 4.93-1.41 1.41"></path>
                      </svg>
                      Switch to Light
                    </button>
                  </div>
                  <!-- End Switch/Toggle -->
                </div>
                <!-- End Tab -->

                <!-- Tab Content -->
                <div id="hs-pmn-pro" class="hidden" role="tabpanel" aria-labelledby="hs-pmn-item-pro">
                  <!-- Header -->
                  <div class="p-3 flex flex-wrap justify-between items-center gap-3">
                    <span class="block font-semibold text-sm text-gray-800 dark:text-neutral-200">Templates (21)</span>

                    <div class="ms-auto">
                      <a class="group py-2 px-2.5 rounded-md flex items-center gap-x-1 text-[13px] bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-900 dark:bg-white dark:hover:bg-neutral-200 dark:focus:bg-neutral-200 dark:text-neutral-800" href="https://preline.co/pro/pricing.html">
                        Purchase
                        <svg class="hidden md:inline-block shrink-0 size-3.5 group-hover:translate-x-0.5 transition" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-focus:opacity-100 lg:group-focus:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:group-focus:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <!-- End Header -->

                  <!-- Body -->
                  <div class="px-3 max-h-64 sm:max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                    <!-- Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/dashboard/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img1.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img1.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Dashboard
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/cms/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img55.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img55.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          CMS
                        </p>

                        <div class="absolute -top-px end-[3px]">
                          <span class="py-0.5 px-2 inline-flex items-center gap-x-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full dark:bg-emerald-900 dark:text-emerald-500">New</span>
                        </div>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/ai-chat/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img58.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img58.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          AI Chat
                        </p>

                        <div class="absolute -top-px end-[3px]">
                          <span class="py-0.5 px-2 inline-flex items-center gap-x-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full dark:bg-emerald-900 dark:text-emerald-500">New</span>
                        </div>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/video-call/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img61.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img61.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Video Call
                        </p>

                        <div class="absolute -top-px end-[3px]">
                          <span class="py-0.5 px-2 inline-flex items-center gap-x-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full dark:bg-emerald-900 dark:text-emerald-500">New</span>
                        </div>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/startup/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img32.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img32.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Startup
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/payment/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img8.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img8.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Payment
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/chat/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img16.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img16.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Chat
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/shop/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img21.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img21.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Shop
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/ecommerce/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img4.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img4.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          E-Commerce
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/agency/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img46.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img46.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Agency
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/crm/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img11.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img11.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          CRM
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/workspace/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img18.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img18.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Workspace
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/analytics/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img9.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img9.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Analytics
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/calendars/day.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img14.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img14.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Calendars
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/smart-home/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img35.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img35.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Smart Home
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/coffee-shop/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img52.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img52.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Coffee Shop
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/inbox/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img26.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img26.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Inbox
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/project/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img10.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img10.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Project
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/shop-marketplace/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img29.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img29.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Shop Marketplace
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/personal/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img49.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img49.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Personal
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/pro/files/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews/img12.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/demo-previews-dark/img12.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Files
                        </p>
                      </a>
                      <!-- End Link -->
                    </div>
                    <!-- End Grid -->
                  </div>
                  <!-- Body -->

                  <!-- Footer -->
                  <div class="p-3 flex flex-wrap justify-center items-center gap-0.5">
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/pro/index.html">
                        Main page
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/pro/examples.html">
                        Examples (775<!-- (775) -->)
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/pro/templates.html">
                        Templates (21)
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <!-- End Footer -->
                </div>
                <!-- End Tab Content -->

                <!-- Tab Content -->
                <div id="hs-pmn-free" class="" role="tabpanel" aria-labelledby="hs-pmn-item-free">
                  <!-- Header -->
                  <div class="p-3 flex flex-wrap justify-between items-center gap-3">
                    <span class="block font-semibold text-sm text-gray-800 dark:text-neutral-200">Templates (5)</span>

                    <div class="ms-auto">
                      <a class="group py-2 px-2.5 rounded-md flex items-center gap-x-1 text-[13px] bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-900 dark:bg-white dark:hover:bg-neutral-200 dark:focus:bg-neutral-200 dark:text-neutral-800" href="https://preline.co/templates.html">
                        Free download
                        <svg class="hidden md:inline-block shrink-0 size-3.5 group-hover:translate-x-0.5 transition" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-focus:opacity-100 lg:group-focus:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:group-focus:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <!-- End Header -->

                  <!-- Body -->
                  <div class="px-3 max-h-64 sm:max-h-100 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                    <!-- Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/templates/agency/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews/img1.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews-dark/img1.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Agency
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 bg-gray-100 dark:bg-neutral-700 transition" href="https://preline.co/templates/ai-chat/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews/img4.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews-dark/img4.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          AI Chat
                        </p>

                        <div class="absolute -top-px end-[3px]">
                          <span class="py-0.5 px-2 inline-flex items-center gap-x-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full dark:bg-emerald-900 dark:text-emerald-500">New</span>
                        </div>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/templates/cms/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews/img5.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews-dark/img5.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          CMS
                        </p>

                        <div class="absolute -top-px end-[3px]">
                          <span class="py-0.5 px-2 inline-flex items-center gap-x-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full dark:bg-emerald-900 dark:text-emerald-500">New</span>
                        </div>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/templates/coffee-shop/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews/img2.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews-dark/img2.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Coffee Shop
                        </p>
                      </a>
                      <!-- End Link -->

                      <!-- Link -->
                      <a class="p-3 relative flex flex-col justify-center items-center gap-y-3 rounded-xl hover:bg-gray-100 focus:outline-hidden focus:bg-gray-100 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700  transition" href="https://preline.co/templates/personal/index.html">
                        <img class="dark:hidden w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews/img3.webp" alt="Main Page">
                        <img class="hidden dark:block w-28 rounded-lg shadow-xs" src="https://preline.co/assets/img/template-previews-dark/img3.webp" alt="Main Page">

                        <p class="text-sm text-center text-gray-800 dark:text-neutral-400">
                          Personal
                        </p>
                      </a>
                      <!-- End Link -->
                    </div>
                    <!-- End Grid -->
                  </div>
                  <!-- Body -->

                  <!-- Footer -->
                  <div class="p-3 flex flex-wrap justify-center items-center gap-0.5">
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/index.html">
                        Main page
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/examples.html">
                        Examples (220+<!-- 222 -->)
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                    <div class="relative ps-2 ms-1 first:ps-0 first:ms-0 first:before:hidden before:hidden md:before:block before:absolute before:top-1/2 before:start-0 before:w-px before:h-4 before:bg-gray-200 before:-translate-y-1/2 dark:before:bg-neutral-700">
                      <a class="group flex items-center gap-x-1.5 py-1.5 px-2 rounded-md text-[13px] text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" href="https://preline.co/templates.html">
                        Templates (5)
                        <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path class="lg:opacity-0 lg:-translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:transition" d="M5 12h14" />
                          <path class="lg:-translate-x-1.5 lg:group-hover:translate-x-0 lg:transition" d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <!-- End Footer -->
                </div>
                <!-- End Tab Content -->
              </div>
              <!-- End Dropdown -->
            </div>
            <!-- End Templates Dropdown -->
          </div>
        </div>

        <!-- Sidebar Toggle -->
        <button type="button" class="hidden md:hs-overlay-minified:hidden md:flex justify-center items-center flex-none gap-x-3 size-9 text-sm text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700" aria-haspopup="dialog" aria-expanded="true" aria-controls="hs-pro-sidebar" aria-label="Minify navigation" data-hs-overlay-minifier="#hs-pro-sidebar">
          <svg class="hidden hs-overlay-minified:block shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m8 9 3 3-3 3"></path>
          </svg>
          <svg class="hs-overlay-minified:hidden shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
            <path d="m10 15-3-3 3-3"></path>
          </svg>
          <span class="sr-only">Sidebar Toggle</span>
        </button>
        <!-- End Sidebar Toggle -->

        <!-- Sidebar Toggle -->
        <button type="button" class="flex md:hidden justify-center items-center gap-x-3 size-6 bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200" data-hs-overlay="#hs-pro-sidebar" aria-expanded="true">
          <svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
          <span class="sr-only">Close</span>
        </button>
        <!-- End Sidebar Toggle -->
      </header>
      <!-- End Header -->

      <div class="mb-5 px-2 flex flex-col gap-y-5">
        <!-- List -->
        <ul class="flex flex-col gap-y-0.5">
          <li>
            <a class="group relative w-full flex items-center gap-1 py-1.5 px-2.5 relative text-sm bg-gray-200/70 text-cyan-700 rounded-lg before:absolute before:inset-y-0 before:-start-2 before:rounded-e-full before:w-1 before:h-full before:bg-cyan-700 hover:bg-gray-200/70 focus:outline-hidden focus:bg-gray-200/70 dark:bg-neutral-700 dark:text-cyan-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:text-neutral-200 dark:before:bg-cyan-400" href="#">
              <span class="-ms-[5px] flex shrink-0 justify-center items-center size-6">
                <svg class="shrink-0 size-4 group-hover:scale-115 group-focus:scale-115 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </span>
              <span class="truncate hs-overlay-minified:opacity-0 transition-opacity duration-300">New chat</span>
            </a>
          </li>
          <li>
            <a class="group w-full flex items-center gap-1 py-1.5 px-2.5 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
              <span class="-ms-[5px] flex shrink-0 justify-center items-center size-6">
                <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path class="group-hover:scale-100 group-focus:scale-100 scale-115 scale-115 transition-transform duration-300" d="m21 21-4.34-4.34" />
                  <circle cx="11" cy="11" r="8" />
                </svg>
              </span>
              <span class="truncate hs-overlay-minified:opacity-0 transition-opacity duration-300">Search chats</span>
            </a>
          </li>
          <li>
            <a class="group relative w-full flex items-center gap-1 py-1.5 px-2.5 relative text-sm text-gray-800 rounded-lg before:absolute before:inset-y-0 before:-start-2 before:rounded-e-full before:w-1 before:h-full hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
              <span class="-ms-[5px] flex shrink-0 justify-center items-center size-6">
                <svg class="shrink-0 size-4 group-hover:rotate-180 group-focus:rotate-180 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </span>
              <span class="truncate hs-overlay-minified:opacity-0 transition-opacity duration-300">Explore</span>
            </a>
          </li>
          <li>
            <a class="group relative w-full flex items-center gap-1 py-1.5 px-2.5 relative text-sm text-gray-800 rounded-lg before:absolute before:inset-y-0 before:-start-2 before:rounded-e-full before:w-1 before:h-full hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
              <span class="-ms-[5px] flex shrink-0 justify-center items-center size-6">
                <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path class="group-hover:scale-110 group-focus:scale-110 transition-transform duration-300" d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
                  <path class="group-hover:scale-95 group-focus:scale-95 transition-transform duration-300" d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
                </svg>
              </span>
              <span class="truncate hs-overlay-minified:opacity-0 transition-opacity duration-300">Chat details</span>
            </a>
          </li>
        </ul>
        <!-- End List -->
      </div>

      <!-- Body -->
      <div class="hs-overlay-minified:opacity-0 transition-opacity duration-300 pb-4 px-2 size-full flex flex-col gap-y-5 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
        <div class="flex flex-col">
          <span class="block ps-2.5 mb-2 text-sm text-gray-400 dark:text-neutral-500">
            Recent chats
          </span>

          <!-- List -->
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Product Photography Lighting Setup</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid2" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid2">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Social Media Content</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid3" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid3">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Website Optimization</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid4" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid4">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Customer Support Ticket System</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid5" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid5">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Mobile App Design</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid6" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid6">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">E-commerce Payment Integration</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid7" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid7">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Data Analytics Dashboard Setup</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid8" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid8">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Video Production</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid9" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid9">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Project Management Timeline</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid10" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid10">
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
            <li>
              <div class="relative group">
                <a class="w-full flex items-center gap-x-2 py-2 ps-2.5 pe-8 text-sm text-gray-800 truncate rounded-lg hover:bg-gray-100/70 focus:outline-hidden focus:bg-gray-100/70 dark:hover:bg-neutral-700/50 dark:focus:bg-neutral-700/50 dark:text-neutral-200" href="#">
                  <span class="truncate">Brand Design System</span>
                </a>

                <div class="absolute top-1/2 end-0 z-1 -translate-y-1/2 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                  <!-- More Dropdown -->
                  <div class="hs-dropdown [--scope:window] relative inline-flex">
                    <button id="hs-pro-chthmdid11" type="button" class="flex justify-center items-center gap-x-3 size-8 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 dark:hover:text-neutral-200 dark:focus:text-neutral-200">
                      <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    <!-- More Dropdown -->
                    <div class="hs-dropdown-menu hs-dropdown-open:opacity-100 w-32 transition-[opacity,margin] duration opacity-0 hidden z-60 bg-white border border-gray-200 rounded-xl shadow-lg before:absolute before:-top-4 before:start-0 before:w-full before:h-5 dark:bg-neutral-950 dark:border-neutral-700" role="menu" aria-orientation="vertical" aria-labelledby="hs-pro-chthmdid11">
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
          <!-- End List -->
        </div>
      </div>
      <!-- End Body -->
    </div>
  </div>
</template>
<style scoped>
@reference "tailwindcss";
.active {
    @apply bg-gray-200/70 text-cyan-700 dark:bg-neutral-700 dark:text-cyan-400 before:absolute before:inset-y-0 before:-start-2 before:w-1 before:h-full before:rounded-e-full before:bg-cyan-700 dark:before:bg-cyan-400
}
</style>