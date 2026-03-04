<script setup>
import { computed, reactive, ref } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const { userLogin } = useApp()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')
const appVersion = computed(() => String(import.meta.env.VITE_APP_VERSION || 'v2.4.0'))

const formData = reactive({
  username: '',
  password: '',
})

async function submitData() {
  errorMessage.value = ''
  loading.value = true
  try {
    await userLogin(formData)
    toast.success('Đăng nhập thành công')
  } catch (err) {
    errorMessage.value = err?.message || 'Đăng nhập thất bại'
    toast.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#eef0f3] p-3 sm:p-5">
    <div class="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1400px] flex-col rounded-2xl border border-slate-300 bg-[#f7f8fa] shadow-[0_12px_42px_rgba(15,23,42,0.08)] sm:min-h-[calc(100vh-2.5rem)]">
      <header class="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div class="flex items-center gap-3">
          <span class="inline-flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <svg class="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 1.8 12 12 22l10.2-10L12 2Zm0 3.5 6.6 6.5H5.4L12 5.5Z" />
            </svg>
          </span>
          <p class="text-[18px] font-semibold text-slate-900">Store Control Center</p>
        </div>
        <p class="text-[15px] font-semibold text-slate-500">{{ appVersion }}</p>
      </header>

      <main class="flex flex-1 items-start justify-center px-4 py-8 sm:py-10">
        <section class="w-full max-w-[420px] rounded-2xl border border-slate-300 bg-white px-6 py-7 shadow-sm sm:px-7 sm:py-8">
          <div class="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-blue-100/70 text-blue-600">
            <svg class="size-8" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8.5 4.5 4h15L21 8.5" />
              <path d="M20 8.5v8.8A2.7 2.7 0 0 1 17.3 20H6.7A2.7 2.7 0 0 1 4 17.3V8.5" />
              <path d="M3 8.5h18" />
              <path d="M9 13h6" />
            </svg>
          </div>
          <h1 class="text-center text-4xl font-bold text-slate-900">Đăng nhập</h1>
          <p class="mt-2 text-center text-[15px] text-slate-500">Truy cập vào hệ thống quản trị cửa hàng của bạn</p>

          <form class="mt-6 space-y-4" @submit.prevent="submitData">
            <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ errorMessage }}
            </p>

            <div>
              <label for="username" class="mb-1.5 block text-[15px] font-semibold text-slate-700">Tên đăng nhập</label>
              <input
                id="username"
                v-model="formData.username"
                type="text"
                class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-[16px] text-slate-900 placeholder:text-slate-400"
                placeholder="Nhập tên đăng nhập của bạn"
                autocomplete="username"
              />
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between gap-2">
                <label for="hs-toggle-password" class="text-[15px] font-semibold text-slate-700">Mật khẩu</label>
                <a href="#" class="text-[14px] font-semibold text-blue-600 hover:text-blue-700">Quên mật khẩu?</a>
              </div>
              <div class="relative">
                <input
                  id="hs-toggle-password"
                  v-model="formData.password"
                  type="password"
                  class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 pe-11 text-[16px] text-slate-900 placeholder:text-slate-400"
                  placeholder="Nhập mật khẩu của bạn"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  data-hs-toggle-password='{"target": "#hs-toggle-password"}'
                  class="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center px-3 text-slate-400 transition-colors hover:text-blue-600"
                  aria-label="Hiện hoặc ẩn mật khẩu"
                >
                  <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

            <button
              type="submit"
              class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-[19px] font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
            >
              <span v-if="loading" class="inline-block size-5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="loading"></span>
              <span v-else>Đăng nhập</span>
              <svg v-if="!loading" class="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </form>

          <div class="mt-7 border-t border-slate-200 pt-6 text-center">
            <p class="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hỗ trợ kỹ thuật</p>
            <div class="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[16px] text-slate-600">
              <a href="#" class="inline-flex items-center gap-2 hover:text-slate-800">
                <svg class="size-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
                  <path d="M12 17h.01" />
                </svg>
                Trung tâm trợ giúp
              </a>
              <a href="#" class="inline-flex items-center gap-2 hover:text-slate-800">
                <svg class="size-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Liên hệ
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer class="pb-6 text-center text-[14px] text-slate-400">
        © 2023 Store Control Center. Tất cả quyền được bảo lưu.
      </footer>
    </div>
  </div>
</template>
