<script setup>
import { computed, reactive, ref } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const { userLogin } = useApp()
const toast = useToast()
const loading = ref(false)
const showPassword = ref(false)
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
  <div class="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f7f8]">
    <header class="z-50 flex w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 py-3.5 backdrop-blur-md md:px-6 md:py-4">
      <div class="flex items-center gap-3">
        <span class="text-[#136dec]">
          <svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48">
            <path fill="currentColor" fill-rule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" clip-rule="evenodd" />
          </svg>
        </span>
        <h1 class="text-lg font-bold tracking-tight text-slate-900">Trung tâm Điều hành Cửa hàng</h1>
      </div>
      <span class="text-sm font-medium text-slate-500">{{ appVersion }}</span>
    </header>

    <main class="flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
      <div class="w-full max-w-[440px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div class="mb-6 text-center md:mb-8">
          <div class="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#136dec]/10 text-[#136dec] md:mb-6 md:h-16 md:w-16">
            <svg class="h-8 w-8 md:h-9 md:w-9" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8.5 4.5 4h15L21 8.5" />
              <path d="M20 8.5v8.8A2.7 2.7 0 0 1 17.3 20H6.7A2.7 2.7 0 0 1 4 17.3V8.5" />
              <path d="M3 8.5h18" />
              <path d="M9 13h6" />
            </svg>
          </div>
          <h2 class="mb-1.5 text-2xl font-bold text-slate-900">Đăng nhập</h2>
          <p class="text-sm text-slate-500">Truy cập vào hệ thống quản trị cửa hàng của bạn</p>
        </div>

        <form class="space-y-4 md:space-y-5" @submit.prevent="submitData">
          <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {{ errorMessage }}
          </p>

          <div class="space-y-2">
            <label for="username" class="ml-1 block text-sm font-semibold text-slate-700">Tên đăng nhập</label>
            <input
              id="username"
              v-model="formData.username"
              type="text"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#136dec] focus:ring-2 focus:ring-[#136dec]/20"
              placeholder="Nhập tên đăng nhập của bạn"
              autocomplete="username"
            />
          </div>

          <div class="space-y-2">
            <div class="ml-1 flex items-center justify-between">
              <label for="password" class="text-sm font-semibold text-slate-700">Mật khẩu</label>
              <a href="#" class="text-xs font-medium text-[#136dec] hover:underline">Quên mật khẩu?</a>
            </div>
            <div class="relative">
              <input
                id="password"
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#136dec] focus:ring-2 focus:ring-[#136dec]/20"
                placeholder="••••••••"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              </button>
            </div>
          </div>

          <div class="pt-1">
            <button
              type="submit"
              class="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#136dec] py-3.5 font-bold text-white shadow-md shadow-[#136dec]/20 transition-all hover:bg-[#136dec]/90 disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="loading"
            >
              <span v-if="loading" class="inline-block size-5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="Đang tải"></span>
              <template v-else>
                <span>Đăng nhập</span>
                <svg class="h-4 w-4 transition-transform group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </template>
            </button>
          </div>
        </form>

        <div class="mt-6 border-t border-slate-100 pt-5 text-center md:mt-8 md:pt-6">
          <p class="mb-3 text-xs uppercase tracking-widest text-slate-400 md:mb-4">Hỗ trợ kỹ thuật</p>
          <div class="flex justify-center gap-6">
            <a href="#" class="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-[#136dec]">
              <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
                <path d="M12 17h.01" />
              </svg>
              <span class="text-sm font-medium">Trung tâm trợ giúp</span>
            </a>
            <a href="#" class="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-[#136dec]">
              <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span class="text-sm font-medium">Liên hệ</span>
            </a>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full shrink-0 py-3 text-center text-xs text-slate-400 md:py-4">
      <p>© 2023 Trung tâm Điều hành Cửa hàng. Tất cả quyền được bảo lưu.</p>
    </footer>
  </div>
</template>
