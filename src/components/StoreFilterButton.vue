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
    return storeTitle(store) || '1 cửa hàng'
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
    const searchable = [storeTitle(s), storeAddress(s), s.code, s.storeId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(q)
  })
})

function storeTitle(store) {
  return store?.name || store?.shortAddress || `Store #${store?.id || '--'}`
}

function storeAddress(store) {
  const address = store?.address || ''
  if (address && address !== storeTitle(store)) return address
  return store?.shortAddress && store?.shortAddress !== storeTitle(store) ? store.shortAddress : ''
}

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
      class="app-button-secondary flex min-w-[140px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
    >
      <span class="material-symbols-outlined text-[20px]">store</span>
      <span class="truncate">{{ selectedStoreText }}</span>
      <span class="material-symbols-outlined shrink-0 text-[20px] text-[var(--text-muted)]">arrow_drop_down</span>
    </button>

    <!-- STORE FILTER MODAL -->
    <Teleport to="body">
      <div v-if="showStoreFilterPopup" class="fixed inset-0 z-[100] flex items-center justify-center bg-blue-950/25 p-4 backdrop-blur-sm" @click.self="showStoreFilterPopup = false">
        <div class="app-menu-panel flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] transition-all">
          <div class="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
            <h3 class="text-base font-black tracking-tight text-[var(--text-primary)]">Chọn cửa hàng hiển thị</h3>
            <button @click="showStoreFilterPopup = false" class="text-[var(--text-muted)] transition-colors hover:text-[var(--primary-strong)]">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="border-b border-[var(--stroke)] bg-[var(--surface-muted)] p-3">
            <div class="relative flex items-center">
              <span class="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-[var(--text-muted)]">search</span>
              <input 
                v-model="storeSearchQuery" 
                type="text" 
                placeholder="Tìm kiếm cửa hàng..." 
                class="app-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition-all"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <div v-if="filteredStores.length === 0" class="p-8 text-center text-sm text-[var(--text-secondary)]">
              Không tìm thấy cửa hàng nào.
            </div>
            <div v-else class="space-y-1">
              <label 
                v-for="store in filteredStores" 
                :key="store.id" 
                class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-muted)]"
              >
                <div class="relative flex items-center">
                  <input 
                    type="checkbox" 
                    :checked="isStoreSelected(store.id)"
                    @change="toggleStoreSelection(store.id)"
                    class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-[var(--stroke-strong)] bg-white transition-all checked:border-[var(--primary)] checked:bg-[var(--primary)] hover:border-[var(--primary)]"
                  />
                  <span class="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] text-white opacity-0 transition-opacity peer-checked:opacity-100">check</span>
                </div>
                <span class="min-w-0 select-none">
                  <span class="block truncate text-sm font-semibold text-[var(--text-primary)]">
                    {{ storeTitle(store) }}
                  </span>
                  <span v-if="storeAddress(store)" class="mt-0.5 block truncate text-xs font-normal text-[var(--text-secondary)]">
                    {{ storeAddress(store) }}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-[var(--stroke)] bg-[var(--surface-muted)] p-4">
            <div class="flex items-center gap-2">
               <button @click="selectAllStores" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-[var(--primary-strong)] transition-colors hover:bg-[var(--primary-softer)]">Chọn tất cả</button>
               <button @click="clearStoreSelection" class="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-[var(--text-primary)]">Bỏ chọn</button>
            </div>
            <button 
              @click="applySelection" 
              class="app-button-primary rounded-xl px-6 py-2.5 text-sm font-bold"
            >
              Cập nhật
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
