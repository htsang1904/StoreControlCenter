import { reactive } from 'vue'
import {
  registerNotificationSubscription,
  unregisterNotificationSubscription,
} from './notification_service'

const ONESIGNAL_SCRIPT_ID = 'onesignal-sdk'
const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
const ONESIGNAL_OPERATION_TIMEOUT_MS = 12000

let initialized = false
let initializingPromise = null
let registeredSubscriptionId = null

export const pushState = reactive({
  supported: false,
  configured: false,
  initializing: false,
  subscribed: false,
  permission: 'default',
  lastError: '',
})

const getAppId = () => String(import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim()

const isAlreadyInitializedError = (error) => (
  String(error?.message || error || '').toLowerCase().includes('already initialized')
)

const withTimeout = (promise, message = 'Thao tác thông báo quá thời gian chờ') => Promise.race([
  promise,
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ONESIGNAL_OPERATION_TIMEOUT_MS)
  }),
])

const isBrowserSupported = () => (
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window
)

const refreshBrowserState = () => {
  pushState.configured = Boolean(getAppId())
  pushState.supported = isBrowserSupported()
  pushState.permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
}

refreshBrowserState()

const ensureSdkScript = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    resolve()
    return
  }

  const existingScript = document.getElementById(ONESIGNAL_SCRIPT_ID)
  if (existingScript) {
    if (window.OneSignalDeferred) resolve()
    existingScript.addEventListener('load', resolve, { once: true })
    existingScript.addEventListener('error', reject, { once: true })
    return
  }

  window.OneSignalDeferred = window.OneSignalDeferred || []
  const script = document.createElement('script')
  script.id = ONESIGNAL_SCRIPT_ID
  script.src = ONESIGNAL_SDK_URL
  script.defer = true
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})

const withOneSignal = async (callback) => {
  await ensureSdkScript()
  window.OneSignalDeferred = window.OneSignalDeferred || []
  return withTimeout(new Promise((resolve, reject) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await callback(OneSignal))
      } catch (error) {
        reject(error)
      }
    })
  }), 'Không thể kết nối OneSignal. Vui lòng thử lại sau.')
}

const readSubscriptionId = async (OneSignal) => {
  if (OneSignal?.User?.PushSubscription?.id) {
    return OneSignal.User.PushSubscription.id
  }

  const pushSubscription = await navigator.serviceWorker.ready
    .then((registration) => registration.pushManager.getSubscription())
    .catch(() => null)

  return pushSubscription?.endpoint || null
}

export const initializeOneSignal = async () => {
  refreshBrowserState()
  const appId = getAppId()
  if (!appId || !pushState.supported) return false
  if (initialized) return true
  if (initializingPromise) return initializingPromise

  pushState.initializing = true
  initializingPromise = withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.init({ appId })
    } catch (error) {
      if (!isAlreadyInitializedError(error)) throw error
    }
    initialized = true
    pushState.lastError = ''
    return true
  }).catch((error) => {
    initialized = isAlreadyInitializedError(error)
    if (initialized) return true
    pushState.lastError = error?.message || 'Không thể khởi tạo thông báo'
    throw error
  }).finally(() => {
    initializingPromise = null
    pushState.initializing = false
    refreshBrowserState()
  })

  return initializingPromise
}

export const refreshOneSignalSubscriptionState = async () => {
  refreshBrowserState()
  if (!pushState.configured || !pushState.supported) return pushState

  try {
    const ready = await initializeOneSignal()
    if (!ready) return pushState

    await withOneSignal(async (OneSignal) => {
      const subscriptionId = await readSubscriptionId(OneSignal)
      registeredSubscriptionId = subscriptionId || registeredSubscriptionId
      pushState.subscribed = Boolean(subscriptionId) && pushState.permission === 'granted'
    })
  } catch (error) {
    pushState.lastError = error?.message || 'Không thể kiểm tra trạng thái thông báo'
  }

  return pushState
}

export const bindOneSignalUser = async (user, { requestPermission = true } = {}) => {
  const userId = user?.id || user?.user_id || user?.staff_id
  if (!userId) return null

  const ready = await initializeOneSignal()
  if (!ready) return null

  return withOneSignal(async (OneSignal) => {
    const externalId = String(userId)

    if (
      requestPermission &&
      OneSignal.Notifications?.permission !== true &&
      typeof OneSignal.Notifications?.requestPermission === 'function'
    ) {
      await withTimeout(
        OneSignal.Notifications.requestPermission(),
        'Trình duyệt chưa phản hồi yêu cầu bật thông báo. Vui lòng thử lại.'
      )
    }

    refreshBrowserState()
    const subscriptionId = await readSubscriptionId(OneSignal)
    pushState.subscribed = Boolean(subscriptionId) && pushState.permission === 'granted'
    if (!subscriptionId || pushState.permission !== 'granted') return null

    await registerNotificationSubscription({
      subscription_id: subscriptionId,
      external_id: externalId,
      platform: 'web',
    })

    registeredSubscriptionId = subscriptionId
    pushState.subscribed = true
    pushState.lastError = ''
    return subscriptionId
  })
}

export const unbindOneSignalUser = async () => {
  const subscriptionId = registeredSubscriptionId
  registeredSubscriptionId = null
  pushState.subscribed = false

  if (subscriptionId) {
    await unregisterNotificationSubscription(subscriptionId).catch(() => {})
  }

  if (!initialized) return

  await withOneSignal(async (OneSignal) => {
    if (typeof OneSignal.logout === 'function') {
      await OneSignal.logout()
    }
  }).catch(() => {})
}
