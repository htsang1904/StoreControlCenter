import { reactive } from 'vue'
import { useRouter } from 'vue-router'
const state = reactive({
  token: localStorage.getItem('token') || null,
  userInfo: null,
})

export function useApp() {
    const router = useRouter()
    const login = (token) => {
        state.token = token
        localStorage.setItem('token', 'aaaaaa')
        router.push(`/`)
    }

    const logout = () => {
        state.token = null
        localStorage.removeItem('token')
        router.push(`/login`)
    }

    return { state, login, logout, router }
}
