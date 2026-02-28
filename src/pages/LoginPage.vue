<script setup>
import { reactive, ref } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const { userLogin } = useApp()
const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')
const rememberMe = ref(true)

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
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-3 sm:p-5">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_85%_12%,rgba(14,165,233,0.12),transparent_34%)]"></div>

    <div class="relative mx-auto flex w-full max-w-[1120px] rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm lg:min-h-[700px]">
      <section class="relative flex w-full rounded-2xl bg-white px-5 py-6 sm:px-7 sm:py-7 lg:w-[52%] lg:px-9 lg:py-7">
        <div class="mx-auto flex w-full max-w-[410px] flex-1 items-center">
          <div class="w-full">
            <h1 class="text-center font-heading text-[38px] font-bold leading-tight text-slate-900">Chào mừng trở lại</h1>
            <p class="mt-2.5 text-center text-[15px] leading-relaxed text-slate-500">Đăng nhập để truy cập hệ thống vận hành cửa hàng.</p>

            <form class="mt-6 space-y-3.5" @submit.prevent="submitData">
              <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {{ errorMessage }}
              </p>

              <div>
                <label for="username" class="mb-1.5 block text-sm font-semibold text-slate-700">Tài khoản</label>
                <input
                  id="username"
                  v-model="formData.username"
                  type="text"
                  class="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400"
                  placeholder="Nhập tài khoản"
                  autocomplete="username"
                />
              </div>

              <div>
                <label for="hs-toggle-password" class="mb-1.5 block text-sm font-semibold text-slate-700">Mật khẩu</label>
                <div class="relative">
                  <input
                    id="hs-toggle-password"
                    v-model="formData.password"
                    type="password"
                    class="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pe-10 text-[15px] text-slate-900 placeholder:text-slate-400"
                    placeholder="Nhập mật khẩu"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    data-hs-toggle-password='{"target": "#hs-toggle-password"}'
                    class="absolute inset-y-0 end-0 z-20 flex items-center px-3 text-slate-400 transition-colors hover:text-blue-600 cursor-pointer"
                    aria-label="Hiện hoặc ẩn mật khẩu"
                  >
                    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

              <div class="flex items-center justify-between text-sm">
                <label class="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                  <input v-model="rememberMe" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Ghi nhớ đăng nhập
                </label>
                <a href="#" class="font-semibold text-blue-600 hover:text-blue-700">Quên mật khẩu?</a>
              </div>

              <button
                type="submit"
                class="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-[15px] font-bold text-white transition duration-200 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
              >
                <span v-if="loading" class="inline-block size-5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="loading"></span>
                <span v-else>Đăng nhập</span>
              </button>
            </form>
          </div>
        </div>

        <div class="absolute bottom-6 left-5 right-5 flex items-center justify-between gap-3 text-xs text-slate-400 sm:bottom-7 sm:left-7 sm:right-7 lg:bottom-7 lg:left-9 lg:right-9">
          <span>© 2026 Hệ thống quản lý cửa hàng</span>
          <a href="#" class="hover:text-slate-500">Chính sách bảo mật</a>
        </div>
      </section>

      <section class="relative hidden overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-6 text-white lg:flex lg:w-[48%] lg:items-center lg:justify-center">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.12),transparent_42%)]"></div>
        <div class="pointer-events-none absolute inset-0 bg-[url('/src/assets/images/bg.jpeg')] bg-cover bg-center opacity-22 [mask-image:radial-gradient(circle_at_center,black_38%,transparent_78%)]"></div>
        <div class="absolute right-6 top-6 z-10 rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm">
          <img src="/src/assets/images/logo.png" alt="Hệ thống quản lý cửa hàng" class="h-5 w-auto" />
        </div>

        <div class="relative z-10 w-full max-w-[520px]">
          <div class="mx-auto max-w-[390px] text-center">
            <h2 class="font-heading text-[40px] font-semibold leading-[1.08]">Xử lý nhanh,kiểm soát tốt</h2>
            <p class="mt-2 text-[14px] leading-relaxed text-blue-100/95">Theo dõi ticket tập trung theo thời gian thực</p>
          </div>

          <div class="relative z-10 mt-8 rounded-2xl border border-white/30 bg-white/95 p-3.5 shadow-2xl">
            <div class="grid grid-cols-3 gap-2.5">
              <div class="rounded-xl bg-blue-700 p-2.5 text-white">
                <p class="text-xs opacity-90">Yêu cầu hôm nay</p>
                <p class="mt-1.5 text-2xl font-bold">24</p>
              </div>
              <div class="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                <p class="text-xs">Đang xử lý</p>
                <p class="mt-1.5 text-2xl font-bold text-slate-900">8</p>
              </div>
              <div class="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                <p class="text-xs">Hoàn tất</p>
                <p class="mt-1.5 text-2xl font-bold text-slate-900">16</p>
              </div>
            </div>

            <div class="mt-2.5 overflow-hidden rounded-xl border border-slate-200">
              <table class="w-full text-left text-xs text-slate-600">
                <thead class="bg-slate-50 text-slate-500">
                  <tr>
                    <th class="px-3 py-2 font-semibold">Mã</th>
                    <th class="px-3 py-2 font-semibold">Bộ phận</th>
                    <th class="px-3 py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-t border-slate-100">
                    <td class="px-3 py-2">TK-2104</td>
                    <td class="px-3 py-2">Kho vận</td>
                    <td class="px-3 py-2 text-amber-600">Chờ xử lý</td>
                  </tr>
                  <tr class="border-t border-slate-100">
                    <td class="px-3 py-2">TK-2103</td>
                    <td class="px-3 py-2">Kế toán</td>
                    <td class="px-3 py-2 text-emerald-600">Hoàn tất</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
