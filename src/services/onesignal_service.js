import { reactive } from 'vue'
import {
  deactivateNotificationSubscription,
  registerNotificationSubscription,
} from './notification_service'

const ONESIGNAL_SCRIPT_ID = 'onesignal-sdk'
const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
const ONESIGNAL_TIMEOUT_MS = 12000
const LEGACY_RESET_VERSION = 'v4'
const PUSH_DISABLED_KEY = 'onesignal-push-disabled'

let initialized = false
let initializingPromise = null
let enablingPromise = null
let subscriptionListenerAttached = false

export const pushState = reactive({
  configured: false,
  supported: false,
  ready: false,
  permission: 'default',
  optedIn: false,
  subscriptionId: null,
  subscriptionToken: null,
  onesignalId: null,
  userDisabled: window.localStorage.getItem(PUSH_DISABLED_KEY) === '1',
  lastError: '',
})

export const getOneSignalAppId = () => String(import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim()

const isAlreadyInitializedError = (error) => (
  String(error?.message || error || '').toLowerCase().includes('already initialized')
)

const deleteIndexedDatabase = (databaseName) =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(databaseName)

    request.onsuccess = () => {
      resolve(true)
    }

    request.onerror = () => {
      reject(
        request.error ||
          new Error(`Không thể xoá IndexedDB: ${databaseName}`),
      )
    }

    request.onblocked = () => {
      reject(
        new Error(
          `IndexedDB "${databaseName}" đang được tab khác sử dụng`,
        ),
      )
    }
  })

const resetLegacyOneSignalState = async () => {
  const appId = getOneSignalAppId()
  const resetKey =
    `push-integration-reset:${LEGACY_RESET_VERSION}:${appId}`

  if (window.localStorage.getItem(resetKey) === '1') {
    return false
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations =
        await navigator.serviceWorker.getRegistrations()

      await Promise.all(
        registrations
          .filter((registration) => {
            const scriptUrl =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              ''

            return scriptUrl.includes(
              'OneSignalSDKWorker.js',
            )
          })
          .map(async (registration) => {
            const subscription =
              await registration.pushManager
                ?.getSubscription()
                .catch(() => null)

            await subscription
              ?.unsubscribe()
              .catch(() => false)

            const unregistered =
              await registration.unregister()

            if (!unregistered) {
              throw new Error(
                'Không thể unregister OneSignal Service Worker',
              )
            }
          }),
      )
    }

    if (window.indexedDB?.databases) {
      const databases =
        await window.indexedDB.databases()

      const oneSignalDatabases = databases
        .map((database) => database?.name)
        .filter(
          (name) =>
            name &&
            name.toLowerCase().includes('onesignal'),
        )

      for (const databaseName of oneSignalDatabases) {
        await deleteIndexedDatabase(databaseName)
      }
    }

    Object.keys(window.localStorage)
      .filter((key) => {
        const normalizedKey = key.toLowerCase()

        return (
          normalizedKey.includes('onesignal') ||
          (
            key.startsWith('push-integration-reset:') &&
            key !== resetKey
          )
        )
      })
      .forEach((key) => {
        window.localStorage.removeItem(key)
      })

    Object.keys(window.sessionStorage)
      .filter((key) =>
        key.toLowerCase().includes('onesignal'),
      )
      .forEach((key) => {
        window.sessionStorage.removeItem(key)
      })

    // Chỉ đánh dấu hoàn tất khi toàn bộ quá trình thật sự thành công.
    window.localStorage.setItem(resetKey, '1')

    return true
  } catch (error) {
    // Không set resetKey để lần tải sau còn thử lại.
    console.error(
      '[OneSignal] Không thể xoá trạng thái cũ:',
      error,
    )

    window.localStorage.removeItem(resetKey)

    throw error
  }
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
  pushState.onesignalId = getOneSignalUserId(OneSignal)
  pushState.ready = true
}

