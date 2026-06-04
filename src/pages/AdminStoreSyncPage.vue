<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { syncStoresNow } from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const router = useRouter()
const toast = useToast()

const syncingStores = ref(false)
const syncResult = ref(null)

const handleSyncStoresNow = async () => {
  if (syncingStores.value) return

  syncingStores.value = true
  try {
    const result = await syncStoresNow()
    syncResult.value = result?.data || {}
    toast.success(result?.message || 'Đồng bộ cửa hàng thành công')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể đồng bộ cửa hàng'
    toast.error(message)
  } finally {
    syncingStores.value = false
  }
}

const goBack = () => {
  router.push('/tools')
}
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section app-section--padded">
      <div class="app-page-header">
        <div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
            @click="goBack"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại công cụ
          </button>
          <h2 class="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Đồng bộ danh mục cửa hàng</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Chạy đồng bộ thủ công từ nguồn chính về backend để cập nhật danh sách cửa hàng hiện hành.
          </p>
        </div>

        <button
          type="button"
          class="inline-flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
          :disabled="syncingStores"
          @click="handleSyncStoresNow"
        >
          <span v-if="syncingStores" class="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
          {{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ ngay' }}
        </button>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-4 pc:grid-cols-[minmax(0,1.1fr)_320px]">
      <article class="app-section app-section--padded">
        <h3 class="text-base font-semibold text-[var(--text-primary)]">Kết quả lần chạy gần nhất</h3>

        <div
          v-if="syncResult"
          class="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-4"
        >
          <div class="rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Synced</p>
            <p class="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{{ Number(syncResult.synced || 0) }}</p>
          </div>
          <div class="rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Created</p>
            <p class="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{{ Number(syncResult.created || 0) }}</p>
          </div>
          <div class="rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Updated</p>
            <p class="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{{ Number(syncResult.updated || 0) }}</p>
          </div>
          <div class="rounded-lg border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Skipped</p>
            <p class="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{{ Number(syncResult.skipped || 0) }}</p>
          </div>
        </div>

        <div
          v-else
          class="mt-4"
        >
          <div class="app-state-panel app-state-panel--compact border-dashed border-[var(--stroke-strong)] bg-[var(--surface-muted)]">
            <div class="app-state-stack mx-auto">
              <div class="app-state-icon mx-auto">
                <span class="material-symbols-outlined text-[24px]">sync</span>
              </div>
              <p class="app-state-title">Chưa có lần chạy nào trong phiên hiện tại.</p>
              <p class="app-state-body">Bấm "Đồng bộ ngay" để bắt đầu cập nhật danh mục cửa hàng từ nguồn chính.</p>
            </div>
          </div>
        </div>
      </article>

      <aside class="app-section app-section--padded">
        <h3 class="text-base font-semibold text-[var(--text-primary)]">Lưu ý vận hành</h3>
        <ul class="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
          <li>Chỉ chạy khi cần cập nhật danh mục mới từ nguồn chính.</li>
          <li>Không cần chạy liên tục nếu dữ liệu store không thay đổi.</li>
          <li>Sau khi đồng bộ, các màn ticket và QC sẽ dùng danh mục đã cập nhật.</li>
        </ul>
      </aside>
    </section>
  </div>
</template>
