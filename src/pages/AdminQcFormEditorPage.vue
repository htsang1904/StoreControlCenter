<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createAdminQcForm,
  getAdminQcFormById,
  updateAdminQcForm,
} from '@/services/admin_service'
import { useToast } from '@/plugins/toast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const savingForm = ref(false)
const loadingForm = ref(false)
const loadError = ref('')

let criterionSeed = 0

const createCriterionItem = (overrides = {}) => {
  criterionSeed += 1
  return {
    id: overrides.id || `criterion-${criterionSeed}`,
    code: overrides.code || '',
    name: overrides.name || '',
    sectionName: overrides.sectionName || 'Tổng quát',
    description: overrides.description || '',
    mode: overrides.mode || 'point',
    maxScore: overrides.maxScore ?? 10,
    weight: overrides.weight ?? 1,
    frequency: overrides.frequency || 'per_audit',
    isCritical: overrides.isCritical === true,
    required: overrides.required !== false,
  }
}

const qcForm = reactive({
  id: null,
  code: '',
  name: '',
  description: '',
  versionNo: 'v1.0',
  passThreshold: 40,
  status: 'published',
  isActive: true,
  criteria: [createCriterionItem(), createCriterionItem()],
})

const isEditMode = computed(() => route.name === 'Admin QC Form Edit')
const pageTitle = computed(() => (isEditMode.value ? 'Chỉnh sửa biểu mẫu QC' : 'Tạo biểu mẫu QC'))
const pageDescription = computed(() => (
  isEditMode.value
    ? 'Cập nhật metadata và danh sách tiêu chí của biểu mẫu hiện có.'
    : 'Tạo mới một biểu mẫu QC với metadata và danh sách tiêu chí đầy đủ.'
))
const submitLabel = computed(() => (
  savingForm.value
    ? 'Đang lưu...'
    : (isEditMode.value ? 'Lưu thay đổi' : 'Tạo biểu mẫu')
))

const resetFormState = () => {
  qcForm.id = null
  qcForm.code = ''
  qcForm.name = ''
  qcForm.description = ''
  qcForm.versionNo = 'v1.0'
  qcForm.passThreshold = 40
  qcForm.status = 'published'
  qcForm.isActive = true
  qcForm.criteria.splice(0, qcForm.criteria.length, createCriterionItem(), createCriterionItem())
}

const applyFormDetail = (item = {}) => {
  qcForm.id = Number(item?.id || 0) || null
  qcForm.code = String(item?.code || '')
  qcForm.name = String(item?.name || '')
  qcForm.description = String(item?.description || '')
  qcForm.versionNo = String(item?.latestVersion?.versionNo || 'v1.0')
  qcForm.passThreshold = Number(item?.latestVersion?.passThreshold || 40)
  qcForm.status = String(item?.latestVersion?.status || 'published')
  qcForm.isActive = item?.isActive !== false

  const criteria = Array.isArray(item?.latestVersion?.criteria) && item.latestVersion.criteria.length
    ? item.latestVersion.criteria.map((criterion) => createCriterionItem(criterion))
    : [createCriterionItem()]

  qcForm.criteria.splice(0, qcForm.criteria.length, ...criteria)
}

const normalizeCriteriaPayload = () => (
  qcForm.criteria.map((criterion) => ({
    code: String(criterion.code || '').trim().toUpperCase(),
    name: String(criterion.name || '').trim(),
    sectionName: String(criterion.sectionName || '').trim() || 'Tổng quát',
    description: String(criterion.description || '').trim(),
    mode: String(criterion.mode || 'point'),
    maxScore: criterion.mode === 'pass_fail' ? 1 : Number(criterion.maxScore || 0),
    weight: Number(criterion.weight || 1),
    frequency: String(criterion.frequency || 'per_audit'),
    isCritical: Boolean(criterion.isCritical),
    required: Boolean(criterion.required),
  }))
)

const validateForm = (criteria = []) => {
  const formCode = String(qcForm.code || '').trim().toUpperCase()
  const formName = String(qcForm.name || '').trim()

  if (!formCode || !formName) return 'Mã biểu mẫu và tên biểu mẫu là bắt buộc'
  if (!criteria.length) return 'Cần ít nhất một tiêu chí trong biểu mẫu QC'

  for (let index = 0; index < criteria.length; index += 1) {
    const criterion = criteria[index]
    if (!criterion.code || !criterion.name) {
      return `Tiêu chí #${index + 1} cần có mã và tên`
    }
    if (criterion.mode === 'point' && Number(criterion.maxScore || 0) <= 0) {
      return `Tiêu chí "${criterion.name}" cần điểm tối đa lớn hơn 0`
    }
  }

  return ''
}

const loadFormDetail = async () => {
  if (!isEditMode.value) {
    resetFormState()
    return
  }

  const formId = Number(route.params.id || 0)
  if (!formId) {
    loadError.value = 'Mã biểu mẫu không hợp lệ'
    return
  }

  loadingForm.value = true
  loadError.value = ''

  try {
    const detail = await getAdminQcFormById(formId)
    applyFormDetail(detail)
  } catch (error) {
    loadError.value = error?.response?.data?.message || error?.message || 'Không tải được biểu mẫu để chỉnh sửa'
  } finally {
    loadingForm.value = false
  }
}

