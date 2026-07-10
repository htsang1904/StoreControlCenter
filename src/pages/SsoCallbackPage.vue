<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const { userLoginBySsoTicket } = useApp()
const toast = useToast()

onMounted(async () => {
  const ticket = String(route.query.ticket || '').trim()
  if (!ticket) {
    toast.error('Thiếu SSO ticket. Vui lòng đăng nhập lại từ Suite.')
    setTimeout(() => router.replace('/login'), 1200)
    return
  }

  try {
    await userLoginBySsoTicket(ticket)
    toast.success('Đăng nhập thành công')
  } catch (err) {
    toast.error(err?.message || 'Đăng nhập thất bại')
    setTimeout(() => router.replace({ path: '/login', query: { error: 'sso_failed' } }), 1600)
  }
})
</script>

<template>
  <div class="flex h-[100dvh] items-center justify-center bg-[var(--app-bg)] p-4">
    <div class="w-full max-w-md rounded-xl border border-[var(--stroke)] bg-white p-6 text-center shadow-sm">
      <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--primary-softer)] text-[var(--primary)]">
        <span class="inline-block size-6 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Đang đăng nhập"></span>
      </div>
      <h1 class="text-lg font-bold text-[var(--text-primary)]">Đang đăng nhập bằng Suite</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Vui lòng chờ trong giây lát, hệ thống đang xác thực tài khoản của bạn.
      </p>
    </div>
  </div>
</template>
