const DEFAULT_RECONNECT_DELAY_MS = 2000
const DEFAULT_PING_INTERVAL_MS = 25000

function normalizePath(path) {
  const raw = String(path || '').trim()
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

function toWebSocketBaseUrl(apiBaseUrl) {
  if (apiBaseUrl.startsWith('https://')) return apiBaseUrl.replace(/^https:\/\//i, 'wss://')
  if (apiBaseUrl.startsWith('http://')) return apiBaseUrl.replace(/^http:\/\//i, 'ws://')
  return apiBaseUrl
}

function buildSocketUrl(path, token) {
  const wsBaseUrl = toWebSocketBaseUrl(resolveApiBaseUrl())
  const url = new URL(`${wsBaseUrl}${normalizePath(path)}`)
  if (token) {
    url.searchParams.set('token', token)
  }
  return url.toString()
}

export function createRealtimeConnection({
  path,
  getToken,
  onEvent,
  onOpen,
  onClose,
  onError,
  shouldReconnect,
  reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
  pingIntervalMs = DEFAULT_PING_INTERVAL_MS,
} = {}) {
  let socket = null
  let reconnectTimer = null
  let pingTimer = null
  let isClosedManually = false

  const clearReconnectTimer = () => {
    if (!reconnectTimer) return
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const clearPingTimer = () => {
    if (!pingTimer) return
    window.clearInterval(pingTimer)
    pingTimer = null
  }

  const scheduleReconnect = (closeEvent) => {
    if (isClosedManually) return

    const reconnectAllowed = typeof shouldReconnect === 'function'
      ? shouldReconnect(closeEvent)
      : true
    if (!reconnectAllowed) return

    clearReconnectTimer()
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelayMs)
  }

  const connect = () => {
    const token = typeof getToken === 'function' ? getToken() : null
    if (!token || !path) return false

    clearReconnectTimer()
    clearPingTimer()

    try {
      socket = new WebSocket(buildSocketUrl(path, token))
    } catch (error) {
      if (typeof onError === 'function') onError(error)
      scheduleReconnect()
      return false
    }

    socket.onopen = (event) => {
      clearPingTimer()
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send('ping')
        }
      }, pingIntervalMs)

      if (typeof onOpen === 'function') onOpen(event)
    }

    socket.onmessage = (event) => {
      let payload = null
      try {
        payload = JSON.parse(event.data)
      } catch (_err) {
        return
      }
      if (typeof onEvent === 'function') onEvent(payload)
    }

    socket.onerror = (event) => {
      if (typeof onError === 'function') onError(event)
    }

    socket.onclose = (event) => {
      clearPingTimer()
      if (typeof onClose === 'function') onClose(event)
      scheduleReconnect(event)
    }

    return true
  }

  const close = () => {
    isClosedManually = true
    clearReconnectTimer()
    clearPingTimer()
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close()
    }
    socket = null
  }

  return {
    connect,
    close,
    get readyState() {
      return socket?.readyState ?? WebSocket.CLOSED
    },
  }
}

