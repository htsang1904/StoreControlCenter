<script setup>
import { computed, ref, watch } from 'vue'
import { useApp } from '@/plugins/app'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:modelValue'])

const { state } = useApp()
const stores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))

const showStoreFilterPopup = ref(false)
const storeSearchQuery = ref('')

const localSelection = ref([...props.modelValue])

watch(() => props.modelValue, (newVal) => {
  localSelection.value = [...newVal]
}, { deep: true })

const selectedStoreText = computed(() => {
  if (props.modelValue.length === 1) {
    const store = stores.value.find(s => s.id === props.modelValue[0])
    return store?.name || store?.address || `Store #${store?.id}` || '1 cửa hàng'
  }
  if (props.modelValue.length === 0) {
    return 'Chưa chọn cửa hàng'
  }
  return `${props.modelValue.length} cửa hàng`
})

const filteredStores = computed(() => {
  if (!storeSearchQuery.value) return stores.value
  const q = storeSearchQuery.value.toLowerCase()
  return stores.value.filter(s => {
    const name = (s.name || s.address || `Store #${s.id}`).toLowerCase()
    return name.includes(q)
  })
})

function toggleStoreSelection(storeId) {
  const index = localSelection.value.indexOf(storeId)
  if (index > -1) {
    localSelection.value.splice(index, 1)
  } else {
    localSelection.value.push(storeId)
  }
}

function selectAllStores() {
  localSelection.value = stores.value.map(s => s.id)
}

function clearStoreSelection() {
  localSelection.value = []
}

function isStoreSelected(storeId) {
  return localSelection.value.includes(storeId)
}

function applySelection() {
  emit('update:modelValue', localSelection.value)
  showStoreFilterPopup.value = false
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <button
      @click="showStoreFilterPopup = true"
      class="flex min-w-[140px] items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-[15px] font-black text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <span class="material-symbols-outlined text-[20px]">store</span>
      <span class="truncate">{{ selectedStoreText }}</span>
      <span class="material-symbols-outlined shrink-0 text-[20px] text-slate-400">arrow_drop_down</span>
    </button>

    <!-- STORE FILTER MODAL -->
    <Teleport to="body">
      <div v-if="showStoreFilterPopup" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" @click.self="showStoreFilterPopup = false">
        <div class="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl transition-all">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-black tracking-tight text-slate-800">Chọn cửa hàng hiển thị</h3>
            <button @click="showStoreFilterPopup = false" class="text-slate-400 transition-colors hover:text-slate-600">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="border-b border-slate-100 bg-slate-50/50 p-3">
            <div class="relative flex items-center">
              <span class="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-slate-400">search</span>
              <input 
                v-model="storeSearchQuery" 
                type="text" 
                placeholder="Tìm kiếm cửa hàng..." 
                class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div v-if="filteredStores.length === 0" class="p-8 text-center text-sm text-slate-500">
              Không tìm thấy cửa hàng nào.
            </div>
            <div v-else class="space-y-1">
              <label 
                v-for="store in filteredStores" 
                :key="store.id" 
                class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div class="relative flex items-center">
                  <input 
                    type="checkbox" 
                    :checked="isStoreSelected(store.id)"
                    @change="toggleStoreSelection(store.id)"
                    class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-indigo-400"
                  />
                  <span class="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] text-white opacity-0 transition-opacity peer-checked:opacity-100">check</span>
                </div>
                <span class="select-none text-sm font-semibold text-slate-700">
                  {{ store.name || store.address || `Store #${store.id}` }}
                </span>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-4">
            <div class="flex items-center gap-2">
               <button @click="selectAllStores" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700">Chọn tất cả</button>
               <button @click="clearStoreSelection" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700">Bỏ chọn</button>
            </div>
            <button 
              @click="applySelection" 
              class="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700"
            >
              Cập nhật
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
