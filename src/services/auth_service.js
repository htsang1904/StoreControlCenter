import getClient from './http'
const suiteClient = getClient(import.meta.env.VITE_AUTH_URL)
const http = getClient()

export const loginBySuite = (payload) => {
  return suiteClient.post('/v1/auth/login', payload)
}
export const login = (payload) => {
  return http.post('/api/user-info/login', payload)
}