<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'
import { bindOneSignalUser, pushState, refreshOneSignalSubscriptionState } from '@/services/onesignal_service'

const { state } = useApp()
const dismissed = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const shouldShowPrompt = computed(() => (
  Boolean(state.token && state.userInfo) &&
  pushState.configured &&
  pushState.supported &&
  !pushState.subscribed &&
  !dismissed.value
))

const permissionDenied = computed(() => pushState.permission === 'denied')

const enableNotifications = async () => {
  if (!state.userInfo || loading.value || permissionDenied.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await bindOneSignalUser(state.userInfo, { requestPermission: true })
    await refreshOneSignalSubscriptionState()
    if (pushState.subscribed) dismissed.value = true
    else errorMessage.value = 'Chưa bật được thông báo. Vui lòng kiểm tra quyền thông báo của trình duyệt.'
  } catch (error) {
    errorMessage.value = error?.message || 'Không thể bật thông báo. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}

watch(
  () => state.userInfo?.id,
  () => {
    dismissed.value = false
    void refreshOneSignalSubscriptionState()
  },
  { immediate: true }
)

onMounted(() => {
  void refreshOneSignalSubscriptionState()
})
</script>

<template>
  <div
    v-if="shouldShowPrompt"
    class="fixed inset-x-3 top-3 z-[100] mx-auto max-w-xl rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-2xl tablet:top-5"
    role="dialog"
    aria-labelledby="push-permission-title"
    aria-live="polite"
  >
    <div class="flex items-start gap-3">
      <div class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-softer)] text-[var(--primary)]">
        <span class="material-symbols-outlined text-[22px]">notifications_active</span>
      </div>
      <div class="min-w-0 flex-1">
        <p id="push-permission-title" class="text-sm font-semibold text-[var(--text-primary)]">Bật thông báo trên máy tính</p>
        <p v-if="permissionDenied" class="mt-1 text-xs leading-5 text-[var(--danger-text)]">
          Trình duyệt đang chặn thông báo. Vui lòng mở Site settings và cho phép Notification cho website này.
        </p>
        <p v-else class="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Bật thông báo để nhận cảnh báo ticket mới và phản hồi mới kịp thời.
        </p>
        <p v-if="errorMessage" class="mt-1 text-xs leading-5 text-[var(--danger-text)]">{{ errorMessage }}</p>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
        @click="dismissed = true"
      >
        Để sau
      </button>
      <button
        type="button"
        class="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading || permissionDenied"
        @click="enableNotifications"
      >
        {{ loading ? 'Đang bật...' : 'Bật thông báo' }}
      </button>
    </div>
  </div>
</template>
