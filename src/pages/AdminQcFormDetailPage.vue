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

const criteriaGroups = computed(() => {
  const criteria = Array.isArray(formDetail.value?.latestVersion?.criteria)
    ? formDetail.value.latestVersion.criteria
    : []

  const groups = new Map()
  for (const criterion of criteria) {
    const sectionName = String(criterion?.sectionName || 'Tổng quát')
    if (!groups.has(sectionName)) groups.set(sectionName, [])
    groups.get(sectionName).push(criterion)
  }

  return Array.from(groups.entries()).map(([sectionName, items]) => ({
    sectionName,
    items,
  }))
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
          </div>

          <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusClass(formDetail.latestVersion?.status)">
            {{ statusLabel(formDetail.latestVersion?.status) }}
          </span>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <p class="text-xs uppercase tracking-wide text-slate-500">Số tiêu chí</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ formDetail.latestVersion?.criteria?.length || 0 }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <h3 class="text-base font-semibold text-slate-900">Cấu trúc biểu mẫu</h3>
          <p class="mt-1 text-sm text-slate-500">Hiển thị theo từng nhóm tiêu chí để tiện xem như một bản preview nghiệp vụ.</p>
        </div>

        <div v-if="criteriaGroups.length" class="space-y-5 p-5">
          <section
            v-for="group in criteriaGroups"
            :key="group.sectionName"
            class="rounded-xl border border-slate-200"
          >
            <div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h4 class="text-sm font-semibold text-slate-900">{{ group.sectionName }}</h4>
            </div>

            <div class="divide-y divide-slate-100">
              <article
                v-for="criterion in group.items"
                :key="criterion.id"
                class="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px]"
              >
                <div class="min-w-0">
                  <p class="text-xs uppercase tracking-wide text-slate-500">{{ criterion.code }}</p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">{{ criterion.name }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-500">{{ criterion.description || 'Không có mô tả' }}</p>
                </div>

                <div class="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
                  <p>Kiểu chấm: <span class="font-medium text-slate-900">{{ criterion.mode === 'pass_fail' ? 'Đạt / Không đạt' : 'Chấm điểm' }}</span></p>
                  <p>Điểm tối đa: <span class="font-medium text-slate-900">{{ criterion.mode === 'pass_fail' ? 1 : criterion.maxScore }}</span></p>
                  <p>Trọng số: <span class="font-medium text-slate-900">{{ criterion.weight }}</span></p>
                  <p>Tần suất: <span class="font-medium text-slate-900">{{ criterion.frequency === 'weekly_once' ? 'Mỗi tuần một lần' : 'Mỗi lần kiểm' }}</span></p>
                  <p>Trọng yếu: <span class="font-medium text-slate-900">{{ criterion.isCritical ? 'Có' : 'Không' }}</span></p>
                  <p>Bắt buộc: <span class="font-medium text-slate-900">{{ criterion.required ? 'Có' : 'Không' }}</span></p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div v-else class="px-5 py-8 text-sm text-slate-500">
          Biểu mẫu này hiện chưa có tiêu chí nào.
        </div>
      </section>
    </template>
  </div>
</template>
