import axios from 'axios'
const getClient = (baseURL = import.meta.env.VITE_API_BASE_URL) => {
    let client = axios.create({
        baseURL: baseURL,
        timeout: 15000,
        headers: {
            'Content-Type': 'application/json',
        },
    })
    client.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('token')
            if (token) {
                config.headers['x-authorization'] = `Bearer ${token}`
            }
            return config
        },
        (error) => Promise.reject(error)
    )

    client.interceptors.response.use(
        (response) => response.data,
        (error) => {
            if (error.response?.status === 401) {
                console.warn('Unauthorized')
                localStorage.removeItem('token')
            }
            return Promise.reject(error)
        }
    )
    return client
}

export default getClient
