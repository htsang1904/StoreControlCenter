import { reactive } from 'vue'
import router from '@/router'
import { loginBySuite, login, loginBySsoTicket, getMe, logout as logoutApi, syncStores as syncStoresApi, updateAvatar as updateAvatarApi } from '@/services/auth_service'
import { unbindOneSignalUser } from '@/services/onesignal_service'
import { useToast } from '@/plugins/toast'
const state = reactive({
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  userInfo: null,
  initialized: false,
})

const syncAuthStateFromStorage = () => {
    state.token = localStorage.getItem('token') || null
    state.refreshToken = localStorage.getItem('refreshToken') || null
}

const clearAuthState = () => {
    state.token = null
    state.refreshToken = null
    state.userInfo = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
}

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

            localStorage.setItem('token', accessToken)
            if (refreshToken) {
                localStorage.setItem('refreshToken', refreshToken)
            }
            syncAuthStateFromStorage()

            // Do not block navigation if profile fetch has transient issues.
            try {
                const meResult = await getMe()
                const user = resolveUserProfile(meResult)
                if (user) {
                    state.userInfo = user
                }
            } catch (_err) {}

            await router.replace('/dashboard')
            return result
        } catch (err) {
            clearAuthState()
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Đăng nhập thất bại'
            throw new Error(message)
        }
    }

    const userLogout = () => {
        unbindOneSignalUser().catch(() => {})
        if (state.token) {
            logoutApi().catch(() => {})
        }
        clearAuthState()
        state.initialized = true
        router.push(`/login`)
        toast.info('Bạn đã đăng xuất')
    }

    const userLoginBySsoTicket = async (ticket) => {
        try {
            const result = await loginBySsoTicket({ ticket })
            const accessToken = result?.data?.accessToken
            const refreshToken = result?.data?.refreshToken

            if (!result?.success || !accessToken) {
                throw new Error(result?.message || 'Đăng nhập thất bại')
            }

            localStorage.setItem('token', accessToken)
            if (refreshToken) {
                localStorage.setItem('refreshToken', refreshToken)
            }
            syncAuthStateFromStorage()

            const meResult = await getMe()
            const user = resolveUserProfile(meResult)
            if (user) {
                state.userInfo = user
            }

            await router.replace('/dashboard')
            return result
        } catch (err) {
            clearAuthState()
            const message =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                err?.message ||
                'Đăng nhập thất bại'
            throw new Error(message)
        }
    }

    const syncUserStores = async () => {
        const result = await syncStoresApi()
        const user = resolveUserProfile(result)
        if (result?.success && user) {
            state.userInfo = user
        }
        return result
    }

    const updateUserAvatar = async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        const result = await updateAvatarApi(formData)
        const user = resolveUserProfile(result)
        if (result?.success && user) {
            state.userInfo = user
        }
        return result
    }

    const initializeAuth = async () => {
        syncAuthStateFromStorage()

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
            syncAuthStateFromStorage()
            state.userInfo = user
        } catch (_err) {
            clearAuthState()
        } finally {
            state.initialized = true
        }
    }

    return {
        state,
        userLogin,
        userLoginBySsoTicket,
        userLogout,
        syncUserStores,
        updateUserAvatar,
        logout: userLogout,
        initializeAuth,
        router,
    }
}
