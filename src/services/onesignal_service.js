import { reactive } from 'vue'

const ONESIGNAL_SCRIPT_ID = 'onesignal-sdk'
const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
const ONESIGNAL_TIMEOUT_MS = 12000
const LEGACY_RESET_VERSION = 'v3'

let initialized = false
let initializingPromise = null
let enablingPromise = null
let subscriptionListenerAttached = false
let identifiedUserId = null

export const pushState = reactive({
  configured: false,
  supported: false,
  ready: false,
  permission: 'default',
  optedIn: false,
  subscriptionId: null,
  subscriptionToken: null,
  lastError: '',
})

export const getOneSignalAppId = () => String(import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim()

const getUserId = (user) => user?.id || user?.user_id || user?.staff_id || null

const isAlreadyInitializedError = (error) => (
  String(error?.message || error || '').toLowerCase().includes('already initialized')
)

const isExpectedIdentityConflict = (error) => {
  const status = Number(
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.response?.statusCode ||
    0
  )
  const message = String(error?.message || error || '').toLowerCase()

  return status === 409 || (message.includes('409') && message.includes('conflict'))
}

const deleteIndexedDatabase = (databaseName) => new Promise((resolve) => {
  const request = window.indexedDB.deleteDatabase(databaseName)
  request.onsuccess = () => resolve()
  request.onerror = () => resolve()
  request.onblocked = () => resolve()
})

const resetLegacyOneSignalState = async () => {
  const resetKey = `push-integration-reset:${LEGACY_RESET_VERSION}:${getOneSignalAppId()}`
  if (window.localStorage.getItem(resetKey) === '1') return false

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations
        .filter((registration) => {
          const scriptUrl = (
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            ''
          )
          return scriptUrl.includes('OneSignalSDKWorker.js')
        })
        .map(async (registration) => {
          const subscription = await registration.pushManager?.getSubscription().catch(() => null)
          await subscription?.unsubscribe().catch(() => false)
          return registration.unregister().catch(() => false)
        })
    )
  }

  if (window.indexedDB?.databases) {
    const databases = await window.indexedDB.databases().catch(() => [])
    await Promise.all(
      databases
        .map((database) => database?.name)
        .filter((name) => name?.toLowerCase().includes('onesignal'))
        .map((name) => deleteIndexedDatabase(name))
    )
  }

  Object.keys(window.localStorage)
    .filter((key) => (
      key.toLowerCase().includes('onesignal') ||
      key.startsWith('push-integration-reset:')
    ))
    .forEach((key) => window.localStorage.removeItem(key))

  Object.keys(window.sessionStorage)
    .filter((key) => key.toLowerCase().includes('onesignal'))
    .forEach((key) => window.sessionStorage.removeItem(key))

  window.localStorage.setItem(resetKey, '1')
  return true
}

const isBrowserSupported = () => (
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window
)

const refreshBrowserState = () => {
  pushState.configured = Boolean(getOneSignalAppId())
  pushState.supported = isBrowserSupported()
  pushState.permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

const withTimeout = (promise, message) => {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ONESIGNAL_TIMEOUT_MS)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId))
}

const ensureSdkScript = () => withTimeout(new Promise((resolve, reject) => {
  window.OneSignalDeferred = window.OneSignalDeferred || []

  const existingScript = document.getElementById(ONESIGNAL_SCRIPT_ID)
  if (existingScript) {
    if (existingScript.dataset.loaded === 'true' || window.OneSignal) {
      resolve()
      return
    }
    existingScript.addEventListener('load', resolve, { once: true })
    existingScript.addEventListener('error', reject, { once: true })
    return
  }

  const script = document.createElement('script')
  script.id = ONESIGNAL_SCRIPT_ID
  script.src = ONESIGNAL_SDK_URL
  script.defer = true
  script.onload = () => {
    script.dataset.loaded = 'true'
    resolve()
  }
  script.onerror = () => reject(new Error('Không tải được OneSignal SDK'))
  document.head.appendChild(script)
}), 'Không thể kết nối OneSignal. Vui lòng kiểm tra kết nối mạng.')

const withOneSignal = async (callback) => {
  await ensureSdkScript()
  window.OneSignalDeferred = window.OneSignalDeferred || []

  if (window.OneSignal) return callback(window.OneSignal)

  return withTimeout(new Promise((resolve, reject) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await callback(OneSignal))
      } catch (error) {
        reject(error)
      }
    })
  }), 'OneSignal SDK không phản hồi. Vui lòng thử lại.')
}

const syncSubscriptionState = (OneSignal) => {
  refreshBrowserState()
  pushState.optedIn = OneSignal?.User?.PushSubscription?.optedIn === true
  pushState.subscriptionId = OneSignal?.User?.PushSubscription?.id || null
  pushState.subscriptionToken = OneSignal?.User?.PushSubscription?.token || null
  pushState.ready = true
}

