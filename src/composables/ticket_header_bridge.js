import { reactive } from 'vue'

const DEFAULT_TITLE = 'Danh sách vé hỗ trợ'
const DEFAULT_SUBTITLE = 'Quản lý và giải quyết các yêu cầu kỹ thuật từ hệ thống cửa hàng'

const state = reactive({
  enabled: false,
  title: DEFAULT_TITLE,
  subtitle: DEFAULT_SUBTITLE,
})

export function useTicketHeaderBridge() {
  return state
}

export function resetTicketHeaderBridge() {
  state.enabled = false
  state.title = DEFAULT_TITLE
  state.subtitle = DEFAULT_SUBTITLE
}
