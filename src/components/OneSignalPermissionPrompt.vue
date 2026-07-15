<script setup>
import { computed, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'
import { useToast } from '@/plugins/toast'
import {
  enableOneSignalPush,
  initializeOneSignal,
  pushState,
} from '@/services/onesignal_service'

const { state } = useApp()
const toast = useToast()

const dismissed = ref(false)
const initializing = ref(false)
const enabling = ref(false)
const errorMessage = ref('')

const currentUserId = computed(() => (
  state.userInfo?.id || state.userInfo?.user_id || state.userInfo?.staff_id || null
))

const isSubscribed = computed(() => (
  pushState.permission === 'granted' &&
  pushState.optedIn &&
  Boolean(pushState.subscriptionId) &&
  Boolean(pushState.subscriptionToken)
))

const permissionDenied = computed(() => pushState.permission === 'denied')

const shouldShowPrompt = computed(() => (
  Boolean(state.token && currentUserId.value) &&
  pushState.configured &&
  pushState.supported &&
  !initializing.value &&
  (pushState.ready || Boolean(errorMessage.value)) &&
  !isSubscribed.value &&
  !dismissed.value
))

const prepareOneSignal = async () => {
  if (!state.userInfo || initializing.value) return
  initializing.value = true
  errorMessage.value = ''

  try {
    await initializeOneSignal()
  } catch (error) {
    errorMessage.value = error?.message || 'Không thể khởi tạo thông báo'
  } finally {
    initializing.value = false
  }
}

const enableNotifications = async () => {
  if (!state.userInfo || enabling.value || permissionDenied.value) return
  enabling.value = true
  errorMessage.value = ''

  try {
    const subscriptionId = await enableOneSignalPush(state.userInfo)
    if (subscriptionId) {
      dismissed.value = true
      toast.success('Đã đăng ký nhận thông báo')
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Không thể bật thông báo'
  } finally {
    enabling.value = false
  }
}

watch(
  currentUserId,
  () => {
    dismissed.value = false
    void prepareOneSignal()
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="shouldShowPrompt"
    class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4"
    role="presentation"
  >
    <section
      class="w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onesignal-prompt-title"
      aria-describedby="onesignal-prompt-description"
    >
      <div class="flex items-start gap-3">
        <div class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-softer)] text-[var(--primary)]">
          <span class="material-symbols-outlined text-[24px]" aria-hidden="true">notifications_active</span>
        </div>

        <div class="min-w-0 flex-1">
          <h2 id="onesignal-prompt-title" class="text-base font-semibold text-[var(--text-primary)]">
            Nhận thông báo từ hệ thống?
          </h2>
          <p
            id="onesignal-prompt-description"
            class="mt-1 text-sm leading-6 text-[var(--text-secondary)]"
          >
            Cho phép thông báo để không bỏ lỡ ticket mới và các phản hồi cần xử lý.
          </p>
        </div>
      </div>

      <p v-if="permissionDenied" class="mt-4 rounded-xl bg-[var(--danger-bg)] px-3 py-2 text-sm leading-5 text-[var(--danger-text)]">
        Trình duyệt đang chặn thông báo. Hãy mở Site settings và chuyển quyền Notification sang Allow.
      </p>
      <p v-else-if="errorMessage" class="mt-4 rounded-xl bg-[var(--danger-bg)] px-3 py-2 text-sm leading-5 text-[var(--danger-text)]">
        {{ errorMessage }}
      </p>

      <div class="mt-5 flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
        <button
          type="button"
          class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          @click="dismissed = true"
        >
          Để sau
        </button>
        <button
          v-if="!permissionDenied"
          type="button"
          class="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="enabling"
          @click="enableNotifications"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">notifications</span>
          {{ enabling ? 'Đang đăng ký...' : 'Bật thông báo' }}
        </button>
      </div>
    </section>
  </div>
</template>
