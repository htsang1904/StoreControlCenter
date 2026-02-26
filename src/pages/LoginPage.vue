<script setup>
import { reactive, ref } from 'vue'
import { useApp } from '@/plugins/app'
const { userLogin } = useApp()
const loading = ref(false)
const errorMessage = ref('')
const formData = reactive({
    username: '',
    password: '',
})
async function submitData() {
  errorMessage.value = ''
  loading.value = true
  try {
    await userLogin(formData)
  }
  catch (err) {
    errorMessage.value = err?.message || 'Đăng nhập thất bại'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg-[url('/src/assets/images/bg.jpeg')] bg-cover bg-no-repeat flex h-screen w-full items-center py-16 dark:bg-neutral-800">
    <div class="w-full max-w-md mx-auto p-6">
      <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <img src="/src/assets/images/logo.png" alt="Your Company" class="mx-auto h-7 w-auto" />
        <h2 class="mt-5 text-center text-2xl/9 font-bold tracking-tight text-white">Hệ thống quản lý cửa hàng</h2>
      </div>
      <div class="mt-7 bg-white border border-gray-200 rounded-xl shadow-2xs dark:bg-neutral-900 dark:border-neutral-700">
        <div class="p-4 sm:p-7">
          <div class="text-center">
            <h1 class="block text-2xl font-bold text-gray-700 dark:text-white">Đăng nhập</h1>
            <span class="text-[12px] text-gray-500 font-medium">Dùng tài khoản Suite để đăng nhập</span>
          </div>
          <div class="mt-5">
            <form @submit.prevent="submitData">
              <div class="grid gap-y-4">
                <p v-if="errorMessage" class="text-sm text-red-600">
                  {{ errorMessage }}
                </p>
  
                <div class="max-w-sm space-y-3">
                  <div class="relative">
                    <input class="peer py-2.5 sm:py-3 px-4 ps-11 block w-full bg-white border border-gray-200 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-700 dark:border-transparent dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" placeholder="Tài khoản" v-model="formData.username">
                    <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4 peer-disabled:opacity-50 peer-disabled:pointer-events-none">
                      <svg class="shrink-0 size-4 text-gray-500 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  </div>

                  <div class="relative">
                    <input id="hs-toggle-password" type="password" class="peer py-2.5 sm:py-3 px-4 ps-11 block w-full bg-white border border-gray-200 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-700 dark:border-transparent dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600" placeholder="Mật khẩu" v-model="formData.password">
                    <div class="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4 peer-disabled:opacity-50 peer-disabled:pointer-events-none">
                      <svg class="shrink-0 size-4 text-gray-500 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path>
                        <circle cx="16.5" cy="7.5" r=".5"></circle>
                      </svg>
                    </div>
                    <button type="button" data-hs-toggle-password='{
                        "target": "#hs-toggle-password"
                      }' class="absolute inset-y-0 end-0 flex items-center z-20 px-3 cursor-pointer text-gray-400 rounded-e-md focus:outline-hidden focus:text-blue-600 dark:text-neutral-600 dark:focus:text-blue-500">
                      <svg class="shrink-0 size-3.5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path class="hs-password-active:hidden" d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                        <path class="hs-password-active:hidden" d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                        <path class="hs-password-active:hidden" d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                        <line class="hs-password-active:hidden" x1="2" x2="22" y1="2" y2="22"></line>
                        <path class="hidden hs-password-active:block" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle class="hidden hs-password-active:block" cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="w-full text-center">
                  <button type="submit" class="w-full py-3 px-14 inline-flex justify-center items-center gap-x-2 text-[16px] font-bold rounded-lg border border-transparent bg-linear-to-r from-blue-600 to-blue-500 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none" :disabled="loading">
                    <span v-if="loading" class="animate-spin inline-block size-6 border-3 border-current border-t-transparent text-white rounded-full" role="status" aria-label="loading"></span>
                    <span v-else>Đăng nhập ngay</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
