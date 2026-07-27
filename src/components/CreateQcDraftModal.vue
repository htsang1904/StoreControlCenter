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

function templateOptionLabel(template) {
  const name = String(template?.name || '').trim()
  const version = String(template?.version || template?.versionNo || template?.activeVersionNo || '').trim()
  return [name || 'Biểu mẫu QC', version].filter(Boolean).join(' • ')
}

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
      <div class="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-muted)] px-4 py-3">
        <p class="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Cửa hàng</p>
        <p class="mt-1 text-sm font-semibold text-[var(--text-primary)]">{{ storeName || '--' }}</p>
      </div>

      <section>
        <label class="block text-sm text-[var(--text-secondary)]">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Biểu mẫu QC</span>
          <select
            :id="templateSelectId"
            v-model="form.templateId"
            class="hidden"
            data-hs-select='{
              "placeholder": "Chọn biểu mẫu QC",
              "toggleTag": "<button type=\"button\" aria-expanded=\"false\"></button>",
              "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative flex h-10 items-center gap-x-2 text-nowrap w-full cursor-pointer rounded-xl border border-[var(--stroke)] bg-white ps-3 pe-9 text-start text-sm text-[var(--text-secondary)] focus:outline-hidden",
              "dropdownClasses": "mt-2 z-[80] w-full max-h-72 p-1 space-y-0.5 bg-white border border-[var(--stroke)] rounded-xl overflow-hidden overflow-y-auto",
              "optionClasses": "py-2 px-3 w-full text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-muted)] rounded-lg focus:outline-hidden",
              "optionTemplate": "<div class=\"flex justify-between items-center w-full gap-3\"><span data-title class=\"truncate\"></span><span class=\"hidden hs-selected:block\"><svg class=\"shrink-0 size-3.5 text-[var(--text-primary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg></span></div>",
              "extraMarkup": "<div class=\"absolute top-1/2 end-3 -translate-y-1/2\"><svg class=\"shrink-0 size-3.5 text-[var(--text-secondary)]\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m7 15 5 5 5-5\"/><path d=\"m7 9 5-5 5 5\"/></svg></div>"
            }'
          >
            <option value="">Chọn biểu mẫu QC</option>
            <option
              v-for="template in normalizedTemplates"
              :key="template.id"
              :value="template.id"
            >
              {{ templateOptionLabel(template) }}
            </option>
          </select>
        </label>
      </section>

      <section>
        <label class="block text-sm text-[var(--text-secondary)]">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Thời điểm kiểm tra</span>
          <input
            v-model="form.auditedAt"
            type="datetime-local"
            class="h-10 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
          >
        </label>
      </section>

      <label class="block text-sm text-[var(--text-secondary)]">
        <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Ghi chú mở đầu</span>
        <textarea
          v-model="form.note"
          rows="3"
          class="w-full rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-hidden focus:ring-0"
          placeholder="Nhập ghi chú"
        ></textarea>
      </label>

      <div v-if="normalizedTemplates.length === 0" class="app-state-panel app-state-panel--compact border-dashed border-[var(--stroke-strong)] bg-[var(--surface-muted)]">
        <div class="app-state-stack mx-auto">
          <div class="app-state-icon mx-auto">
            <span class="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
          <p class="app-state-title">Chưa có biểu mẫu QC khả dụng.</p>
          <p class="app-state-body">Tạo, phát hành và áp dụng biểu mẫu trước khi khởi tạo phiếu mới.</p>
        </div>
      </div>

      <p v-if="errorMessage" class="app-state-banner text-xs font-medium">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-2 tablet:flex tablet:items-center tablet:justify-end">
        <button
          type="button"
          class="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
          :disabled="loading"
          @click="closeModal"
        >
          Hủy
        </button>
        <button
          type="button"
          class="app-button-primary inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 tablet:w-auto"
          :disabled="!canSubmit"
          @click="submitModal"
        >
          {{ loading ? 'Đang tạo...' : 'Tạo phiếu' }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
