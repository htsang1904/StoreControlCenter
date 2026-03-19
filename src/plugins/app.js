import { reactive } from 'vue'
import router from '@/router'
import { loginBySuite, login, getMe, logout as logoutApi, syncStores as syncStoresApi } from '@/services/auth_service'
import { useToast } from '@/plugins/toast'
const state = reactive({
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  userInfo: null,
  initialized: false,
})

const normalizeStores = (user) => {
    if (!user || typeof user !== 'object') return []

    if (Array.isArray(user.stores)) return user.stores
    if (Array.isArray(user.store_list)) return user.store_list
    if (Array.isArray(user.list_store)) return user.list_store

    return []
}

const resolveUserProfile = (payload) => {
    const user =
        payload?.data?.user ||
        payload?.userDetail ||
        payload?.user ||
        payload?.data ||
        null

    if (!user || typeof user !== 'object') return null

    return {
        ...user,
        stores: normalizeStores(user),
    }
}

export function useApp() {
    const toast = useToast()
    const userLogin = async (payload) => {
        try {
            const suiteResult = await loginBySuite(payload)
            if (!suiteResult?.token || !suiteResult?.profile?.email) {
                throw new Error('Thông tin đăng nhập Suite không hợp lệ')
            }

            const result = await login(suiteResult)
            const accessToken = result?.data?.accessToken
            const refreshToken = result?.data?.refreshToken

            if (!result?.success || !accessToken) {
                throw new Error(result?.message || 'Đăng nhập vào hệ thống thất bại')
            }

            state.token = accessToken
            state.refreshToken = refreshToken
            localStorage.setItem('token', state.token)
            if (state.refreshToken) {
                localStorage.setItem('refreshToken', state.refreshToken)
            }

            // Do not block navigation if profile fetch has transient issues.
            try {
                const meResult = await getMe()
                const user = resolveUserProfile(meResult)
                if (user) {
                    state.userInfo = user
                }
            } catch (_err) {}

            await router.replace('/ticket')
            return result
        } catch (err) {
            state.token = null
            state.refreshToken = null
            state.userInfo = null
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Đăng nhập thất bại'
            throw new Error(message)
        }
    }

    const userLogout = () => {
        if (state.token) {
            logoutApi().catch(() => {})
        }
        state.token = null
        state.refreshToken = null
        state.userInfo = null
        state.initialized = true
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        router.push(`/login`)
        toast.info('Bạn đã đăng xuất')
    }

    const syncUserStores = async () => {
        const result = await syncStoresApi()
        const user = resolveUserProfile(result)
        if (result?.success && user) {
            state.userInfo = user
        }
        return result
    }

    const initializeAuth = async () => {
        if (!state.token && !state.refreshToken) {
            state.initialized = true
            return
        }

        try {
            const result = await getMe()
            const user = resolveUserProfile(result)
            if (!result?.success || !user) {
                throw new Error('Không thể lấy thông tin người dùng')
            }
            state.token = localStorage.getItem('token') || null
            state.refreshToken = localStorage.getItem('refreshToken') || null
            state.userInfo = user
        } catch (_err) {
            state.token = null
            state.refreshToken = null
            state.userInfo = null
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
        } finally {
            state.initialized = true
        }
    }

    return {
        state,
        userLogin,
        userLogout,
        syncUserStores,
        logout: userLogout,
        initializeAuth,
        router,
    }
}
