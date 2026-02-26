import { reactive } from 'vue'
import router from '@/router'
import { loginBySuite, login, getMe, logout as logoutApi } from '@/services/auth_service'
const state = reactive({
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  userInfo: null,
  initialized: false,
})

export function useApp() {
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
            const meResult = await getMe()
            const user = meResult?.data?.user || meResult?.userDetail
            if (!meResult?.success || !user) {
                throw new Error('Không thể lấy thông tin người dùng')
            }
            state.userInfo = user
            await router.push('/')
            return result
        } catch (err) {
            state.token = null
            state.refreshToken = null
            state.userInfo = null
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            const message =
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
    }

    const initializeAuth = async () => {
        if (!state.token && !state.refreshToken) {
            state.initialized = true
            return
        }

        try {
            const result = await getMe()
            const user = result?.data?.user || result?.userDetail
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
        logout: userLogout,
        initializeAuth,
        router,
    }
}
