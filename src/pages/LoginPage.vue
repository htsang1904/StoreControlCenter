<script setup>
import { computed, ref } from 'vue'
import { useToast } from '@/plugins/toast'
import appLogo from '@/assets/images/logo-color.png'

const toast = useToast()
const loading = ref(false)
const errorMessage = ref('')
const appVersion = computed(() => String(import.meta.env.VITE_APP_VERSION || 'v2.4.0'))

function buildSsoCallbackUrl() {
  const callbackPath = String(import.meta.env.VITE_SSO_CALLBACK_PATH || '/sso/callback')
  return `${window.location.origin}${callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`}`
}

function buildSuiteLoginUrl(redirectUri) {
  const suiteLoginUrl = String(import.meta.env.VITE_SUITE_LOGIN_URL || '').trim()
  if (!suiteLoginUrl) return ''

  const separator = suiteLoginUrl.includes('?') ? '&' : '?'
  return `${suiteLoginUrl}${separator}redirect_uri=${encodeURIComponent(redirectUri)}`
}

function redirectToSuiteSso() {
  const targetUrl = buildSuiteLoginUrl(buildSsoCallbackUrl())
  if (!targetUrl) {
    errorMessage.value = 'Thiếu cấu hình VITE_SUITE_LOGIN_URL'
    toast.error(errorMessage.value)
    return
  }

  loading.value = true
  window.location.assign(targetUrl)
}
</script>

<template>
  <div class="flex h-[100dvh] flex-col overflow-hidden bg-[var(--app-bg)]">
    <header class="z-50 flex w-full shrink-0 items-center justify-between border-b border-[var(--stroke)] bg-white px-5 py-3.5 tablet:px-6 tablet:py-4">
      <div class="flex items-center gap-3">
        <img :src="appLogo" alt="Store OPS" class="h-auto w-[132px] object-contain" />
      </div>
      <span class="text-sm font-medium text-[var(--text-secondary)]">{{ appVersion }}</span>
    </header>

    <main class="flex min-h-0 flex-1 items-center justify-center p-3 tablet:p-6">
      <div class="w-full max-w-[440px] rounded-xl border border-[var(--stroke)] bg-white p-5 tablet:p-8">
        <div class="mb-6 text-center tablet:mb-8">
          <div class="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-softer)] text-[var(--text-secondary)] tablet:mb-6 tablet:h-16 tablet:w-16">
            <svg class="h-8 w-8 tablet:h-9 tablet:w-9" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8.5 4.5 4h15L21 8.5" />
              <path d="M20 8.5v8.8A2.7 2.7 0 0 1 17.3 20H6.7A2.7 2.7 0 0 1 4 17.3V8.5" />
              <path d="M3 8.5h18" />
              <path d="M9 13h6" />
            </svg>
          </div>
          <h2 class="mb-1.5 text-2xl font-bold text-[var(--text-primary)]">Đăng nhập</h2>
          <p class="text-sm text-[var(--text-secondary)]">Truy cập vào hệ thống quản trị cửa hàng của bạn</p>
        </div>

        <div class="space-y-4 tablet:space-y-5">
          <p v-if="errorMessage" class="app-state-banner">
            {{ errorMessage }}
          </p>

          <button
            type="button"
            class="app-button-primary group flex w-full items-center justify-center gap-2 rounded-lg py-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="loading"
            @click="redirectToSuiteSso"
          >
            <span v-if="loading" class="inline-block size-5 animate-spin rounded-full border-2 border-white border-t-transparent" role="status" aria-label="Đang chuyển hướng"></span>
            <template v-else>
              <span>Đăng nhập bằng Suite</span>
              <svg class="h-4 w-4 transition-transform group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </template>
          </button>
        </div>

        <div class="mt-6 border-t border-[var(--stroke)] pt-5 text-center tablet:mt-8 tablet:pt-6">
          <p class="mb-3 text-xs uppercase tracking-widest text-[var(--text-muted)] tablet:mb-4">Hỗ trợ kỹ thuật</p>
          <div class="flex justify-center gap-6">
            <a href="#" class="flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-secondary)]">
              <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
                <path d="M12 17h.01" />
              </svg>
              <span class="text-sm font-medium">Trung tâm trợ giúp</span>
            </a>
            <a href="#" class="flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-secondary)]">
              <svg class="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span class="text-sm font-medium">Liên hệ</span>
            </a>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full shrink-0 py-3 text-center text-xs text-[var(--text-muted)] tablet:py-4">
      <p>© 2023 Store OPS. Tất cả quyền được bảo lưu.</p>
    </footer>
  </div>
</template>
