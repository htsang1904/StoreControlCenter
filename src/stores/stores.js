import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { listAdminStores } from '@/services/admin_service'
import { useApp } from '@/plugins/app'

const normalizeStoreId = (store) => Number(store?.id || 0)

export const useStoresStore = defineStore('stores', () => {
  const { state } = useApp()
  const adminStores = ref([])
  const adminStoresLoaded = ref(false)
  const adminStoresLoading = ref(false)
  const adminStoresError = ref('')
  const selectedStoreIds = ref([])

  const userRole = computed(() => String(state.userInfo?.role || '').toLowerCase())
  const isAdmin = computed(() => userRole.value === 'admin')
  const userStores = computed(() => (Array.isArray(state.userInfo?.stores) ? state.userInfo.stores : []))
  const availableStores = computed(() => (isAdmin.value && adminStores.value.length > 0 ? adminStores.value : userStores.value))

  const availableStoreIds = computed(() => availableStores.value
    .map((store) => normalizeStoreId(store))
    .filter((id) => Number.isInteger(id) && id > 0))

  const effectiveSelectedStoreIds = computed(() => {
    const selectedIds = selectedStoreIds.value
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
    return selectedIds.length > 0 ? selectedIds : availableStoreIds.value
  })

  async function loadAdminStores({ force = false, isActive = true } = {}) {
    if (!isAdmin.value) return []
    if (!force && adminStoresLoaded.value) return adminStores.value
    if (adminStoresLoading.value) return adminStores.value

    adminStoresLoading.value = true
    adminStoresError.value = ''
    try {
      const firstPage = await listAdminStores({ page: 1, pageSize: 500, isActive })
      const rows = Array.isArray(firstPage.items) ? [...firstPage.items] : []
      const pageCount = Number(firstPage.pagination?.pageCount || 1)

      for (let page = 2; page <= pageCount; page += 1) {
        const result = await listAdminStores({ page, pageSize: 500, isActive })
        if (Array.isArray(result.items)) rows.push(...result.items)
      }

      adminStores.value = rows
      adminStoresLoaded.value = true
      return rows
    } catch (error) {
      adminStoresError.value = error?.response?.data?.message || error?.message || 'Không tải được danh sách cửa hàng.'
      throw error
    } finally {
      adminStoresLoading.value = false
    }
  }

  function findStoreById(storeId) {
    const targetId = Number(storeId || 0)
    return availableStores.value.find((store) => normalizeStoreId(store) === targetId) || null
  }

  function storeLabel(store) {
    if (!store) return ''
    return store.shortAddress || store.address || store.name || store.code || `Cửa hàng #${normalizeStoreId(store) || '--'}`
  }

  function setSelectedStoreIds(storeIds = []) {
    selectedStoreIds.value = Array.from(new Set((Array.isArray(storeIds) ? storeIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)))
  }

  function clearSelectedStoreIds() {
    selectedStoreIds.value = []
  }

  function resetAdminStores() {
    adminStores.value = []
    adminStoresLoaded.value = false
    adminStoresLoading.value = false
    adminStoresError.value = ''
  }

  return {
    adminStores,
    adminStoresLoaded,
    adminStoresLoading,
    adminStoresError,
    userRole,
    isAdmin,
    userStores,
    availableStores,
    availableStoreIds,
    selectedStoreIds,
    effectiveSelectedStoreIds,
    setSelectedStoreIds,
    clearSelectedStoreIds,
    loadAdminStores,
    findStoreById,
    storeLabel,
    resetAdminStores,
  }
})
