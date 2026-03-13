<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAdminQcForms } from '@/services/admin_service'

const router = useRouter()

const loadingForms = ref(false)
const formsError = ref('')
const qcForms = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const totalForms = ref(0)
const pageCount = ref(1)
const activeActionMenuId = ref(null)

const rangeStart = computed(() => {
  if (!qcForms.value.length) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})

const rangeEnd = computed(() => {
  if (!qcForms.value.length) return 0
  return rangeStart.value + qcForms.value.length - 1
})

const visiblePageItems = computed(() => {
  const total = pageCount.value
  const page = currentPage.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'end-ellipsis', total]
  }

  if (page >= total - 3) {
    return [1, 'start-ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'start-ellipsis', page - 1, page, page + 1, 'end-ellipsis', total]
})

const formatDisplayDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const statusLabel = (status, hasLatestVersion = true) => {
  if (!hasLatestVersion) return 'Chưa có version'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'Đang phát hành'
  if (normalized === 'archived') return 'Lưu trữ'
  return 'Bản nháp'
}

const statusClass = (status, hasLatestVersion = true) => {
  if (!hasLatestVersion) return 'app-badge--neutral'
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'app-badge--success'
  if (normalized === 'archived') return 'app-badge--neutral'
  return 'app-badge--warning'
}

const loadQcForms = async (page = currentPage.value) => {
  loadingForms.value = true
  formsError.value = ''

  try {
    const response = await listAdminQcForms({
      page,
      pageSize: pageSize.value,
    })
    qcForms.value = response.items
    currentPage.value = response.pagination.page
    totalForms.value = response.pagination.total
    pageCount.value = response.pagination.pageCount
  } catch (error) {
    qcForms.value = []
    totalForms.value = 0
    pageCount.value = 1
    formsError.value = error?.response?.data?.message || error?.message || 'Không tải được danh sách biểu mẫu QC'
  } finally {
    loadingForms.value = false
  }
}

const openCreatePage = () => {
  router.push('/tools/qc-forms/create')
}

const openFormDetail = (formId) => {
  if (!formId) return
  activeActionMenuId.value = null
  router.push(`/tools/qc-forms/${formId}`)
}

const openEditPage = (formId) => {
  if (!formId) return
  activeActionMenuId.value = null
  router.push(`/tools/qc-forms/${formId}/edit`)
}