const submitForm = async () => {
  if (savingForm.value) return

  const criteria = normalizeCriteriaPayload()
  const validationError = validateForm(criteria)
  if (validationError) {
    toast.error(validationError)
    return
  }

  savingForm.value = true
  try {
    const payload = {
      code: String(qcForm.code || '').trim().toUpperCase(),
      name: String(qcForm.name || '').trim(),
      description: String(qcForm.description || '').trim(),
      versionNo: String(qcForm.versionNo || '').trim() || 'v1.0',
      passThreshold: Number(qcForm.passThreshold || 0),
      status: qcForm.status,
      isActive: qcForm.isActive,
      criteria,
    }

    let detail
    if (isEditMode.value && qcForm.id) {
      detail = await updateAdminQcForm(qcForm.id, payload)
      toast.success('Cập nhật biểu mẫu QC thành công')
    } else {
      await createAdminQcForm(payload)
      toast.success('Tạo biểu mẫu QC thành công')
      router.push('/tools/qc-forms')
      return
    }

    router.push(`/tools/qc-forms/${detail.id}`)
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Không thể lưu biểu mẫu QC'
    toast.error(message)
  } finally {
    savingForm.value = false
  }
}

const addCriterion = () => {
  qcForm.criteria.push(createCriterionItem())
}

const removeCriterion = (criterionId) => {
  if (qcForm.criteria.length <= 1) {
    toast.info('Biểu mẫu QC cần tối thiểu một tiêu chí')
    return
  }

  const index = qcForm.criteria.findIndex((item) => item.id === criterionId)
  if (index >= 0) qcForm.criteria.splice(index, 1)
}

const goBack = () => {
  if (isEditMode.value && qcForm.id) {
    router.push(`/tools/qc-forms/${qcForm.id}`)
    return
  }

  router.push('/tools/qc-forms')
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
            Quay lại
          </button>
          <h2 class="mt-4 text-xl font-semibold tracking-tight text-slate-900">{{ pageTitle }}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ pageDescription }}</p>
        </div>
      </div>
    </section>

    <p v-if="loadError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ loadError }}
    </p>

    <div v-else-if="loadingForm" class="rounded-xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
      Đang tải biểu mẫu...
    </div>

    <section v-else class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="space-y-5 p-5">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Mã biểu mẫu</label>
            <input v-model="qcForm.code" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="VD: QC_STORE_STANDARD" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Tên biểu mẫu</label>
            <input v-model="qcForm.name" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="VD: QC cửa hàng chuẩn" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Version</label>
            <input v-model="qcForm.versionNo" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="v1.0" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Ngưỡng đạt (%)</label>
            <input v-model.number="qcForm.passThreshold" type="number" min="0" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="40" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700">Trạng thái version</label>
            <select v-model="qcForm.status" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="published">Phát hành ngay</option>
              <option value="draft">Lưu nháp</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input id="form-active" v-model="qcForm.isActive" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label for="form-active" class="text-sm font-medium text-slate-700">Bật biểu mẫu</label>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-semibold text-slate-700">Mô tả</label>
          <textarea v-model="qcForm.description" rows="3" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Mô tả ngắn về biểu mẫu QC"></textarea>
        </div>

        <div class="rounded-xl border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Danh sách tiêu chí</h3>
              <p class="mt-1 text-xs text-slate-500">Mỗi form cần ít nhất một tiêu chí.</p>
            </div>
            <button type="button" class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" @click="addCriterion">
              Thêm tiêu chí
            </button>
          </div>

          <div class="space-y-3 p-4">
            <article v-for="(criterion, index) in qcForm.criteria" :key="criterion.id" class="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-900">Tiêu chí {{ index + 1 }}</p>
                  <p class="text-xs text-slate-500">Thông tin cấu hình cơ bản.</p>
                </div>
                <button type="button" class="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50" @click="removeCriterion(criterion.id)">
                  Xóa
                </button>
              </div>

              <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mã tiêu chí</label>
                  <input v-model="criterion.code" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tên tiêu chí</label>
                  <input v-model="criterion.name" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Nhóm / Section</label>
                  <input v-model="criterion.sectionName" type="text" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Kiểu chấm</label>
                  <select v-model="criterion.mode" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <option value="point">Chấm điểm</option>
                    <option value="pass_fail">Đạt / Không đạt</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Điểm tối đa</label>
                  <input v-model.number="criterion.maxScore" :disabled="criterion.mode === 'pass_fail'" type="number" min="0" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Trọng số</label>
                  <input v-model.number="criterion.weight" type="number" min="0" step="0.1" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tần suất</label>
                  <select v-model="criterion.frequency" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <option value="per_audit">Mỗi lần kiểm</option>
                    <option value="weekly_once">Mỗi tuần một lần</option>
                  </select>
                </div>
                <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <input :id="`${criterion.id}-critical`" v-model="criterion.isCritical" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label :for="`${criterion.id}-critical`" class="text-sm font-medium text-slate-700">Tiêu chí trọng yếu</label>
                </div>
                <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <input :id="`${criterion.id}-required`" v-model="criterion.required" type="checkbox" class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label :for="`${criterion.id}-required`" class="text-sm font-medium text-slate-700">Bắt buộc</label>
                </div>
              </div>

              <div class="mt-3 space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả tiêu chí</label>
                <textarea v-model="criterion.description" rows="2" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"></textarea>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          @click="goBack"
        >
          Hủy
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="savingForm"
          @click="submitForm"
        >
          <span v-if="savingForm" class="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
          {{ submitLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
