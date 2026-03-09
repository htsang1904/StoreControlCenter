<script setup>
import { computed } from 'vue'

const props = defineProps({
  criterion: {
    type: Object,
    required: true,
  },
  level: {
    type: Number,
    default: 1,
  },
  criteriaStates: {
    type: Object,
    required: true,
  },
  weeklyCheckedIds: {
    type: Object, // Set
    default: () => new Set(),
  },
  maxAttachments: {
    type: Number,
    default: 3,
  },
})

const emit = defineEmits(['update-state', 'upload-attachment', 'remove-attachment', 'open-finding-modal'])

const hasChildren = computed(() => props.criterion.children && props.criterion.children.length > 0)
const state = computed(() => props.criteriaStates[props.criterion.id] || { status: 'pending', score: null, note: '', attachments: [] })
const isWeeklySkip = computed(() => props.criterion.frequency === 'weekly_once' && props.weeklyCheckedIds.has(props.criterion.id))

const updateState = (updates) => {
  emit('update-state', props.criterion.id, updates)
}

const handlePassFail = (status) => {
  if (isWeeklySkip.value) return
  updateState({ status })
}

const handleScoreChange = (event) => {
  if (isWeeklySkip.value) return
  const value = event.target.value
  updateState({ 
    score: value === '' ? null : Number(value),
    status: value === '' ? 'pending' : 'pass' // Basic logic
  })
}

const handlePointNA = () => {
  if (isWeeklySkip.value) return
  const nextStatus = state.value.status === 'na' ? 'pending' : 'na'
  updateState({ status: nextStatus, score: nextStatus === 'na' ? null : state.value.score })
}

const handleUpload = (event) => {
  emit('upload-attachment', props.criterion.id, event)
}

const removeAttachment = (index) => {
  emit('remove-attachment', props.criterion.id, index)
}
</script>

<template>
  <div :class="['qc-criterion-item', level > 1 ? 'ml-6 mt-2' : 'mt-6']">
    <!-- Header for Non-Leaf Nodes -->
    <div v-if="hasChildren" class="flex items-center gap-2 mb-2">
      <span class="font-bold text-gray-800" :class="level === 1 ? 'text-lg' : 'text-md'">
        {{ criterion.ordering }} {{ criterion.name }}
      </span>
      <div v-if="level === 1" class="h-px flex-1 bg-gray-200 ml-2"></div>
    </div>

    <!-- Recursive Children -->
    <div v-if="hasChildren" class="border-l-2 border-gray-100 pl-2">
      <QCCriterionTreeItem
        v-for="child in criterion.children"
        :key="child.id"
        :criterion="child"
        :level="level + 1"
        :criteria-states="criteriaStates"
        :weekly-checked-ids="weeklyCheckedIds"
        @update-state="(id, updates) => $emit('update-state', id, updates)"
        @upload-attachment="(id, event) => $emit('upload-attachment', id, event)"
        @remove-attachment="(id, index) => $emit('remove-attachment', id, index)"
      />
    </div>

    <!-- Leaf Node (Scorable) -->
    <div v-else class="bg-white border rounded-xl p-4 shadow-sm" :class="{'opacity-60 grayscale-[0.5]': isWeeklySkip}">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wider">
              {{ criterion.ordering }}
            </span>
            <span v-if="criterion.isCritical" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 uppercase border border-rose-200">
              CRITICAL
            </span>
            <span v-if="criterion.frequency === 'weekly_once'" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase border border-blue-100">
              WEEKLY
            </span>
          </div>
          <h4 class="font-medium text-gray-900 leading-snug">{{ criterion.name }}</h4>
        </div>

        <!-- Scoring Controls -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Pass/Fail Mode -->
          <template v-if="criterion.mode === 'pass_fail'">
            <div class="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                @click="handlePassFail('pass')"
                :disabled="isWeeklySkip"
                class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                :class="state.status === 'pass' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
              >
                Đạt
              </button>
              <button
                type="button"
                @click="handlePassFail('fail')"
                :disabled="isWeeklySkip"
                class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                :class="state.status === 'fail' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
              >
                Không đạt
              </button>
            </div>
          </template>

          <!-- Point Mode -->
          <template v-else-if="criterion.mode === 'point'">
            <div class="flex items-center gap-2">
              <div class="relative max-w-[120px]">
                <input
                  type="number"
                  :value="state.score"
                  @input="handleScoreChange"
                  :disabled="state.status === 'na' || isWeeklySkip"
                  placeholder="Điểm"
                  class="w-full h-9 pl-3 pr-8 rounded-lg border-gray-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                  :min="0"
                  :max="criterion.maxScore"
                  step="0.5"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-400">
                  /{{ criterion.maxScore }}
                </span>
              </div>
              <button
                type="button"
                @click="handlePointNA"
                :disabled="isWeeklySkip"
                class="h-9 px-3 rounded-lg text-xs font-medium border transition-colors"
                :class="state.status === 'na' ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'"
              >
                {{ state.status === 'na' ? 'Đang bỏ qua' : 'Bỏ qua (N/A)' }}
              </button>
            </div>
          </template>

          <!-- Finding Button (only for fail status) -->
          <button
            v-if="state.status === 'fail' && !isWeeklySkip"
            type="button"
            @click="$emit('open-finding-modal', criterion.id)"
            class="h-9 px-3 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m4.93 4.93 14.14 14.14"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
            Khắc phục
          </button>
        </div>
      </div>

      <!-- Note & Attachments for Leaf Node -->
      <div v-if="state.status !== 'pending' && state.status !== 'na'" class="mt-4 pt-4 border-t border-gray-50 grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-2">Ghi chú vi phạm / Nhận xét</label>
          <textarea
            :value="state.note"
            @input="e => updateState({ note: e.target.value })"
            rows="2"
            class="w-full text-sm rounded-lg border-gray-200 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập chi tiết lỗi hoặc ghi chú..."
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-500 mb-2">Ảnh minh chứng ({{ state.attachments.length }}/{{ maxAttachments }})</label>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(file, idx) in state.attachments"
              :key="idx"
              class="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group"
            >
              <img :src="file.preview || file.url" class="w-full h-full object-cover" />
              <button
                @click="removeAttachment(idx)"
                class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <i class="bi bi-trash text-white text-sm"></i>
              </button>
            </div>

            <label
              v-if="state.attachments.length < maxAttachments"
              @change="handleUpload"
              class="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all"
            >
              <i class="bi bi-plus text-gray-400 text-xl"></i>
              <input type="file" class="hidden" accept="image/*" multiple />
            </label>
          </div>
        </div>
      </div>
      
      <!-- Weekly Hint -->
      <p v-if="isWeeklySkip" class="mt-2 text-[10px] text-blue-500 italic">
        Tiêu chí tuần đã được chấm trong tuần này.
      </p>
    </div>
  </div>
</template>

<style scoped>
.qc-criterion-item {
  transition: all 0.3s ease;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
