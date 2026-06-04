import { reactive, readonly } from 'vue'

const DEFAULT_OPTIONS = {
  title: 'Xác nhận thao tác',
  message: '',
  confirmText: 'Xác nhận',
  cancelText: 'Huỷ',
  tone: 'primary',
}

const state = reactive({
  open: false,
  options: { ...DEFAULT_OPTIONS },
  resolver: null,
})

function resolveConfirm(value) {
  const resolver = state.resolver
  state.open = false
  state.resolver = null

  if (resolver) {
    resolver(value)
  }
}

export function confirmDialog(options = {}) {
  if (state.resolver) {
    resolveConfirm(false)
  }

  state.options = {
    ...DEFAULT_OPTIONS,
    ...options,
  }
  state.open = true

  return new Promise((resolve) => {
    state.resolver = resolve
  })
}

export function useConfirmDialog() {
  return {
    confirm: confirmDialog,
  }
}

export function useConfirmDialogState() {
  return {
    state: readonly(state),
    cancel: () => resolveConfirm(false),
    accept: () => resolveConfirm(true),
  }
}