const toggleActionMenu = (formId) => {
  if (!formId) return
  activeActionMenuId.value = activeActionMenuId.value === formId ? null : formId
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const handleDocumentClick = (event) => {
  if (!(event.target instanceof Element)) {
    closeActionMenu()
    return
  }

  if (event.target.closest('[data-qc-form-action-menu]')) return
  closeActionMenu()
}

const goToPage = async (page) => {
  if (loadingForms.value) return
  if (page < 1 || page > pageCount.value || page === currentPage.value) return
  closeActionMenu()
  await loadQcForms(page)
}

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  await loadQcForms()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="page-stack space-y-4">
    <section class="rounded-xl border border-slate-200 bg-white px-5 py-5 tablet:px-6">
      <div class="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
        <div class="max-w-3xl">
          <h2 class="text-xl font-semibold tracking-tight text-slate-900">Quản lý biểu mẫu QC</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            Danh sách biểu mẫu hiện có của hệ thống.
          </p>
        </div>

        <button
          type="button"
          class="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 tablet:w-auto"
          @click="openCreatePage"
        >
          Tạo biểu mẫu
        </button>
      </div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
        <h3 class="text-base font-semibold text-slate-900">Danh sách biểu mẫu QC</h3>
        <p class="mt-1 text-sm text-slate-500">
          Bấm vào từng dòng để mở trang chi tiết biểu mẫu.
          <span v-if="totalForms" class="ml-1 text-slate-400">Hiển thị {{ rangeStart }}-{{ rangeEnd }} / {{ totalForms }} biểu mẫu.</span>
        </p>
      </div>

      <p v-if="formsError" class="app-state-banner m-4 mb-0">
        {{ formsError }}
      </p>

      <div class="pc:hidden">
        <div v-if="qcForms.length" class="divide-y divide-slate-100">
          <article
            v-for="form in qcForms"
            :key="form.id"
            class="px-4 py-4 tablet:px-5"
          >
            <div class="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ form.code }}</p>
                <button
                  type="button"
                  class="mt-2 block text-left"
                  @click="openFormDetail(form.id)"
                >
                  <p class="text-base font-semibold text-slate-900 transition-colors hover:text-slate-700">
                    {{ form.name }}
                  </p>
                </button>
                <p class="mt-1 text-sm leading-6 text-slate-500">
                  {{ form.description || 'Không có mô tả' }}
                </p>
              </div>

              <span
                class="app-badge inline-flex w-fit items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                :class="statusClass(form.latestVersionStatus, form.hasLatestVersion)"
              >
                {{ statusLabel(form.latestVersionStatus, form.hasLatestVersion) }}
              </span>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-2">
              <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Version mới nhất</p>
                <p class="mt-1 text-sm font-semibold text-slate-900">{{ form.latestVersionNo || '--' }}</p>
              </div>

              <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cập nhật</p>
                <p class="mt-1 text-sm font-semibold text-slate-900">{{ formatDisplayDate(form.updatedAt) }}</p>
              </div>
            </div>

            <div class="mt-4 flex flex-col gap-2 tablet:flex-row">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 tablet:flex-1"
                @click="openFormDetail(form.id)"
              >
                <span class="material-symbols-outlined text-[18px] text-slate-400">visibility</span>
                Xem chi tiết
              </button>

              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 tablet:flex-1"
                @click="openEditPage(form.id)"
              >
                <span class="material-symbols-outlined text-[18px]">edit</span>
                Chỉnh sửa
              </button>
            </div>
          </article>
        </div>

        <div v-else class="px-4 py-10 tablet:px-5">
          <div class="app-state-panel app-state-panel--compact">
            <div class="app-state-stack mx-auto">
              <div class="app-state-icon mx-auto">
                <span class="material-symbols-outlined text-[24px]">{{ loadingForms ? 'inventory_2' : 'inventory_2' }}</span>
              </div>
              <p class="app-state-title">{{ loadingForms ? 'Đang tải danh sách biểu mẫu...' : 'Chưa có biểu mẫu QC nào.' }}</p>
              <p class="app-state-body">{{ loadingForms ? 'Danh sách biểu mẫu sẽ xuất hiện sau khi tải xong.' : 'Tạo biểu mẫu mới để bắt đầu xây dựng checklist QC cho hệ thống.' }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="hidden overflow-x-auto pc:block">
        <table class="min-w-[920px] w-full border-collapse text-left">
          <thead>
            <tr class="bg-slate-50">
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Mã biểu mẫu</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tên biểu mẫu</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Version mới nhất</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</th>
              <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Cập nhật</th>
              <th class="px-4 py-3 text-end text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
            </tr>
          </thead>

          <tbody v-if="qcForms.length" class="divide-y divide-slate-100">
            <tr
              v-for="form in qcForms"
              :key="form.id"
              class="cursor-pointer transition-colors hover:bg-slate-50/80"
              @click="openFormDetail(form.id)"
            >
              <td class="px-4 py-3 text-sm font-semibold text-slate-900">{{ form.code }}</td>
              <td class="px-4 py-3">
                <p class="text-sm font-medium text-slate-900">{{ form.name }}</p>
                <p class="text-xs text-slate-500">{{ form.description || 'Không có mô tả' }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-slate-600">{{ form.latestVersionNo || '--' }}</td>
              <td class="px-4 py-3">
                <span class="app-badge inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(form.latestVersionStatus, form.hasLatestVersion)">
                  {{ statusLabel(form.latestVersionStatus, form.hasLatestVersion) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-slate-500">{{ formatDisplayDate(form.updatedAt) }}</td>
              <td class="px-4 py-3">
                <div class="relative flex items-center justify-end" data-qc-form-action-menu>
                  <button
                    type="button"
                    class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                    aria-label="Mở menu thao tác"
                    :aria-expanded="activeActionMenuId === form.id"
                    @click.stop="toggleActionMenu(form.id)"
                  >
                    <span class="material-symbols-outlined text-[18px]">more_horiz</span>
                  </button>

                  <div
                    v-if="activeActionMenuId === form.id"
                    class="absolute right-0 top-full z-20 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      @click.stop="openFormDetail(form.id)"
                    >
                      <span class="material-symbols-outlined text-[18px] text-slate-400">visibility</span>
                      Xem
                    </button>
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      @click.stop="openEditPage(form.id)"
                    >
                      <span class="material-symbols-outlined text-[18px] text-slate-400">edit</span>
                      Chỉnh sửa
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="6" class="px-4 py-10">
                <div class="app-state-panel app-state-panel--compact">
                  <div class="app-state-stack mx-auto">
                    <div class="app-state-icon mx-auto">
                      <span class="material-symbols-outlined text-[24px]">inventory_2</span>
                    </div>
                    <p class="app-state-title">{{ loadingForms ? 'Đang tải danh sách biểu mẫu...' : 'Chưa có biểu mẫu QC nào.' }}</p>
                    <p class="app-state-body">{{ loadingForms ? 'Danh sách biểu mẫu sẽ xuất hiện sau khi tải xong.' : 'Tạo biểu mẫu mới để bắt đầu xây dựng checklist QC cho hệ thống.' }}</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 tablet:flex-row tablet:items-center tablet:justify-between">
        <p class="text-sm text-slate-500">
          Hiển thị
          <span class="font-semibold text-slate-800">{{ rangeStart }}-{{ rangeEnd }}</span>
          trong
          <span class="font-semibold text-slate-800">{{ totalForms }}</span>
          kết quả
        </p>

        <div class="flex max-w-full items-center justify-between gap-3 tablet:justify-end">
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            :disabled="currentPage <= 1 || loadingForms"
            @click="goToPage(currentPage - 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div class="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
            <template v-for="item in visiblePageItems" :key="String(item)">
              <button
                v-if="typeof item === 'number'"
                type="button"
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                :class="item === currentPage ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'"
                :disabled="item === currentPage || loadingForms"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
              <span v-else class="px-1 text-xs text-slate-400">...</span>
            </template>
          </div>

          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            :disabled="currentPage >= pageCount || loadingForms || pageCount === 0"
            @click="goToPage(currentPage + 1)"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
