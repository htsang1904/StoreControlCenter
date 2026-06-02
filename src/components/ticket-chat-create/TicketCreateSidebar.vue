<script setup>
import { computed } from 'vue'

const props = defineProps({
  formData: {
    type: Object,
    required: true
  },
  currentStep: {
    type: String,
    required: true
  }
})

const hasStore = computed(() => !!props.formData.store_name)
const hasDept = computed(() => !!props.formData.department_name)
const hasContent = computed(() => !!props.formData.title || !!props.formData.description)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-white">
    <div class="border-b border-slate-200 px-4 py-4 tablet:px-5">
      <div class="flex items-center gap-3">
        <h2 class="min-w-0 flex-1 text-lg font-semibold text-blue-950">Thông tin yêu cầu</h2>
      </div>
      <p class="mt-1 text-sm text-slate-500">Tổng hợp thông tin vé bạn đang tạo.</p>
    </div>

    <div class="flex-1 overflow-y-auto p-4 tablet:p-5">
      <div class="space-y-6">
        <!-- Store -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-slate-500">Cửa hàng</h3>
          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p v-if="hasStore" class="text-sm font-medium text-blue-950">{{ formData.store_name }}</p>
            <p v-else class="text-sm text-slate-400 italic">Chưa chọn</p>
          </div>
        </div>

        <!-- Department -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-slate-500">Bộ phận xử lý</h3>
          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p v-if="hasDept" class="text-sm font-medium text-blue-950">{{ formData.department_name }}</p>
            <p v-else class="text-sm text-slate-400 italic">Chưa chọn</p>
          </div>
        </div>

        <!-- Content -->
        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-slate-500">Nội dung</h3>
          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div v-if="hasContent">
              <p class="text-sm font-semibold text-blue-950">{{ formData.title }}</p>
              <p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ formData.description }}</p>

              <div v-if="formData.attachments_media && formData.attachments_media.length" class="mt-3 flex flex-wrap gap-2">
                <div v-for="file in formData.attachments_media" :key="file.id" class="relative size-16 overflow-hidden rounded-lg border border-slate-200">
                  <img v-if="file.url" :src="file.url" class="absolute inset-0 size-full object-cover" />
                  <div v-else class="flex size-full items-center justify-center bg-slate-100 text-[10px] text-slate-400">FIle</div>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-slate-400 italic">Chưa nhập</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
