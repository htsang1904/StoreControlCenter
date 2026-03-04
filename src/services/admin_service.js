import getClient from './http'

const http = getClient()

export const syncStoresNow = () => {
  return http.post('/api/stores/sync')
}
