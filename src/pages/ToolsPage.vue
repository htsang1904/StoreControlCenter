<script setup>
import { ref } from 'vue'
import { syncStoresNow } from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const toast = useToast()
const syncingStores = ref(false)
const syncResult = ref(null)

const handleSyncStoresNow = async () => {
  if (syncingStores.value) return

  syncingStores.value = true
  try {
    const result = await syncStoresNow()
    const payload = result?.data || {}
    syncResult.value = payload
    toast.success(result?.message || 'Đồng bộ cửa hàng thành công')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể đồng bộ cửa hàng'
    toast.error(message)
  } finally {
    syncingStores.value = false
  }
}
</script>

<template>
  <div>
    <div class="header mx-4 flex items-center">
      Công cụ hệ thống
    </div>

    <div class="page-stack mx-4">
      <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-800">Đồng bộ danh mục cửa hàng</h2>
            <p class="mt-1 text-sm text-slate-500">
              Gọi đồng bộ ngay từ nguồn chính về server.
            </p>
          </div>

          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-x-2 rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="syncingStores"
            @click="handleSyncStoresNow"
          >
            <span v-if="syncingStores" class="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            <span>{{ syncingStores ? 'Đang đồng bộ...' : 'Đồng bộ ngay' }}</span>
          </button>
        </div>

        <div v-if="syncResult" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-sm font-semibold text-slate-700">Kết quả lần chạy gần nhất</p>
          <div class="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
            <p>Synced: <span class="font-semibold text-slate-800">{{ Number(syncResult.synced || 0) }}</span></p>
            <p>Created: <span class="font-semibold text-slate-800">{{ Number(syncResult.created || 0) }}</span></p>
            <p>Updated: <span class="font-semibold text-slate-800">{{ Number(syncResult.updated || 0) }}</span></p>
            <p>Skipped: <span class="font-semibold text-slate-800">{{ Number(syncResult.skipped || 0) }}</span></p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
