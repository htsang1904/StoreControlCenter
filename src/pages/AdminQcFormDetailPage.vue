<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmDialog } from '@/composables/useConfirmDialog'
import { deleteAdminQcForm, getAdminQcFormById } from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const deleting = ref(false)
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
  if (normalized === 'published') return 'app-badge--success'
  if (normalized === 'archived') return 'app-badge--neutral'
  return 'app-badge--warning'
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

const deleteForm = async () => {
  if (!formId.value || deleting.value) return

  const formName = formDetail.value?.name || 'biểu mẫu QC này'
  const confirmed = await confirmDialog({
    title: 'Xóa biểu mẫu QC?',
    message: `Bạn có chắc muốn xóa ${formName}? Thao tác này chỉ thành công khi biểu mẫu chưa có phiếu QC liên quan.`,
    confirmText: 'Xóa biểu mẫu',
    cancelText: 'Huỷ',
    tone: 'danger',
  })
  if (!confirmed) return

  deleting.value = true
  errorMessage.value = ''

  try {
    await deleteAdminQcForm(formId.value)
    toast.success('Đã xóa biểu mẫu QC')
    router.push('/tools/qc-forms')
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Không thể xóa biểu mẫu QC'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await loadFormDetail()
})
</script>

<template>
  <div class="app-page page-stack">
    <section class="app-section app-section--padded">
      <div class="app-page-header">
        <div class="min-w-0 max-w-3xl tablet:flex-1">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)]"
            @click="goBack"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách
          </button>
          <h2 class="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Chi tiết biểu mẫu QC</h2>
          <p class="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Màn hình này dành cho việc xem cấu trúc biểu mẫu, kiểm tra từng tiêu chí và mở rộng thêm preview hoặc lịch sử version sau này.
          </p>
        </div>

        <div class="app-toolbar w-full tablet:w-auto tablet:shrink-0 tablet:flex-wrap tablet:justify-end">
          <button
            type="button"
            :disabled="deleting"
            class="inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:w-auto"
            @click="deleteForm"
          >
            {{ deleting ? 'Đang xóa...' : 'Xóa' }}
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center rounded-lg border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] tablet:w-auto"
            @click="openEditPage"
          >
            Chỉnh sửa
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] tablet:w-auto"
            @click="openCreatePage"
          >
            Tạo biểu mẫu mới
          </button>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="app-state-banner">
      {{ errorMessage }}
    </p>

    <div v-else-if="loading" class="app-state-panel app-state-panel--center">
      <div class="app-state-stack">
        <div class="app-state-icon mx-auto">
          <span class="material-symbols-outlined text-[24px]">description</span>
        </div>
        <p class="app-state-title">Đang tải chi tiết biểu mẫu...</p>
        <p class="app-state-body">Thông tin biểu mẫu và cấu trúc tiêu chí sẽ xuất hiện sau khi tải xong.</p>
      </div>
    </div>

    <template v-else-if="formDetail">
      <section class="app-section app-section--padded">
        <div class="app-page-header">
          <div class="min-w-0 max-w-3xl tablet:flex-1">
            <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">{{ formDetail.code }}</p>
            <h3 class="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{{ formDetail.name }}</h3>
            <p class="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{{ formDetail.description || 'Không có mô tả cho biểu mẫu này.' }}</p>
            <p class="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{{ latestVersionNote }}</p>
          </div>

          <span class="app-badge inline-flex items-center self-start rounded-lg px-2.5 py-1 text-xs font-semibold tablet:shrink-0" :class="statusClass(formDetail.latestVersion?.status)">
            {{ statusLabel(formDetail.latestVersion?.status) }}
          </span>
        </div>

        <div class="mt-6 grid gap-4 tablet:grid-cols-2 pc:grid-cols-5">
          <div class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Version hiện tại</p>
            <p class="mt-2 text-lg font-semibold text-[var(--text-primary)]">{{ formDetail.latestVersion?.versionNo || '--' }}</p>
          </div>
          <div class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Ngưỡng đạt</p>
            <p class="mt-2 text-lg font-semibold text-[var(--text-primary)]">{{ Number(formDetail.latestVersion?.passThreshold || 0) }}%</p>
          </div>
          <div class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Kích hoạt</p>
            <p class="mt-2 text-lg font-semibold text-[var(--text-primary)]">{{ formDetail.isActive ? 'Đang bật' : 'Đã tắt' }}</p>
          </div>
          <div class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Tổng node</p>
            <p class="mt-2 text-lg font-semibold text-[var(--text-primary)]">{{ formDetail.latestVersion?.criteriaCount || 0 }}</p>
          </div>
          <div class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Node chấm điểm</p>
            <p class="mt-2 text-lg font-semibold text-[var(--text-primary)]">{{ formDetail.latestVersion?.leafCriteriaCount || 0 }}</p>
          </div>
        </div>
      </section>

      <section class="app-section">
        <div class="app-section-header">
          <h3 class="text-base font-semibold text-[var(--text-primary)]">Cấu trúc biểu mẫu</h3>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">Preview theo đúng cây nhóm và tiêu chí sẽ xuất hiện trong màn chấm QC.</p>
        </div>

        <div v-if="criteriaRows.length" class="space-y-3 p-4 tablet:p-5">
          <article
            v-for="criterion in criteriaRows"
            :key="criterion.id"
            class="rounded-xl border border-[var(--stroke)] bg-[var(--surface-muted)]/40 p-4"
            :style="{ marginLeft: `${Math.max((criterion.level || 1) - 1, 0) * 18}px` }"
          >
            <div class="grid gap-3 pc:grid-cols-[minmax(0,1fr)_280px]">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" :class="criterion.nodeType === 'group' ? 'bg-[var(--primary-soft)] text-[var(--text-secondary)]' : 'bg-[var(--primary-softer)] text-[var(--text-secondary)]'">
                    {{ criterion.nodeType === 'group' ? 'Nhóm' : 'Tiêu chí' }}
                  </span>
                  <span class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {{ criterion.ordering || '--' }}
                  </span>
                </div>
                <p class="mt-2 text-sm font-semibold text-[var(--text-primary)]">{{ criterion.name }}</p>
                <p class="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{{ criterion.description || 'Không có mô tả' }}</p>
              </div>

              <div class="grid gap-2 text-sm text-[var(--text-secondary)] tablet:grid-cols-2 pc:grid-cols-1">
                <p>Section: <span class="font-medium text-[var(--text-primary)]">{{ criterion.sectionName || 'Tổng quát' }}</span></p>
                <p>Cấp cây: <span class="font-medium text-[var(--text-primary)]">{{ criterion.level || 1 }}</span></p>
                <p>Kiểu chấm: <span class="font-medium text-[var(--text-primary)]">{{ criterion.nodeType === 'group' ? 'Node gom nhóm' : (criterion.mode === 'pass_fail' ? 'Đạt / Không đạt' : 'Chấm điểm') }}</span></p>
                <p>Điểm tối đa: <span class="font-medium text-[var(--text-primary)]">{{ criterion.nodeType === 'group' ? '--' : (criterion.mode === 'pass_fail' ? 1 : criterion.maxScore) }}</span></p>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="px-4 py-8 tablet:px-5">
          <div class="app-state-panel app-state-panel--compact">
            <div class="app-state-stack mx-auto">
              <div class="app-state-icon mx-auto">
                <span class="material-symbols-outlined text-[24px]">account_tree</span>
              </div>
              <p class="app-state-title">Biểu mẫu này chưa có tiêu chí nào.</p>
              <p class="app-state-body">Thêm nhóm hoặc tiêu chí trong màn chỉnh sửa để hoàn thiện cấu trúc biểu mẫu.</p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
