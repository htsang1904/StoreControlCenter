import { reactive } from 'vue'

const toastState = reactive({
  items: [],
})

let seed = 0

const DEFAULT_DURATION = 3200

const pushToast = (message, options = {}) => {
  const id = ++seed
  const type = options.type || 'info'
  const duration = Number(options.duration || DEFAULT_DURATION)
  const title = options.title || ''

  toastState.items.push({
    id,
    title,
    message,
    type,
  })

  if (duration > 0) {
    window.setTimeout(() => {
      const index = toastState.items.findIndex((toast) => toast.id === id)
      if (index >= 0) {
        toastState.items.splice(index, 1)
      }
    }, duration)
  }

  return id
}

const removeToast = (id) => {
  const index = toastState.items.findIndex((toast) => toast.id === id)
  if (index >= 0) {
    toastState.items.splice(index, 1)
  }
}

export function useToast() {
  return {
    toasts: toastState.items,
    show: (message, options) => pushToast(message, options),
    success: (message, options = {}) =>
      pushToast(message, { ...options, type: 'success' }),
    error: (message, options = {}) =>
      pushToast(message, { ...options, type: 'error' }),
    info: (message, options = {}) =>
      pushToast(message, { ...options, type: 'info' }),
    remove: removeToast,
  }
}
