import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
let refreshPromise = null

const clearAuthStorage = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
}

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

const storeAuthTokens = (payload) => {
  const accessToken = payload?.data?.accessToken
  const refreshToken = payload?.data?.refreshToken

  if (accessToken) {
    localStorage.setItem('token', accessToken)
  }
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken)
  }
}

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  const response = await axios.post(
    `${API_BASE_URL}/api/user-info/refresh`,
    { refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  )

  const data = response?.data
  const accessToken = data?.data?.accessToken
  if (!data?.success || !accessToken) {
    throw new Error(data?.message || 'Refresh token failed')
  }

  storeAuthTokens(data)
  return accessToken
}

const isAuthEndpoint = (url = '') =>
  url.includes('/api/user-info/login') ||
  url.includes('/api/user-info/refresh') ||
  url.includes('/api/user-info/logout')

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
    async (error) => {
      if (!isAppApiClient) {
        return Promise.reject(error)
      }

      const originalRequest = error.config || {}
      const status = error.response?.status

      if (status !== 401 || originalRequest._retry || isAuthEndpoint(originalRequest.url || '')) {
        if (status === 401) {
          clearAuthStorage()
          redirectToLogin()
        }
        return Promise.reject(error)
      }

      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }

        const accessToken = await refreshPromise
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${accessToken}`

        return client(originalRequest)
      } catch (refreshError) {
        clearAuthStorage()
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }
  )

  return client
}

export default getClient
