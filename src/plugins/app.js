import { reactive } from 'vue'
import router from '@/router'
import { loginBySuite, login, loginBySsoTicket, getMe, logout as logoutApi, syncStores as syncStoresApi, updateAvatar as updateAvatarApi } from '@/services/auth_service'
import { disconnectOneSignalUser } from '@/services/onesignal_service'
import { useToast } from '@/plugins/toast'
const state = reactive({
  token: localStorage.getItem('token') || null,
  userInfo: null,
  initialized: false,
})
let authExpiryTimer = null
let authExpiredListenerRegistered = false
let authExpiredHandling = false

const readTokenExpiry = (token) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return Number(payload?.exp || 0) * 1000
    } catch (_err) {
        return 0
    }
}

const clearAuthExpiryTimer = () => {
    if (authExpiryTimer) window.clearTimeout(authExpiryTimer)
    authExpiryTimer = null
}

const scheduleAuthExpiry = () => {
    clearAuthExpiryTimer()
    if (!state.token) return

    const expiresAt = readTokenExpiry(state.token)
    const remainingMs = expiresAt - Date.now()
    if (!expiresAt || remainingMs <= 0) {
        handleAuthExpired()
        return
    }

    authExpiryTimer = window.setTimeout(() => {
        handleAuthExpired()
    }, Math.min(remainingMs, 2147483647))
}

const syncAuthStateFromStorage = () => {
    state.token = localStorage.getItem('token') || null
    scheduleAuthExpiry()
}

const clearAuthState = () => {
    state.token = null
    state.userInfo = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    clearAuthExpiryTimer()
}

const isTokenExpired = (token = state.token) => {
    if (!token) return true
    const expiresAt = readTokenExpiry(token)
    return Boolean(expiresAt && expiresAt <= Date.now())
}

const handleAuthExpired = async ({ showToast = true } = {}) => {
    if (authExpiredHandling) return
    authExpiredHandling = true
    try {
        await disconnectOneSignalUser()
    } catch (_err) {
    } finally {
        clearAuthState()
        state.initialized = true
        if (router.currentRoute.value.path !== '/login') {
            await router.replace('/login')
        }
        if (showToast) {
            useToast().info('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        }
        authExpiredHandling = false
    }
}

const registerAuthExpiredListener = () => {
    if (authExpiredListenerRegistered || typeof window === 'undefined') return
    window.addEventListener('app:auth-expired', () => {
        handleAuthExpired()
    })
    authExpiredListenerRegistered = true
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

            if (!result?.success || !accessToken) {
                throw new Error(result?.message || 'Đăng nhập vào hệ thống thất bại')
            }

            localStorage.setItem('token', accessToken)
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

    const userLogout = async () => {
        try {
            await disconnectOneSignalUser()
            if (state.token) await logoutApi()
        } catch (_err) {
        } finally {
            clearAuthState()
            state.initialized = true
            router.push(`/login`)
            toast.info('Bạn đã đăng xuất')
        }
    }

    const userLoginBySsoTicket = async (ticket) => {
        try {
            const result = await loginBySsoTicket({ ticket })
            const accessToken = result?.data?.accessToken

            if (!result?.success || !accessToken) {
                throw new Error(result?.message || 'Đăng nhập thất bại')
            }

            localStorage.setItem('token', accessToken)
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
        registerAuthExpiredListener()
        syncAuthStateFromStorage()

        if (!state.token) {
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
        handleAuthExpired,
        isTokenExpired,
        router,
    }
}
