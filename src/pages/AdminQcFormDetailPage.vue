<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAdminQcFormById } from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const errorMessage = ref('')
const formDetail = ref(null)

const formId = computed(() => Number(route.params.id || 0))

const statusLabel = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'Đang phát hành'
  if (normalized === 'archived') return 'Lưu trữ'
  return 'Bản nháp'
}

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'published') return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  if (normalized === 'archived') return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
  return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
}

const criteriaRows = computed(() => {
  return Array.isArray(formDetail.value?.latestVersion?.criteria)
    ? formDetail.value.latestVersion.criteria
    : []
})

const latestVersionNote = computed(() => {
  const status = String(formDetail.value?.latestVersion?.status || '').toLowerCase()
  if (status === 'published') {
    return 'Đây là version đang phát hành và được dùng cho runtime QC.'
  }

  if (status === 'archived') {
    return 'Version này đã được lưu trữ và không còn là bản làm việc hiện tại.'
  }

  return 'Đây là bản nháp đang mở để tiếp tục chỉnh sửa trước khi phát hành.'
})

const loadFormDetail = async () => {
  if (!formId.value) {
    errorMessage.value = 'Mã biểu mẫu không hợp lệ'
    return
  }

  loading.value = true
  errorMessage.value = ''
  formDetail.value = null

  try {
    formDetail.value = await getAdminQcFormById(formId.value)
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || 'Không tải được chi tiết biểu mẫu QC'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/tools/qc-forms')
}

const openEditPage = () => {
  if (!formId.value) return
  router.push(`/tools/qc-forms/${formId.value}/edit`)
}

const openCreatePage = () => {
  router.push('/tools/qc-forms/create')
}

const showDeleteComingSoon = () => {
  toast.info('Tính năng xóa biểu mẫu sẽ được bổ sung ở màn hình này sau')
}

onMounted(async () => {
  await loadFormDetail()
})
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-3xl">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            @click="goBack"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách
          </button>
          <h2 class="mt-4 text-xl font-semibold tracking-tight text-slate-900">Chi tiết biểu mẫu QC</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            Màn hình này dành cho việc xem cấu trúc biểu mẫu, kiểm tra từng tiêu chí và mở rộng thêm preview hoặc lịch sử version sau này.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            @click="showDeleteComingSoon"
          >
            Xóa
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            @click="openEditPage"
          >
            Chỉnh sửa
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            @click="openCreatePage"
          >
            Tạo biểu mẫu mới
          </button>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ errorMessage }}
    </p>

    <div v-else-if="loading" class="rounded-xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
      Đang tải chi tiết biểu mẫu...
    </div>

    <template v-else-if="formDetail">
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-3xl">
            <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{{ formDetail.code }}</p>
            <h3 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{{ formDetail.name }}</h3>
            <p class="mt-3 text-sm leading-6 text-slate-500">{{ formDetail.description || 'Không có mô tả cho biểu mẫu này.' }}</p>
            <p class="mt-3 text-sm leading-6 text-slate-500">{{ latestVersionNote }}</p>
          </div>

          <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(formDetail.latestVersion?.status)">
            {{ statusLabel(formDetail.latestVersion?.status) }}
          </span>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Version hiện tại</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ formDetail.latestVersion?.versionNo || '--' }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Ngưỡng đạt</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ Number(formDetail.latestVersion?.passThreshold || 0) }}%</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Kích hoạt</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ formDetail.isActive ? 'Đang bật' : 'Đã tắt' }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Tổng node</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ formDetail.latestVersion?.criteriaCount || 0 }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Node chấm điểm</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ formDetail.latestVersion?.leafCriteriaCount || 0 }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <h3 class="text-base font-semibold text-slate-900">Cấu trúc biểu mẫu</h3>
          <p class="mt-1 text-sm text-slate-500">Preview theo đúng cây nhóm và tiêu chí sẽ xuất hiện trong màn chấm QC.</p>
        </div>

        <div v-if="criteriaRows.length" class="space-y-3 p-5">
          <article
            v-for="criterion in criteriaRows"
            :key="criterion.id"
            class="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
            :style="{ marginLeft: `${Math.max((criterion.level || 1) - 1, 0) * 18}px` }"
          >
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" :class="criterion.nodeType === 'group' ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-700'">
                    {{ criterion.nodeType === 'group' ? 'Nhóm' : 'Tiêu chí' }}
                  </span>
                  <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {{ criterion.ordering || '--' }}
                  </span>
                </div>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ criterion.name }}</p>
                <p class="mt-2 text-sm leading-6 text-slate-500">{{ criterion.description || 'Không có mô tả' }}</p>
              </div>

              <div class="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
                <p>Section: <span class="font-medium text-slate-900">{{ criterion.sectionName || 'Tổng quát' }}</span></p>
                <p>Cấp cây: <span class="font-medium text-slate-900">{{ criterion.level || 1 }}</span></p>
                <p>Kiểu chấm: <span class="font-medium text-slate-900">{{ criterion.nodeType === 'group' ? 'Node gom nhóm' : (criterion.mode === 'pass_fail' ? 'Đạt / Không đạt' : 'Chấm điểm') }}</span></p>
                <p>Điểm tối đa: <span class="font-medium text-slate-900">{{ criterion.nodeType === 'group' ? '--' : (criterion.mode === 'pass_fail' ? 1 : criterion.maxScore) }}</span></p>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="px-5 py-8 text-sm text-slate-500">
          Biểu mẫu này hiện chưa có tiêu chí nào.
        </div>
      </section>
    </template>
  </div>
</template>
