import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const clearAuthStorage = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
}

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

const getClient = (baseURL = API_BASE_URL) => {
  const isAppApiClient = baseURL === API_BASE_URL

  const client = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.request.use(
    (config) => {
      if (isAppApiClient) {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }

      return config
    },
    (error) => Promise.reject(error)
  )

  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (isAppApiClient && error.response?.status === 401) {
        clearAuthStorage()
        redirectToLogin()
      }
      return Promise.reject(error)
    }
  )

  return client
}

export default getClient