const getOneSignalUserId = (OneSignal) => (
  OneSignal?.User?.onesignalId ||
  OneSignal?.User?.onesignal_id ||
  null
)

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
  try {
    const didResetLegacyState =
      await resetLegacyOneSignalState()

    if (didResetLegacyState) {
      window.location.reload()
      return false
    }
  } catch (error) {
    console.error(
      '[OneSignal] Không thể reset dữ liệu cũ:',
      error,
    )

    pushState.ready = false
    pushState.lastError =
      error?.message ||
      'Không thể xoá dữ liệu OneSignal cũ'

    throw error
  }

  refreshBrowserState()

  if (!pushState.configured) {
    pushState.ready = false
    pushState.lastError =
      'Chưa cấu hình VITE_ONESIGNAL_APP_ID'

    return false
  }

  if (!pushState.supported) {
    pushState.ready = false
    pushState.lastError =
      'Trình duyệt không hỗ trợ Web Push'

    return false
  }

  if (!initializingPromise) {
    initializingPromise = withOneSignal(
      async (OneSignal) => {
        if (!initialized) {
          try {
            await OneSignal.init({
              appId: getOneSignalAppId(),

              notifyButton: {
                enable: false,
              },
            })
          } catch (error) {
            if (!isAlreadyInitializedError(error)) {
              throw error
            }
          }

          initialized = true
        }

        attachSubscriptionListener(OneSignal)
        syncSubscriptionState(OneSignal)

        return true
      },
    )
      .catch((error) => {
        initialized = false
        pushState.ready = false
        pushState.lastError =
          error?.message ||
          'Không thể khởi tạo OneSignal'

        console.error(
          '[OneSignal] Khởi tạo thất bại:',
          error,
        )

        throw error
      })
      .finally(() => {
        initializingPromise = null
      })
  }

  try {
    await initializingPromise
  } catch (error) {
    return false
  }

  const hasAuthenticatedUser = Boolean(
    window.localStorage.getItem('token'),
  )

  const hasActiveSubscription =
    pushState.permission === 'granted' &&
    pushState.optedIn === true &&
    Boolean(pushState.subscriptionId) &&
    Boolean(pushState.subscriptionToken)

  if (hasAuthenticatedUser && hasActiveSubscription) {
    try {
      const result =
        await registerNotificationSubscription({
          subscription_id:
            pushState.subscriptionId,
          onesignal_id: pushState.onesignalId,
          platform: 'web',
        })

      if (result?.success === false) {
        throw new Error(
          result?.message ||
            'Không thể lưu thiết bị nhận thông báo',
        )
      }
    } catch (error) {
      console.error(
        '[OneSignal] Không thể đăng ký subscription với backend:',
        error,
      )

      pushState.lastError =
        error?.message ||
        'Không thể lưu thiết bị nhận thông báo'

      /*
       * OneSignal đã khởi tạo thành công nên vẫn trả về true.
       * Việc backend không lưu được subscription không nên khiến
       * SDK bị init lại hoặc tạo vòng lặp reload.
       */
      return true
    }
  }

  pushState.lastError = ''
  return true
}

const assertBrowserPushSubscription = async () => {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription?.endpoint) {
    throw new Error('Chrome chưa tạo push token. Hãy kiểm tra Service Worker và thử lại.')
  }
}

export const enableOneSignalPush = async () => {
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
        const result = await registerNotificationSubscription({
          subscription_id: subscriptionId,
          onesignal_id: getOneSignalUserId(OneSignal),
          platform: 'web',
        })
        if (result?.success === false) {
          throw new Error(result?.message || 'Không thể lưu thiết bị nhận thông báo')
        }
        window.localStorage.removeItem(PUSH_DISABLED_KEY)
        pushState.userDisabled = false
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

export const disableOneSignalPush = async () => {
  const ready = await initializeOneSignal()
  if (!ready) return false

  return withOneSignal(async (OneSignal) => {
    syncSubscriptionState(OneSignal)
    const subscriptionId = pushState.subscriptionId

    if (subscriptionId) {
      await deactivateNotificationSubscription(subscriptionId)
    }

    if (pushState.optedIn) {
      await OneSignal.User.PushSubscription.optOut()
    }

    syncSubscriptionState(OneSignal)
    window.localStorage.setItem(PUSH_DISABLED_KEY, '1')
    pushState.userDisabled = true
    pushState.lastError = ''
    return true
  }).catch((error) => {
    refreshBrowserState()
    pushState.lastError = error?.message || 'Không thể tắt thông báo'
    throw error
  })
}

export const disconnectOneSignalUser = async () => {
  const ready = await initializeOneSignal().catch(() => false)
  if (!ready || !pushState.subscriptionId) return
  await deactivateNotificationSubscription(pushState.subscriptionId)
}

refreshBrowserState()
