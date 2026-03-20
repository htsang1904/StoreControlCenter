import getClient from './http'
const suiteClient = getClient(import.meta.env.VITE_AUTH_URL)
const http = getClient()

export const loginBySuite = (payload) => {
  return suiteClient.post('/v1/auth/login', payload)
}
export const login = (payload) => {
  return http.post('/api/auth/login', payload)
}
export const getMe = () => {
  return http.get('/api/auth/me')
}
export const logout = () => {
  return http.post('/api/auth/logout')
}
export const syncStores = () => {
  return http.post('/api/auth/sync-stores')
}
export const refreshToken = (payload) => {
  return http.post('/api/auth/refresh', payload)
}