const syncIdentifiedUser = (OneSignal) => {
  identifiedUserId = OneSignal?.User?.externalId
    ? String(OneSignal.User.externalId)
    : null
}

const attachSubscriptionListener = (OneSignal) => {
  if (subscriptionListenerAttached) return

  OneSignal.User.PushSubscription.addEventListener('change', (event) => {
    refreshBrowserState()
    pushState.optedIn = event.current.optedIn === true
    pushState.subscriptionId = event.current.id || null
    pushState.subscriptionToken = event.current.token || null
  })
  subscriptionListenerAttached = true
}

const waitForActiveSubscription = (OneSignal) => {
  syncSubscriptionState(OneSignal)
  if (
    pushState.permission === 'granted' &&
    pushState.optedIn &&
    pushState.subscriptionId &&
    pushState.subscriptionToken
  ) {
    return Promise.resolve(pushState.subscriptionId)
  }
  if (pushState.permission === 'denied') {
    return Promise.reject(new Error('Trình duyệt đang chặn quyền thông báo'))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      OneSignal.User.PushSubscription.removeEventListener('change', handleChange)
      reject(new Error('Chưa nhận được subscription từ OneSignal. Vui lòng thử lại.'))
    }, ONESIGNAL_TIMEOUT_MS)

    const handleChange = (event) => {
      refreshBrowserState()
      pushState.optedIn = event.current.optedIn === true
      pushState.subscriptionId = event.current.id || null
      pushState.subscriptionToken = event.current.token || null

      if (
        pushState.permission === 'granted' &&
        pushState.optedIn &&
        pushState.subscriptionId &&
        pushState.subscriptionToken
      ) {
        window.clearTimeout(timeoutId)
        OneSignal.User.PushSubscription.removeEventListener('change', handleChange)
        resolve(pushState.subscriptionId)
      }
    }

    OneSignal.User.PushSubscription.addEventListener('change', handleChange)
  })
}

export const initializeOneSignal = async () => {
  const didResetLegacyState = await resetLegacyOneSignalState()
  if (didResetLegacyState) {
    window.location.reload()
    return false
  }

  refreshBrowserState()
  if (!pushState.configured || !pushState.supported) return false

  if (!initializingPromise) {
    initializingPromise = withOneSignal(async (OneSignal) => {
      if (!initialized) {
        try {
          await OneSignal.init({
            appId: getOneSignalAppId(),
            notifyButton: {
              enable: false,
            },
          })
        } catch (error) {
          if (!isAlreadyInitializedError(error)) throw error
        }
        initialized = true
      }

      attachSubscriptionListener(OneSignal)
      syncSubscriptionState(OneSignal)
      syncIdentifiedUser(OneSignal)
      return true
    }).catch((error) => {
      pushState.ready = false
      pushState.lastError = error?.message || 'Không thể khởi tạo OneSignal'
      throw error
    }).finally(() => {
      initializingPromise = null
    })
  }

  await initializingPromise

  pushState.lastError = ''
  return true
}

const identifyOneSignalUser = async (OneSignal, user) => {
  const userId = getUserId(user)
  syncIdentifiedUser(OneSignal)
  if (!userId || identifiedUserId === String(userId)) return

  try {
    await OneSignal.login(String(userId))
  } catch (error) {
    if (!isExpectedIdentityConflict(error)) throw error
  }
  identifiedUserId = String(userId)
  syncSubscriptionState(OneSignal)
}

const assertBrowserPushSubscription = async () => {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription?.endpoint) {
    throw new Error('Chrome chưa tạo push token. Hãy kiểm tra Service Worker và thử lại.')
  }
}

export const enableOneSignalPush = async (user) => {
  if (!enablingPromise) {
    enablingPromise = (async () => {
      const ready = await initializeOneSignal()
      if (!ready) return null

      return withOneSignal(async (OneSignal) => {
        syncSubscriptionState(OneSignal)
        if (!pushState.optedIn) {
          await OneSignal.User.PushSubscription.optIn()
        }

        refreshBrowserState()
        if (pushState.permission !== 'granted') {
          throw new Error('Bạn chưa cấp quyền thông báo cho trình duyệt')
        }

        const subscriptionId = await waitForActiveSubscription(OneSignal)
        await assertBrowserPushSubscription()
        await identifyOneSignalUser(OneSignal, user)
        pushState.lastError = ''
        return subscriptionId
      })
    })().catch((error) => {
      refreshBrowserState()
      pushState.lastError = error?.message || 'Không thể bật thông báo'
      throw error
    }).finally(() => {
      enablingPromise = null
    })
  }

  return enablingPromise
}

export const disconnectOneSignalUser = async () => {
  if (!initialized) return

  await withOneSignal(async (OneSignal) => {
    await OneSignal.logout()
    identifiedUserId = null
    syncSubscriptionState(OneSignal)
  }).catch(() => {})
}

refreshBrowserState()
