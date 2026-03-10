<script setup>
import { computed, nextTick, reactive, watch } from 'vue'
import CommonModal from '@/components/CommonModal.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  storeName: {
    type: String,
    default: '',
  },
  templateOptions: {
    type: Array,
    default: () => [],
  },
  initialTemplateId: {
    type: String,
    default: '',
  },
  initialAuditedAt: {
    type: String,
    default: '',
  },
  initialNote: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'submit', 'close'])

const form = reactive({
  templateId: '',
  auditedAt: '',
  note: '',
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const normalizedTemplates = computed(() => (
  Array.isArray(props.templateOptions)
    ? props.templateOptions
    : []
))

const canSubmit = computed(() => (
  !props.loading
  && Boolean(form.templateId)
  && Boolean(form.auditedAt)
))

const templateSelectId = 'qc-draft-template'

function resolveInitialTemplateId() {
  return String(props.initialTemplateId || normalizedTemplates.value[0]?.id || '')
}

function syncForm() {
  form.templateId = resolveInitialTemplateId()
  form.auditedAt = String(props.initialAuditedAt || '')
  form.note = String(props.initialNote || '')
}

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}

function handleCommonModalClose() {
  emit('close')
}

function syncPrelineSelectValue(value) {
  if (typeof document === 'undefined') return

  const selectElement = document.getElementById(templateSelectId)
  if (!selectElement) return

  const normalizedValue = value ? String(value) : ''
  selectElement.value = normalizedValue

  const hsSelect = window.HSSelect?.getInstance?.(selectElement, true)
  if (hsSelect?.element?.setValue) {
    hsSelect.element.setValue(normalizedValue)
  }
}

async function initTemplateSelect() {
  await nextTick()
  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
  syncPrelineSelectValue(form.templateId)
}

function submitModal() {
  if (!canSubmit.value) return
  emit('submit', {
    templateId: String(form.templateId || ''),
    auditedAt: String(form.auditedAt || ''),
    note: String(form.note || ''),
  })
}

watch(
  () => props.modelValue,
  async (isOpenValue) => {
    if (!isOpenValue) return
    syncForm()
    await initTemplateSelect()
  },
  { immediate: true }
)

watch(
  normalizedTemplates,
  async () => {
    if (!props.modelValue) return

    const matched = normalizedTemplates.value.some((item) => String(item?.id || '') === String(form.templateId || ''))
    if (!matched) {
      form.templateId = resolveInitialTemplateId()
    }
    await initTemplateSelect()
  }
)
</script>

<template>
  <CommonModal
    v-model="isOpen"
    title="Khởi tạo phiếu QC"
    max-width-class="max-w-xl"
    :close-disabled="loading"
    @close="handleCommonModalClose"
  >
    <div class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cửa hàng đang thao tác</p>
        <p class="mt-1 text-sm font-semibold text-slate-900">{{ storeName || '--' }}</p>
      </div>

      <section>
        <label class="block text-sm text-slate-700">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Biểu mẫu QC</span>
          <select
            :id="templateSelectId"
            v-model="form.templateId"
            class="hidden"
            data-hs-select='{
              "placeholder": "Chọn biểu mẫu QC",
              "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
              "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-10 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-xl border border-slate-200 bg-white ps-3 pe-9 text-start text-sm text-slate-700 focus:outline-hidden",
              "dropdownClasses": "mt-2 z-[80] w-full max-h-72 p-1 space-y-0.5 bg-white border border-slate-200 rounded-xl overflow-hidden overflow-y-auto shadow-lg",
              "optionClasses": "py-2 px-3 w-full text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg focus:outline-hidden",
              "optionTemplate": "<div class=\"flex justify-between items-center w-full gap-3\"><span data-title class=\"truncate\"></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-blue-600\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
              "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-slate-500\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
            }'
          >
            <option value="">Chọn biểu mẫu QC</option>
            <option
              v-for="template in normalizedTemplates"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}{{ template.code ? ` • ${template.code}` : '' }}
            </option>
          </select>
          <p class="mt-1.5 text-xs leading-5 text-slate-500">
            Biểu mẫu được lấy trực tiếp từ danh sách form QC hiện hành.
          </p>
        </label>
      </section>

      <section>
        <label class="block text-sm text-slate-700">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thời điểm kiểm tra</span>
          <input
            v-model="form.auditedAt"
            type="datetime-local"
            class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
          >
        </label>
      </section>

      <label class="block text-sm text-slate-700">
        <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú mở đầu</span>
        <textarea
          v-model="form.note"
          rows="3"
          class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
          placeholder="Ví dụ: kiểm tra định kỳ đầu ca, cần tập trung khu vực quầy và checklist vệ sinh."
        ></textarea>
      </label>

      <div v-if="normalizedTemplates.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        Chưa có biểu mẫu QC khả dụng để khởi tạo phiếu.
      </div>

      <p v-if="errorMessage" class="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="closeModal"
        >
          Hủy
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canSubmit"
          @click="submitModal"
        >
          {{ loading ? 'Đang tạo...' : 'Tạo nháp và mở phiếu' }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
