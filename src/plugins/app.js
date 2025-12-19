import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { loginBySuite, login } from '@/services/auth_service'
const state = reactive({
  token: localStorage.getItem('token') || null,
  userInfo: null,
})

export function useApp() {
    const router = useRouter()
    const userLogin = async (payload) => {
        try {
            const res = await loginBySuite(payload)
            if(res) {
                try {
                    const result = await login(res)
                    console.log(result)
                }
                catch (err) {
                    console.log('Lỗi đăng nhập vào hệ thống: ', err)
                }
            }
        }
        catch (err) {
            console.log("Lỗi đăng nhập qua suite: ", err)
        }
    }

    const userLogout = () => {
        state.token = null
        localStorage.removeItem('token')
        router.push(`/login`)
    }

    return { state, userLogin, userLogout, router }
}
